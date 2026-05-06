/**
 * SketchRunner — drives a single sketch at a time.
 *
 * Every sketch implements `init / update? / dispose / defineParams?`. The
 * runner owns the lifecycle: it mounts, schedules `update` against rAF,
 * tears the sketch down on switch, and respects `prefers-reduced-motion`
 * by suppressing the rAF loop while the media query matches.
 *
 * `rAF` and `MediaQueryList` are dependency-injected so tests can drive
 * frames manually and toggle the motion preference without touching real DOM
 * timers.
 */

export type SketchParamValue = number | boolean | string;

export interface SketchParam {
  readonly key: string;
  readonly type: 'number' | 'boolean' | 'string';
  readonly default: SketchParamValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly label?: string;
}

export interface SketchContext {
  readonly host: HTMLElement;
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly params: Readonly<Record<string, SketchParamValue>>;
  setParam(key: string, value: SketchParamValue): void;
}

export interface Sketch {
  readonly id: string;
  readonly title?: string;
  defineParams?(): readonly SketchParam[];
  init(ctx: SketchContext): void | Promise<void>;
  update?(ctx: SketchContext, dtMs: number): void;
  dispose(): void;
}

export interface SketchRunnerOptions {
  readonly host: HTMLElement;
  /**
   * Injectable for testing. Defaults to
   * `window.matchMedia('(prefers-reduced-motion: reduce)')`.
   */
  readonly mediaQueryList?: MediaQueryList;
  readonly raf?: (cb: FrameRequestCallback) => number;
  readonly cancelRaf?: (id: number) => void;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export class SketchRunner {
  private readonly host: HTMLElement;
  private readonly raf: (cb: FrameRequestCallback) => number;
  private readonly cancelRaf: (id: number) => void;
  private readonly mql: MediaQueryList;
  private readonly mqlListener: (ev: MediaQueryListEvent) => void;
  private current: Sketch | null = null;
  private params: Record<string, SketchParamValue> = {};
  private rafId: number | null = null;
  private lastFrameMs: number | null = null;
  private generation = 0;
  private disposed = false;

  constructor(options: SketchRunnerOptions) {
    if (!options || !options.host) {
      throw new TypeError('SketchRunner: host element is required');
    }
    this.host = options.host;
    this.raf =
      options.raf ?? ((cb) => globalThis.requestAnimationFrame(cb));
    this.cancelRaf =
      options.cancelRaf ?? ((id) => globalThis.cancelAnimationFrame(id));
    this.mql =
      options.mediaQueryList ??
      (typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(REDUCED_MOTION_QUERY)
        : ({
            matches: false,
            media: REDUCED_MOTION_QUERY,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
            onchange: null,
          } as unknown as MediaQueryList));
    this.mqlListener = (ev: MediaQueryListEvent) => {
      if (!this.current || this.disposed) return;
      if (ev.matches) {
        this.stopLoop();
      } else {
        this.startLoop();
      }
    };
    this.mql.addEventListener('change', this.mqlListener);
  }

  async mount(sketch: Sketch): Promise<void> {
    if (this.disposed) {
      throw new Error('SketchRunner: cannot mount after dispose');
    }
    if (this.current) this.unmount();

    const params: Record<string, SketchParamValue> = {};
    if (sketch.defineParams) {
      for (const def of sketch.defineParams()) {
        params[def.key] = def.default;
      }
    }
    this.params = params;
    this.current = sketch;
    this.generation += 1;
    const myGen = this.generation;

    const ctx = this.makeContext();
    await sketch.init(ctx);

    // Bail if the runner moved on (or shut down) during async init.
    if (this.generation !== myGen || this.current !== sketch || this.disposed) {
      return;
    }

    if (!this.mql.matches) this.startLoop();
  }

  unmount(): void {
    this.stopLoop();
    const sketch = this.current;
    this.current = null;
    this.params = {};
    this.lastFrameMs = null;
    if (sketch) sketch.dispose();
    this.host.replaceChildren();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unmount();
    this.mql.removeEventListener('change', this.mqlListener);
  }

  setParam(key: string, value: SketchParamValue): void {
    this.params[key] = value;
  }

  getParams(): Readonly<Record<string, SketchParamValue>> {
    return this.params;
  }

  /**
   * Force a single `update` tick outside the rAF loop. Use under reduced
   * motion to repaint after a parameter change.
   */
  requestPaint(): void {
    if (!this.current || !this.current.update || this.disposed) return;
    this.current.update(this.makeContext(), 0);
  }

  private startLoop(): void {
    if (this.rafId !== null || !this.current || this.disposed) return;
    if (!this.current.update) return;
    this.rafId = this.raf(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      this.cancelRaf(this.rafId);
      this.rafId = null;
    }
    this.lastFrameMs = null;
  }

  private tick = (timestampMs: number): void => {
    this.rafId = null;
    if (!this.current || this.disposed) return;
    const dt = this.lastFrameMs === null ? 0 : timestampMs - this.lastFrameMs;
    this.lastFrameMs = timestampMs;
    this.current.update?.(this.makeContext(), dt);
    if (!this.mql.matches && this.current && !this.disposed) {
      this.rafId = this.raf(this.tick);
    }
  };

  private makeContext(): SketchContext {
    const dpr =
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1;
    const rect =
      typeof this.host.getBoundingClientRect === 'function'
        ? this.host.getBoundingClientRect()
        : { width: 0, height: 0 };
    return {
      host: this.host,
      width: rect.width || this.host.clientWidth || 0,
      height: rect.height || this.host.clientHeight || 0,
      devicePixelRatio: dpr,
      params: this.params,
      setParam: (k, v) => this.setParam(k, v),
    };
  }
}
