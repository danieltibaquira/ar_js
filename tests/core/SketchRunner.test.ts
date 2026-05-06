import { describe, expect, it, beforeEach } from 'vitest';
import {
  SketchRunner,
  type Sketch,
  type SketchContext,
} from '../../src/core/SketchRunner';

interface TrackedSketch extends Sketch {
  initCalls: number;
  updateCalls: number;
  disposeCalls: number;
  lastCtx?: SketchContext;
}

function makeSketch(id: string, overrides: Partial<Sketch> = {}): TrackedSketch {
  const tracker: TrackedSketch = {
    id,
    initCalls: 0,
    updateCalls: 0,
    disposeCalls: 0,
    init(ctx) {
      tracker.initCalls += 1;
      tracker.lastCtx = ctx;
      // Mount a node so we can verify dispose tears it down.
      const div = document.createElement('div');
      div.dataset['sketchId'] = id;
      ctx.host.appendChild(div);
    },
    update() {
      tracker.updateCalls += 1;
    },
    dispose() {
      tracker.disposeCalls += 1;
    },
    ...overrides,
  };
  return tracker;
}

type FakeMQL = MediaQueryList & { matches: boolean };

function makeMQL(matches = false): FakeMQL {
  const target = new EventTarget() as MediaQueryList;
  Object.assign(target, {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  });
  return target as FakeMQL;
}

interface FakeRAF {
  run(times: number): void;
  pending: number;
  cancelled: number[];
  raf(cb: FrameRequestCallback): number;
  cancel(id: number): void;
}

function makeFakeRAF(): FakeRAF {
  const queue: { id: number; cb: FrameRequestCallback }[] = [];
  let next = 1;
  const cancelled: number[] = [];
  let now = 0;
  return {
    get pending() {
      return queue.length;
    },
    cancelled,
    raf(cb: FrameRequestCallback) {
      const id = next++;
      queue.push({ id, cb });
      return id;
    },
    cancel(id: number) {
      cancelled.push(id);
      const idx = queue.findIndex((q) => q.id === id);
      if (idx >= 0) queue.splice(idx, 1);
    },
    run(times: number) {
      for (let i = 0; i < times; i++) {
        const next2 = queue.shift();
        if (!next2) return;
        now += 16;
        next2.cb(now);
      }
    },
  };
}

