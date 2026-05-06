import { describe, expect, it, beforeEach } from 'vitest';
import {
  ParamPanel,
  type Pane,
  type PaneBinding,
  type PaneFactory,
} from '../../src/ui/ParamPanel';
import type {
  SketchParam,
  SketchParamValue,
} from '../../src/core/SketchRunner';

interface MockBinding extends PaneBinding {
  value: SketchParamValue;
  refreshes: number;
  disposed: boolean;
  options: Readonly<Record<string, unknown>>;
}

interface MockPane extends Pane {
  bindings: Map<string, MockBinding>;
  triggerChange(key: string, value: SketchParamValue): void;
  host: HTMLElement;
  title: string;
  disposed: boolean;
}

interface MockFactory {
  factory: PaneFactory;
  lastPane(): MockPane;
}

function createMockFactory(): MockFactory {
  let last: MockPane | null = null;
  const factory: PaneFactory = (host, title) => {
    const bindings = new Map<string, MockBinding>();
    const handlers = new Map<string, (value: SketchParamValue) => void>();
    const pane: MockPane = {
      host,
      title,
      disposed: false,
      bindings,
      addBinding(def, initialValue, onChange, options = {}) {
        handlers.set(def.key, onChange);
        const binding: MockBinding = {
          value: initialValue,
          refreshes: 0,
          disposed: false,
          options,
          setValue(v) {
            binding.value = v;
            binding.refreshes += 1;
          },
          dispose() {
            binding.disposed = true;
          },
        };
        bindings.set(def.key, binding);
        return binding;
      },
      triggerChange(key, value) {
        const h = handlers.get(key);
        if (h) h(value);
      },
      dispose() {
        pane.disposed = true;
      },
    };
    last = pane;
    return pane;
  };
  return {
    factory,
    lastPane: () => {
      if (!last) throw new Error('no pane created yet');
      return last;
    },
  };
}

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data: Record<string, string> = { ...seed };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    key: (i) => Object.keys(data)[i] ?? null,
  };
}

const PARAMS: readonly SketchParam[] = [
  { key: 'angle', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01 },
  { key: 'enabled', type: 'boolean', default: true },
  { key: 'palette', type: 'string', default: 'mono' },
];

