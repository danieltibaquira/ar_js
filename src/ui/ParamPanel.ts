/**
 * ParamPanel — thin façade over a binding-style UI library (default:
 * Tweakpane). Each sketch's parameters become a folder of bindings; values
 * are persisted per-sketch in `localStorage` and restored on reload.
 *
 * The pane factory is dependency-injected so tests can drive the panel
 * without depending on Tweakpane's DOM rendering.
 */

import type {
  SketchParam,
  SketchParamValue,
} from '../core/SketchRunner';

export interface PaneBinding {
  setValue(value: SketchParamValue): void;
  dispose(): void;
}

export interface Pane {
  addBinding(
    def: SketchParam,
    initialValue: SketchParamValue,
    onChange: (value: SketchParamValue) => void,
    options?: Readonly<Record<string, unknown>>,
  ): PaneBinding;
  dispose(): void;
}

export type PaneFactory = (host: HTMLElement, title: string) => Pane;

export type ParamChangeListener = (
  key: string,
  value: SketchParamValue,
) => void;

export interface ParamPanelOptions {
  readonly host: HTMLElement;
  readonly sketchId: string;
  readonly params: readonly SketchParam[];
  readonly onChange: ParamChangeListener;
  /** `null` opts out of persistence entirely. Defaults to `localStorage`. */
  readonly storage?: Storage | null;
  /** Defaults to `igx:params:`. The full key is `${prefix}${sketchId}`. */
  readonly storageKeyPrefix?: string;
  /**
   * Pane factory. Defaults to a Tweakpane-backed adapter at runtime; tests
   * inject a stub.
   */
  readonly paneFactory?: PaneFactory;
  /** Optional pane title. Defaults to the sketch id. */
  readonly title?: string;
}

const DEFAULT_PREFIX = 'igx:params:';

export class ParamPanel {
  private readonly params: readonly SketchParam[];
  private readonly onChange: ParamChangeListener;
  private readonly storage: Storage | null;
  private readonly storageKey: string;
  private readonly pane: Pane;
  private readonly bindings = new Map<string, PaneBinding>();
  private readonly state: Record<string, SketchParamValue> = {};

  constructor(options: ParamPanelOptions) {
    this.params = options.params;
    this.onChange = options.onChange;
    this.storage =
      options.storage === undefined ? defaultStorage() : options.storage;
    const prefix = options.storageKeyPrefix ?? DEFAULT_PREFIX;
    this.storageKey = `${prefix}${options.sketchId}`;

    const factory = options.paneFactory ?? defaultPaneFactory;
    this.pane = factory(options.host, options.title ?? options.sketchId);

    const stored = this.loadStored();

    // Build bindings with the merged initial values.
    for (const def of this.params) {
      const initial = stored[def.key] ?? def.default;
      this.state[def.key] = initial;
      const binding = this.pane.addBinding(
        def,
        initial,
        (value) => {
          this.state[def.key] = value;
          this.persist();
          this.onChange(def.key, value);
        },
        bindingOptions(def),
      );
      this.bindings.set(def.key, binding);
    }

    // Notify caller of restored values that differ from defaults so the
    // mounted sketch picks them up without a separate flush step.
    for (const def of this.params) {
      const restored = stored[def.key];
      if (restored !== undefined && restored !== def.default) {
        this.onChange(def.key, this.state[def.key]!);
      }
    }
  }

  values(): Readonly<Record<string, SketchParamValue>> {
    return { ...this.state };
  }

  setValue(key: string, value: SketchParamValue): void {
    const binding = this.bindings.get(key);
    if (!binding) {
      throw new RangeError(`ParamPanel: unknown param key "${key}"`);
    }
    this.state[key] = value;
    binding.setValue(value);
    this.persist();
    this.onChange(key, value);
  }

  reset(): void {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        /* swallow */
      }
    }
    const changed: SketchParam[] = [];
    for (const def of this.params) {
      if (this.state[def.key] !== def.default) changed.push(def);
      this.state[def.key] = def.default;
      this.bindings.get(def.key)?.setValue(def.default);
    }
    for (const def of changed) {
      this.onChange(def.key, def.default);
    }
  }

  dispose(): void {
    for (const binding of this.bindings.values()) binding.dispose();
    this.bindings.clear();
    this.pane.dispose();
  }

  private loadStored(): Record<string, SketchParamValue> {
    if (!this.storage) return {};
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch {
      return {};
    }
    if (raw === null) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, SketchParamValue>;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* fall through */
    }
    return {};
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      // Persist only keys that differ from their defaults to keep the blob small.
      const out: Record<string, SketchParamValue> = {};
      for (const def of this.params) {
        const v = this.state[def.key];
        if (v !== undefined && v !== def.default) out[def.key] = v;
      }
      if (Object.keys(out).length === 0) {
        this.storage.removeItem(this.storageKey);
      } else {
        this.storage.setItem(this.storageKey, JSON.stringify(out));
      }
    } catch {
      /* swallow */
    }
  }
}

function bindingOptions(def: SketchParam): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (def.min !== undefined) out['min'] = def.min;
  if (def.max !== undefined) out['max'] = def.max;
  if (def.step !== undefined) out['step'] = def.step;
  if (def.label !== undefined) out['label'] = def.label;
  return out;
}

function defaultStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Default pane factory — wraps Tweakpane v4 (`addBinding`-based API). Lives
 * alongside the panel so the panel module is the single import for callers
 * that don't need to swap implementations.
 */

interface TweakpaneBinding {
  on(event: 'change', cb: (ev: { value: SketchParamValue }) => void): unknown;
  refresh(): void;
  dispose(): void;
}

interface TweakpaneInstance {
  addBinding(
    target: object,
    key: string,
    options?: Readonly<Record<string, unknown>>,
  ): TweakpaneBinding;
  dispose(): void;
}

interface TweakpaneCtor {
  new (opts: { container: HTMLElement; title?: string }): TweakpaneInstance;
}

import * as tweakpaneNS from 'tweakpane';

const defaultPaneFactory: PaneFactory = (host, title) => {
  const TweakpanePane = (tweakpaneNS as unknown as { Pane: TweakpaneCtor }).Pane;
  const pane = new TweakpanePane({ container: host, title });

  return {
    addBinding(def, initialValue, onChange, options) {
      const target: Record<string, SketchParamValue> = {
        [def.key]: initialValue,
      };
      const binding = pane.addBinding(target, def.key, options ?? {});
      binding.on('change', (ev) => onChange(ev.value));
      return {
        setValue(value) {
          target[def.key] = value;
          binding.refresh();
        },
        dispose() {
          binding.dispose();
        },
      };
    },
    dispose() {
      pane.dispose();
    },
  };
};