describe('SketchRunner', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement('div');
    host.style.width = '400px';
    host.style.height = '300px';
    document.body.appendChild(host);
  });

  it('mounts a sketch and calls init exactly once', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch = makeSketch('a');
    await runner.mount(sketch);
    expect(sketch.initCalls).toBe(1);
    expect(sketch.lastCtx?.host).toBe(host);
    expect(host.children.length).toBe(1);
    runner.dispose();
  });

  it('passes defineParams defaults into the context', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    let captured: SketchContext | undefined;
    const sketch: Sketch = {
      id: 'p',
      defineParams() {
        return [
          { key: 'angle', type: 'number', default: 0.5 },
          { key: 'enabled', type: 'boolean', default: true },
        ];
      },
      init(ctx) {
        captured = ctx;
      },
      dispose() {},
    };
    await runner.mount(sketch);
    expect(captured?.params).toEqual({ angle: 0.5, enabled: true });
    runner.dispose();
  });

  it('drives the update loop while motion is allowed', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch = makeSketch('a');
    await runner.mount(sketch);
    fake.run(3);
    expect(sketch.updateCalls).toBe(3);
    runner.dispose();
  });

  it('does not start the loop when prefers-reduced-motion matches', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(true),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch = makeSketch('a');
    await runner.mount(sketch);
    expect(fake.pending).toBe(0);
    fake.run(5);
    expect(sketch.updateCalls).toBe(0);
    runner.dispose();
  });

  it('renders a single static frame on mount under reduced motion when paint is requested', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(true),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch = makeSketch('a');
    await runner.mount(sketch);
    runner.requestPaint();
    expect(sketch.updateCalls).toBe(1);
    fake.run(5);
    // Still no continuous loop, only the explicit paint.
    expect(sketch.updateCalls).toBe(1);
    runner.dispose();
  });

  it('switching sketches disposes the previous one and clears the host', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const a = makeSketch('a');
    const b = makeSketch('b');
    await runner.mount(a);
    await runner.mount(b);
    expect(a.disposeCalls).toBe(1);
    expect(b.initCalls).toBe(1);
    // Only b's node remains.
    expect(host.children.length).toBe(1);
    expect((host.firstElementChild as HTMLElement).dataset['sketchId']).toBe('b');
    runner.dispose();
  });

  it('survives 50 mount/unmount cycles without leaking children or stranded rAFs', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketches = Array.from({ length: 50 }, (_, i) => makeSketch(`s-${i}`));
    for (const s of sketches) {
      await runner.mount(s);
      fake.run(2);
      runner.unmount();
      expect(host.children.length).toBe(0);
      expect(s.disposeCalls).toBe(1);
    }
    expect(fake.pending).toBe(0);
    runner.dispose();
  });

  it('setParam updates the snapshot before the next update', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const captured: unknown[] = [];
    const sketch: Sketch = {
      id: 'p',
      defineParams() {
        return [{ key: 'angle', type: 'number', default: 0.1 }];
      },
      init() {},
      update(ctx) {
        captured.push(ctx.params['angle']);
      },
      dispose() {},
    };
    await runner.mount(sketch);
    fake.run(1);
    runner.setParam('angle', 0.9);
    fake.run(1);
    expect(captured).toEqual([0.1, 0.9]);
    runner.dispose();
  });

  it('dispose unmounts the current sketch and prevents future mounts', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const a = makeSketch('a');
    await runner.mount(a);
    runner.dispose();
    expect(a.disposeCalls).toBe(1);
    await expect(runner.mount(makeSketch('b'))).rejects.toThrow();
  });

  it('reacts to prefers-reduced-motion changing at runtime (resume the loop)', async () => {
    const mql = makeMQL(true);
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: mql,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch = makeSketch('a');
    await runner.mount(sketch);
    expect(fake.pending).toBe(0);
    // User switches off reduced-motion mid-session.
    mql.matches = false;
    mql.dispatchEvent(new Event('change'));
    expect(fake.pending).toBe(1);
    fake.run(2);
    expect(sketch.updateCalls).toBe(2);
    runner.dispose();
  });

  it('exposes the params snapshot via getParams', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    const sketch: Sketch = {
      id: 'p',
      defineParams() {
        return [{ key: 'angle', type: 'number', default: 0.25 }];
      },
      init() {},
      dispose() {},
    };
    await runner.mount(sketch);
    expect(runner.getParams()).toEqual({ angle: 0.25 });
    runner.setParam('angle', 0.75);
    expect(runner.getParams()).toEqual({ angle: 0.75 });
    runner.dispose();
  });

  it('discards a pending mount if a newer mount supersedes it', async () => {
    const fake = makeFakeRAF();
    const runner = new SketchRunner({
      host,
      mediaQueryList: makeMQL(false),
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
    });
    let releaseSlow!: () => void;
    const slow: TrackedSketch = makeSketch('slow', {
      init: () =>
        new Promise<void>((resolve) => {
          releaseSlow = resolve;
        }),
    });
    const fast = makeSketch('fast');
    const slowMount = runner.mount(slow);
    await runner.mount(fast);
    // Now release the slow init — its post-init body must bail.
    releaseSlow();
    await slowMount;
    expect(host.children.length).toBe(1);
    expect((host.firstElementChild as HTMLElement).dataset['sketchId']).toBe(
      'fast',
    );
    runner.dispose();
  });

  it('throws when mount is invoked before construction completes (sanity check)', () => {
    expect(
      () =>
        new SketchRunner({
          // @ts-expect-error – host is required
          host: null,
          mediaQueryList: makeMQL(false),
        }),
    ).toThrow();
  });
});
