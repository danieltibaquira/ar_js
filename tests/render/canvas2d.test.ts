import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  renderCanvas2D,
  renderToContext,
  resizeCanvas,
} from '../../src/render/canvas2d';
import { hankinPattern } from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';
import type { Pattern } from '../../src/geometry/types';

interface CallLog {
  readonly method: string;
  readonly args: readonly unknown[];
}

interface MockContext extends CanvasRenderingContext2D {
  calls: CallLog[];
  props: Record<string, unknown>;
}

function createMockContext(): MockContext {
  const calls: CallLog[] = [];
  const props: Record<string, unknown> = {
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  };
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'calls') return calls;
      if (prop === 'props') return props;
      if (prop in props) return props[prop];
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
      };
    },
    set(_t, prop: string, value: unknown) {
      props[prop] = value;
      return true;
    },
  };
  return new Proxy({}, handler) as MockContext;
}

function strokePathCount(ctx: MockContext): number {
  return ctx.calls.filter((c) => c.method === 'stroke').length;
}

function moveToCount(ctx: MockContext): number {
  return ctx.calls.filter((c) => c.method === 'moveTo').length;
}

describe('renderToContext', () => {
  it('issues no draw calls for an empty pattern', () => {
    const ctx = createMockContext();
    renderToContext(ctx, 100, 100, { strapSegments: [] });
    expect(strokePathCount(ctx)).toBe(0);
    expect(moveToCount(ctx)).toBe(0);
  });

  it('strokes one path per strap segment', () => {
    const ctx = createMockContext();
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } },
      ],
    };
    renderToContext(ctx, 100, 100, pattern);
    expect(moveToCount(ctx)).toBe(2);
    expect(ctx.calls.filter((c) => c.method === 'lineTo').length).toBe(2);
    expect(strokePathCount(ctx)).toBeGreaterThanOrEqual(1);
  });

  it('respects strapColor and strapWidth', () => {
    const ctx = createMockContext();
    const pattern: Pattern = {
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    };
    renderToContext(ctx, 100, 100, pattern, {
      strapColor: '#abcdef',
      strapWidth: 6.5,
    });
    expect(ctx.props.strokeStyle).toBe('#abcdef');
    expect(ctx.props.lineWidth).toBe(6.5);
  });

  it('fills the background when configured', () => {
    const ctx = createMockContext();
    renderToContext(ctx, 200, 100, { strapSegments: [] }, { background: '#111' });
    const fillRects = ctx.calls.filter((c) => c.method === 'fillRect');
    expect(fillRects.length).toBe(1);
    expect(fillRects[0]!.args).toEqual([0, 0, 200, 100]);
    expect(ctx.props.fillStyle).toBe('#111');
  });

  it('draws construction lines when enabled and a sourceTiling is present', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const ctx = createMockContext();
    renderToContext(ctx, 200, 200, pattern, { showConstructionLines: true });
    // 4 polygons * 4 edges of construction overlay = at least 16 moveTo calls
    // for the overlay alone, plus one per strap segment.
    expect(moveToCount(ctx)).toBeGreaterThanOrEqual(
      16 + pattern.strapSegments.length,
    );
  });

  it('skips construction overlay when showConstructionLines is false', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const ctx = createMockContext();
    renderToContext(ctx, 200, 200, pattern);
    expect(moveToCount(ctx)).toBe(pattern.strapSegments.length);
  });

  it('clears the canvas before drawing', () => {
    const ctx = createMockContext();
    renderToContext(ctx, 320, 240, { strapSegments: [] });
    const clears = ctx.calls.filter((c) => c.method === 'clearRect');
    expect(clears.length).toBe(1);
    expect(clears[0]!.args).toEqual([0, 0, 320, 240]);
  });
});

describe('resizeCanvas', () => {
  let originalDPR: number;

  beforeEach(() => {
    originalDPR = (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'devicePixelRatio', {
      value: originalDPR,
      configurable: true,
    });
  });

  it('scales backing store by devicePixelRatio', () => {
    Object.defineProperty(globalThis, 'devicePixelRatio', {
      value: 2,
      configurable: true,
    });
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 400, 300);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('300px');
  });

  it('honours an explicit dpr override', () => {
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 200, 100, 3);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(300);
  });

  it('falls back to dpr=1 when devicePixelRatio is missing', () => {
    Object.defineProperty(globalThis, 'devicePixelRatio', {
      value: undefined,
      configurable: true,
    });
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 150, 150);
    expect(canvas.width).toBe(150);
    expect(canvas.height).toBe(150);
  });

  it('rejects non-positive dimensions', () => {
    const canvas = document.createElement('canvas');
    expect(() => resizeCanvas(canvas, 0, 100)).toThrow();
    expect(() => resizeCanvas(canvas, 100, -1)).toThrow();
  });
});

describe('renderCanvas2D (canvas convenience)', () => {
  it('throws when the canvas has no 2d context', () => {
    const canvas = {
      width: 100,
      height: 100,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => renderCanvas2D(canvas, { strapSegments: [] })).toThrow();
  });

  it('uses canvas pixel dimensions when CSS size is unset', () => {
    const ctx = createMockContext();
    const canvas = {
      width: 320,
      height: 240,
      style: {},
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    renderCanvas2D(canvas, { strapSegments: [] }, { background: '#0b0b0d' });
    const fillRects = ctx.calls.filter((c) => c.method === 'fillRect');
    expect(fillRects[0]!.args).toEqual([0, 0, 320, 240]);
  });
});

describe('renderToContext perf', () => {
  it('renders a 2×2 Hankin pattern at 800×800 in under 16 ms', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const ctx = createMockContext();
    const t0 = performance.now();
    renderToContext(ctx, 800, 800, pattern, { strapWidth: 4, strapColor: '#fff' });
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(16);
  });
});