describe('ParamPanel', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('creates one binding per param using defaults when storage is empty', () => {
    const m = createMockFactory();
    new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage: memoryStorage(),
      paneFactory: m.factory,
    });
    const pane = m.lastPane();
    expect(pane.bindings.size).toBe(3);
    expect(pane.bindings.get('angle')!.value).toBe(0.5);
    expect(pane.bindings.get('enabled')!.value).toBe(true);
    expect(pane.bindings.get('palette')!.value).toBe('mono');
  });

  it('forwards min/max/step/label as binding options', () => {
    const params: readonly SketchParam[] = [
      {
        key: 'angle',
        type: 'number',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Contact angle',
      },
    ];
    const m = createMockFactory();
    new ParamPanel({
      host,
      sketchId: 'sk',
      params,
      onChange: () => {},
      storage: memoryStorage(),
      paneFactory: m.factory,
    });
    const opts = m.lastPane().bindings.get('angle')!.options;
    expect(opts).toMatchObject({ min: 0, max: 1, step: 0.01, label: 'Contact angle' });
  });

  it('restores values from storage on construction', () => {
    const storage = memoryStorage({
      'igx:params:sk': JSON.stringify({ angle: 0.75, palette: 'gilded' }),
    });
    const m = createMockFactory();
    new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage,
      paneFactory: m.factory,
    });
    const pane = m.lastPane();
    expect(pane.bindings.get('angle')!.value).toBe(0.75);
    expect(pane.bindings.get('palette')!.value).toBe('gilded');
    // Untouched key keeps its default.
    expect(pane.bindings.get('enabled')!.value).toBe(true);
  });

  it('emits onChange for each restored value differing from default', () => {
    const storage = memoryStorage({
      'igx:params:sk': JSON.stringify({ angle: 0.75, enabled: true }),
    });
    const m = createMockFactory();
    const seen: [string, SketchParamValue][] = [];
    new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: (k, v) => seen.push([k, v]),
      storage,
      paneFactory: m.factory,
    });
    // angle differs from default, enabled equals default, palette absent.
    expect(seen).toEqual([['angle', 0.75]]);
  });

  it('persists UI changes back to storage and forwards them to onChange', () => {
    const storage = memoryStorage();
    const m = createMockFactory();
    const seen: [string, SketchParamValue][] = [];
    new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: (k, v) => seen.push([k, v]),
      storage,
      paneFactory: m.factory,
    });
    m.lastPane().triggerChange('angle', 0.42);
    expect(seen).toEqual([['angle', 0.42]]);
    expect(JSON.parse(storage.getItem('igx:params:sk')!)).toEqual({
      angle: 0.42,
    });
    m.lastPane().triggerChange('palette', 'neon');
    expect(JSON.parse(storage.getItem('igx:params:sk')!)).toEqual({
      angle: 0.42,
      palette: 'neon',
    });
  });

  it('reset restores defaults, clears storage, refreshes bindings, and notifies', () => {
    const storage = memoryStorage({
      'igx:params:sk': JSON.stringify({ angle: 0.99, palette: 'neon' }),
    });
    const m = createMockFactory();
    const seen: [string, SketchParamValue][] = [];
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: (k, v) => seen.push([k, v]),
      storage,
      paneFactory: m.factory,
    });
    seen.length = 0; // clear notifications from initial restore
    panel.reset();
    const pane = m.lastPane();
    expect(pane.bindings.get('angle')!.value).toBe(0.5);
    expect(pane.bindings.get('palette')!.value).toBe('mono');
    expect(storage.getItem('igx:params:sk')).toBeNull();
    expect(seen).toEqual([
      ['angle', 0.5],
      ['palette', 'mono'],
    ]);
  });

  it('values() reflects the current state', () => {
    const storage = memoryStorage();
    const m = createMockFactory();
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage,
      paneFactory: m.factory,
    });
    expect(panel.values()).toEqual({ angle: 0.5, enabled: true, palette: 'mono' });
    m.lastPane().triggerChange('angle', 0.8);
    expect(panel.values().angle).toBe(0.8);
  });

  it('falls back to defaults when storage contains malformed JSON', () => {
    const storage = memoryStorage({ 'igx:params:sk': 'not-json' });
    const m = createMockFactory();
    const seen: [string, SketchParamValue][] = [];
    new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: (k, v) => seen.push([k, v]),
      storage,
      paneFactory: m.factory,
    });
    const pane = m.lastPane();
    expect(pane.bindings.get('angle')!.value).toBe(0.5);
    expect(seen).toEqual([]);
  });

  it('dispose tears down the pane', () => {
    const m = createMockFactory();
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage: memoryStorage(),
      paneFactory: m.factory,
    });
    panel.dispose();
    expect(m.lastPane().disposed).toBe(true);
  });

  it('survives without storage (storage: null)', () => {
    const m = createMockFactory();
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage: null,
      paneFactory: m.factory,
    });
    // No throw, and reset() also no-ops on storage.
    panel.reset();
    expect(panel.values()).toEqual({ angle: 0.5, enabled: true, palette: 'mono' });
  });

  it('setValue updates the binding, persists, and notifies onChange', () => {
    const storage = memoryStorage();
    const m = createMockFactory();
    const seen: [string, SketchParamValue][] = [];
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: (k, v) => seen.push([k, v]),
      storage,
      paneFactory: m.factory,
    });
    panel.setValue('angle', 0.33);
    expect(panel.values().angle).toBe(0.33);
    expect(seen).toEqual([['angle', 0.33]]);
    expect(JSON.parse(storage.getItem('igx:params:sk')!)).toEqual({ angle: 0.33 });
    expect(m.lastPane().bindings.get('angle')!.value).toBe(0.33);
  });

  it('setValue rejects unknown keys', () => {
    const m = createMockFactory();
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage: memoryStorage(),
      paneFactory: m.factory,
    });
    expect(() => panel.setValue('mystery', 1)).toThrow();
  });

  it('default Tweakpane factory mounts a pane into the host', () => {
    const panel = new ParamPanel({
      host,
      sketchId: 'sk',
      params: PARAMS,
      onChange: () => {},
      storage: memoryStorage(),
      // no paneFactory → real Tweakpane
    });
    expect(host.children.length).toBeGreaterThan(0);
    panel.dispose();
  });
});
