import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Scene3D, type RendererLike } from '../../../src/core/three/Scene';

interface CallLog {
  readonly method: string;
  readonly args: readonly unknown[];
}

interface StubRenderer extends RendererLike {
  calls: CallLog[];
  pixelRatio: number;
  size: { width: number; height: number };
  disposed: boolean;
}

function createStubRenderer(): StubRenderer {
  const dom = document.createElement('canvas');
  const stub: StubRenderer = {
    domElement: dom,
    calls: [],
    pixelRatio: 1,
    size: { width: 0, height: 0 },
    disposed: false,
    setSize(width, height, _updateStyle) {
      stub.size = { width, height };
      stub.calls.push({ method: 'setSize', args: [width, height, _updateStyle] });
    },
    setPixelRatio(value) {
      stub.pixelRatio = value;
      stub.calls.push({ method: 'setPixelRatio', args: [value] });
    },
    render(scene, camera) {
      stub.calls.push({ method: 'render', args: [scene, camera] });
    },
    dispose() {
      stub.disposed = true;
      stub.calls.push({ method: 'dispose', args: [] });
    },
  };
  return stub;
}

interface FakeRAF {
  raf(cb: FrameRequestCallback): number;
  cancel(id: number): void;
  pending: number;
  run(times?: number): void;
}

function createFakeRAF(): FakeRAF {
  const queue: { id: number; cb: FrameRequestCallback }[] = [];
  let next = 1;
  let now = 0;
  return {
    get pending() {
      return queue.length;
    },
    raf(cb) {
      const id = next++;
      queue.push({ id, cb });
      return id;
    },
    cancel(id) {
      const idx = queue.findIndex((q) => q.id === id);
      if (idx >= 0) queue.splice(idx, 1);
    },
    run(times = 1) {
      for (let i = 0; i < times; i++) {
        const next2 = queue.shift();
        if (!next2) return;
        now += 16;
        next2.cb(now);
      }
    },
  };
}

describe('Scene3D', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(host);
  });

  it('mounts the renderer canvas under the host', () => {
    const renderer = createStubRenderer();
    new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: () => 0,
      cancelRaf: () => {},
      devicePixelRatio: 2,
    });
    expect(host.contains(renderer.domElement)).toBe(true);
  });

  it('sets initial size and pixel ratio on construction', () => {
    const renderer = createStubRenderer();
    new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: () => 0,
      cancelRaf: () => {},
      devicePixelRatio: 2,
    });
    expect(renderer.size).toEqual({ width: 800, height: 600 });
    expect(renderer.pixelRatio).toBe(2);
  });

  it('exposes a perspective camera with aspect derived from the host size', () => {
    const renderer = createStubRenderer();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: () => 0,
      cancelRaf: () => {},
      devicePixelRatio: 1,
    });
    expect(scene.perspectiveCamera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(scene.perspectiveCamera.aspect).toBeCloseTo(800 / 600, 6);
  });

  it('updates camera + renderer on resize, including pixel-ratio change', () => {
    const renderer = createStubRenderer();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: () => 0,
      cancelRaf: () => {},
      devicePixelRatio: 1,
    });
    scene.resize(1024, 512, 3);
    expect(renderer.size).toEqual({ width: 1024, height: 512 });
    expect(renderer.pixelRatio).toBe(3);
    expect(scene.perspectiveCamera.aspect).toBeCloseTo(1024 / 512, 6);
    // Orthographic frustum reflects the new aspect.
    const orth = scene.orthographicCamera;
    expect(orth.right - orth.left).toBeGreaterThan(0);
    expect(orth.right / -orth.left).toBeCloseTo(1, 6);
  });

  it('does not render until invalidate() is called', () => {
    const renderer = createStubRenderer();
    const fake = createFakeRAF();
    new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
      devicePixelRatio: 1,
    });
    expect(fake.pending).toBe(0);
    fake.run(5);
    expect(renderer.calls.filter((c) => c.method === 'render').length).toBe(0);
  });

  it('invalidate() schedules a single render; coalesces extra calls', () => {
    const renderer = createStubRenderer();
    const fake = createFakeRAF();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
      devicePixelRatio: 1,
    });
    scene.invalidate();
    scene.invalidate();
    scene.invalidate();
    expect(fake.pending).toBe(1);
    fake.run(1);
    expect(renderer.calls.filter((c) => c.method === 'render').length).toBe(1);
    // After the single render, no further frames are queued.
    expect(fake.pending).toBe(0);
  });

  it('continuous rendering loops every frame until disabled', () => {
    const renderer = createStubRenderer();
    const fake = createFakeRAF();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
      devicePixelRatio: 1,
    });
    scene.setContinuousRendering(true);
    fake.run(3);
    expect(renderer.calls.filter((c) => c.method === 'render').length).toBe(3);
    scene.setContinuousRendering(false);
    // Drain whatever is still pending; nothing further should queue.
    fake.run(5);
    expect(renderer.calls.filter((c) => c.method === 'render').length).toBeLessThanOrEqual(4);
  });

  it('setCamera switches the active camera used for rendering', () => {
    const renderer = createStubRenderer();
    const fake = createFakeRAF();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
      devicePixelRatio: 1,
    });
    scene.invalidate();
    fake.run(1);
    let last = renderer.calls.filter((c) => c.method === 'render').slice(-1)[0]!;
    expect(last.args[1]).toBe(scene.perspectiveCamera);

    scene.setCamera('orthographic');
    fake.run(1);
    last = renderer.calls.filter((c) => c.method === 'render').slice(-1)[0]!;
    expect(last.args[1]).toBe(scene.orthographicCamera);
  });

  it('dispose tears down the renderer, cancels rAF, and removes the canvas', () => {
    const renderer = createStubRenderer();
    const fake = createFakeRAF();
    const scene = new Scene3D({
      host,
      rendererFactory: () => renderer,
      raf: fake.raf.bind(fake),
      cancelRaf: fake.cancel.bind(fake),
      devicePixelRatio: 1,
    });
    scene.invalidate();
    expect(fake.pending).toBe(1);
    scene.dispose();
    expect(fake.pending).toBe(0);
    expect(renderer.disposed).toBe(true);
    expect(host.contains(renderer.domElement)).toBe(false);
    // Subsequent invalidate is a no-op.
    scene.invalidate();
    expect(fake.pending).toBe(0);
  });
});
