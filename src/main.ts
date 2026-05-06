/**
 * Entry point. Registers the Hankin demo sketches with the SketchRegistry,
 * wires a Menu to the registry, and routes selections through the
 * SketchRunner. Each sketch's parameters are exposed live via ParamPanel
 * (Tweakpane), persisted per-sketch in localStorage.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { hankinPattern } from './geometry/hankin';
import { hexagonalTiling, squareTiling } from './geometry/tilings';
import { truncatedSquareTiling } from './geometry/archimedean';
import { renderToContext, resizeCanvas } from './render/canvas2d';
import { extrudeStrapwork } from './core/three/extrude';
import { Scene3D } from './core/three/Scene';
import { createHankinShaderMaterial, type HankinShaderResult } from './materials/HankinShaderMaterial';
import { createGraffitiMaterial, type GraffitiResult } from './materials/GraffitiMaterial';
import { SketchRunner, type Sketch, type SketchParam, type SketchParamValue } from './core/SketchRunner';
import { SketchRegistry } from './core/Registry';
import { HashRouter } from './core/HashRouter';
import { Menu } from './ui/Menu';
import { ParamPanel } from './ui/ParamPanel';
import type { Tiling } from './geometry/types';

function makeHankinSketch(
  id: string,
  title: string,
  buildTiling: () => Tiling,
): Sketch {
  return {
    id,
    title,
    defineParams: () => [
      {
        key: 'angle',
        type: 'number',
        default: Math.PI / 4,
        min: Math.PI / 12,
        max: (5 * Math.PI) / 12,
        step: 0.005,
        label: 'Contact angle',
      },
      {
        key: 'strapWidth',
        type: 'number',
        default: 4,
        min: 1,
        max: 16,
        step: 0.5,
        label: 'Strap width',
      },
      {
        key: 'showConstruction',
        type: 'boolean',
        default: true,
        label: 'Construction lines',
      },
    ],
    init(ctx) {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      ctx.host.appendChild(canvas);
      const tiling = buildTiling();

      const draw = () => {
        const w = ctx.host.clientWidth || window.innerWidth;
        const h = ctx.host.clientHeight || window.innerHeight;
        if (w === 0 || h === 0) return;
        resizeCanvas(canvas, w, h);
        const c2d = canvas.getContext('2d');
        if (!c2d) return;
        c2d.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
        const angle = ctx.params['angle'] as number;
        const strapWidth = ctx.params['strapWidth'] as number;
        const showConstructionLines = ctx.params['showConstruction'] as boolean;
        const pattern = hankinPattern(tiling, { contactAngle: angle });
        renderToContext(c2d, w, h, pattern, {
          strapWidth,
          strapColor: '#eeeeee',
          background: '#0b0b0d',
          showConstructionLines,
        });
      };

      draw();
      const onResize = () => draw();
      window.addEventListener('resize', onResize);

      // Repaint whenever a parameter changes. The runner pumps update()
      // every frame anyway, but wiring `update` to redraw keeps the hook
      // explicit and lets the static-frame paint under reduced motion work.
      (ctx as { __redraw?: () => void }).__redraw = draw;
    },
    update(ctx) {
      const fn = (ctx as { __redraw?: () => void }).__redraw;
      fn?.();
    },
    dispose() {
      // Window listener becomes unreachable when the closure is dropped via
      // host.replaceChildren in the runner; nothing extra to do here.
    },
  };
}

interface Strapwork3DState {
  readonly scene: Scene3D;
  readonly controls: OrbitControls;
  readonly material: THREE.Material;
  readonly group: THREE.Group;
  readonly tiling: Tiling;
  readonly onResize: () => void;
  readonly onControlsChange: () => void;
  rebuild(): void;
  lastKey: string;
}

function makeStrapwork3DSketch(
  id: string,
  title: string,
  buildTiling: () => Tiling,
): Sketch {
  let state: Strapwork3DState | null = null;

  return {
    id,
    title,
    defineParams: () => [
      {
        key: 'angle',
        type: 'number',
        default: Math.PI / 4,
        min: Math.PI / 12,
        max: (5 * Math.PI) / 12,
        step: 0.005,
        label: 'Contact angle',
      },
      {
        key: 'depth',
        type: 'number',
        default: 0.15,
        min: 0.02,
        max: 0.6,
        step: 0.01,
        label: 'Extrusion depth',
      },
      {
        key: 'strapWidth',
        type: 'number',
        default: 0.12,
        min: 0.02,
        max: 0.4,
        step: 0.01,
        label: 'Strap width',
      },
    ],
    init(ctx) {
      const scene = new Scene3D({ host: ctx.host });
      scene.perspectiveCamera.position.set(3, 4, 6);
      scene.perspectiveCamera.lookAt(0, 0, 0);
      // A second softer fill from the opposite side so the gold reads.
      const fill = new THREE.DirectionalLight(0xffd9a3, 0.35);
      fill.position.set(-4, 2, -3);
      scene.scene.add(fill);

      const material = new THREE.MeshStandardMaterial({
        color: 0xc6a85c,
        metalness: 0.55,
        roughness: 0.4,
      });
      const group = new THREE.Group();
      scene.scene.add(group);
      const tiling = buildTiling();

      const controls = new OrbitControls(
        scene.perspectiveCamera,
        scene.renderer.domElement,
      );
      controls.target.set(0, 0, 0);
      controls.update();
      const onControlsChange = () => scene.invalidate();
      controls.addEventListener('change', onControlsChange);

      const onResize = () => {
        scene.resize();
      };
      window.addEventListener('resize', onResize);

      const rebuild = (): void => {
        const angle = ctx.params['angle'] as number;
        const depth = ctx.params['depth'] as number;
        const strapWidth = ctx.params['strapWidth'] as number;
        const pattern = hankinPattern(tiling, { contactAngle: angle });
        const geometries = extrudeStrapwork(pattern, { strapWidth, depth });
        for (const child of group.children) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
        }
        group.clear();
        for (const geom of geometries) {
          group.add(new THREE.Mesh(geom, material));
        }
        // Centre the strapwork at the origin so the camera framing is stable
        // regardless of tiling extent or extrusion depth.
        const bbox = new THREE.Box3().setFromObject(group);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        group.position.set(-center.x, -center.y, -center.z);
        scene.invalidate();
      };

      rebuild();

      state = {
        scene,
        controls,
        material,
        group,
        tiling,
        onResize,
        onControlsChange,
        rebuild,
        lastKey: paramKey3D(ctx),
      };
    },
    update(ctx) {
      if (!state) return;
      const key = paramKey3D(ctx);
      if (key !== state.lastKey) {
        state.rebuild();
        state.lastKey = key;
      }
    },
    dispose() {
      if (!state) return;
      window.removeEventListener('resize', state.onResize);
      state.controls.removeEventListener('change', state.onControlsChange);
      state.controls.dispose();
      for (const child of state.group.children) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
      }
      state.group.clear();
      state.material.dispose();
      state.scene.dispose();
      state = null;
    },
  };
}

function paramKey3D(ctx: {
  params: Readonly<Record<string, SketchParamValue>>;
}): string {
  return `${ctx.params['angle']}|${ctx.params['depth']}|${ctx.params['strapWidth']}`;
}

interface PatternSurfaceState {
  readonly scene: Scene3D;
  readonly tiling: Tiling;
  readonly shader: HankinShaderResult;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly controls: OrbitControls;
  readonly onResize: () => void;
  readonly onControlsChange: () => void;
  lastAngle: number;
  lastStrap: number;
  lastAa: number;
}

function makePatternSurfaceSketch(
  id: string,
  title: string,
  buildTiling: () => Tiling,
): Sketch {
  let state: PatternSurfaceState | null = null;

  return {
    id,
    title,
    defineParams: () => [
      {
        key: 'angle',
        type: 'number',
        default: Math.PI / 4,
        min: Math.PI / 12,
        max: (5 * Math.PI) / 12,
        step: 0.005,
        label: 'Contact angle',
      },
      {
        key: 'strapWidth',
        type: 'number',
        default: 0.06,
        min: 0.005,
        max: 0.25,
        step: 0.005,
        label: 'Strap width',
      },
      {
        key: 'aaWidth',
        type: 'number',
        default: 0.005,
        min: 0.001,
        max: 0.05,
        step: 0.001,
        label: 'AA width',
      },
    ],
    init(ctx) {
      const scene = new Scene3D({ host: ctx.host });
      scene.perspectiveCamera.position.set(0, 0, 4);
      scene.perspectiveCamera.lookAt(0, 0, 0);

      const tiling = buildTiling();
      const initialAngle = ctx.params['angle'] as number;
      const initialStrap = ctx.params['strapWidth'] as number;
      const initialAa = ctx.params['aaWidth'] as number;
      const pattern = hankinPattern(tiling, { contactAngle: initialAngle });
      const shader = createHankinShaderMaterial(pattern, {
        strapWidth: initialStrap,
        aaWidth: initialAa,
      });

      // Plane sized to the pattern's aspect ratio, centred on the origin.
      const w = tiling.bounds.maxX - tiling.bounds.minX;
      const h = tiling.bounds.maxY - tiling.bounds.minY;
      const fitTo = 3;
      const scale = Math.min(fitTo / w, fitTo / h);
      const planeWidth = w * scale;
      const planeHeight = h * scale;
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const mesh = new THREE.Mesh(geometry, shader.material);
      scene.scene.add(mesh);

      const controls = new OrbitControls(
        scene.perspectiveCamera,
        scene.renderer.domElement,
      );
      controls.target.set(0, 0, 0);
      controls.update();
      const onControlsChange = () => scene.invalidate();
      controls.addEventListener('change', onControlsChange);

      const onResize = () => scene.resize();
      window.addEventListener('resize', onResize);

      scene.invalidate();

      state = {
        scene,
        tiling,
        shader,
        mesh,
        geometry,
        controls,
        onResize,
        onControlsChange,
        lastAngle: initialAngle,
        lastStrap: initialStrap,
        lastAa: initialAa,
      };
    },
    update(ctx) {
      if (!state) return;
      const angle = ctx.params['angle'] as number;
      const sw = ctx.params['strapWidth'] as number;
      const aa = ctx.params['aaWidth'] as number;
      let dirty = false;
      if (angle !== state.lastAngle) {
        const newPattern = hankinPattern(state.tiling, { contactAngle: angle });
        state.shader.setPattern(newPattern);
        state.lastAngle = angle;
        dirty = true;
      }
      if (sw !== state.lastStrap) {
        state.shader.setStrapWidth(sw);
        state.lastStrap = sw;
        dirty = true;
      }
      if (aa !== state.lastAa) {
        state.shader.setAaWidth(aa);
        state.lastAa = aa;
        dirty = true;
      }
      if (dirty) state.scene.invalidate();
    },
    dispose() {
      if (!state) return;
      window.removeEventListener('resize', state.onResize);
      state.controls.removeEventListener('change', state.onControlsChange);
      state.controls.dispose();
      state.geometry.dispose();
      state.shader.dispose();
      state.scene.dispose();
      state = null;
    },
  };
}

interface GraffitiSketchState {
  readonly scene: Scene3D;
  readonly tiling: Tiling;
  readonly material: GraffitiResult;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly controls: OrbitControls;
  readonly onResize: () => void;
  readonly onControlsChange: () => void;
  lastAngle: number;
  lastStrap: number;
  lastBleed: number;
  lastDrip: number;
  lastFade: number;
}

function makeGraffitiWallSketch(
  id: string,
  title: string,
  buildTiling: () => Tiling,
): Sketch {
  let state: GraffitiSketchState | null = null;

  return {
    id,
    title,
    defineParams: () => [
      {
        key: 'angle',
        type: 'number',
        default: Math.PI / 4,
        min: Math.PI / 12,
        max: (5 * Math.PI) / 12,
        step: 0.005,
        label: 'Contact angle',
      },
      {
        key: 'strapWidth',
        type: 'number',
        default: 0.06,
        min: 0.005,
        max: 0.25,
        step: 0.005,
        label: 'Strap width',
      },
      {
        key: 'bleed',
        type: 'number',
        default: 0.012,
        min: 0,
        max: 0.05,
        step: 0.001,
        label: 'Bleed',
      },
      {
        key: 'drip',
        type: 'number',
        default: 0.25,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Drip',
      },
      {
        key: 'fade',
        type: 'number',
        default: 0.95,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Fade',
      },
    ],
    init(ctx) {
      const scene = new Scene3D({ host: ctx.host });
      scene.perspectiveCamera.position.set(0, 0, 4);
      scene.perspectiveCamera.lookAt(0, 0, 0);

      const tiling = buildTiling();
      const angle = ctx.params['angle'] as number;
      const strapWidth = ctx.params['strapWidth'] as number;
      const bleed = ctx.params['bleed'] as number;
      const drip = ctx.params['drip'] as number;
      const fade = ctx.params['fade'] as number;
      const pattern = hankinPattern(tiling, { contactAngle: angle });
      const material = createGraffitiMaterial(pattern, {
        strapWidth,
        bleed,
        drip,
        fade,
      });

      const w = tiling.bounds.maxX - tiling.bounds.minX;
      const h = tiling.bounds.maxY - tiling.bounds.minY;
      const fitTo = 3;
      const scale = Math.min(fitTo / w, fitTo / h);
      const geometry = new THREE.PlaneGeometry(w * scale, h * scale);
      const mesh = new THREE.Mesh(geometry, material.material);
      scene.scene.add(mesh);

      const controls = new OrbitControls(
        scene.perspectiveCamera,
        scene.renderer.domElement,
      );
      controls.target.set(0, 0, 0);
      controls.update();
      const onControlsChange = () => scene.invalidate();
      controls.addEventListener('change', onControlsChange);

      const onResize = () => scene.resize();
      window.addEventListener('resize', onResize);

      scene.invalidate();

      state = {
        scene,
        tiling,
        material,
        mesh,
        geometry,
        controls,
        onResize,
        onControlsChange,
        lastAngle: angle,
        lastStrap: strapWidth,
        lastBleed: bleed,
        lastDrip: drip,
        lastFade: fade,
      };
    },
    update(ctx) {
      if (!state) return;
      const angle = ctx.params['angle'] as number;
      const sw = ctx.params['strapWidth'] as number;
      const bl = ctx.params['bleed'] as number;
      const dr = ctx.params['drip'] as number;
      const fd = ctx.params['fade'] as number;
      let dirty = false;
      if (angle !== state.lastAngle) {
        state.material.setPattern(
          hankinPattern(state.tiling, { contactAngle: angle }),
        );
        state.lastAngle = angle;
        dirty = true;
      }
      if (sw !== state.lastStrap) {
        state.material.setStrapWidth(sw);
        state.lastStrap = sw;
        dirty = true;
      }
      if (bl !== state.lastBleed) {
        state.material.setBleed(bl);
        state.lastBleed = bl;
        dirty = true;
      }
      if (dr !== state.lastDrip) {
        state.material.setDrip(dr);
        state.lastDrip = dr;
        dirty = true;
      }
      if (fd !== state.lastFade) {
        state.material.setFade(fd);
        state.lastFade = fd;
        dirty = true;
      }
      if (dirty) state.scene.invalidate();
    },
    dispose() {
      if (!state) return;
      window.removeEventListener('resize', state.onResize);
      state.controls.removeEventListener('change', state.onControlsChange);
      state.controls.dispose();
      state.geometry.dispose();
      state.material.dispose();
      state.scene.dispose();
      state = null;
    },
  };
}

const root = document.getElementById('app');
if (root) {
  const menuHost = document.createElement('div');
  const stage = document.createElement('div');
  stage.className = 'stage';
  const panelHost = document.createElement('div');
  panelHost.className = 'param-panel-host';
  root.replaceChildren(menuHost, stage, panelHost);

  const registry = new SketchRegistry();
  const runner = new SketchRunner({ host: stage });

  registry.register(
    makeHankinSketch('hankin-square', 'Hankin · Square 4×4', () =>
      squareTiling({ rows: 4, cols: 4, size: 1 }),
    ),
  );
  registry.register(
    makeHankinSketch('hankin-hex', 'Hankin · Hex 4×4', () =>
      hexagonalTiling({ rows: 4, cols: 4, size: 1 }),
    ),
  );
  registry.register(
    makeHankinSketch('hankin-488', 'Hankin · 4.8.8', () =>
      truncatedSquareTiling({ rows: 3, cols: 3, size: 1 }),
    ),
  );
  registry.register(
    makeStrapwork3DSketch('strapwork-3d', 'Strapwork · 3D', () =>
      squareTiling({ rows: 3, cols: 3, size: 1 }),
    ),
  );
  registry.register(
    makePatternSurfaceSketch('pattern-surface', 'Pattern · Surface (shader)', () =>
      squareTiling({ rows: 4, cols: 4, size: 1 }),
    ),
  );
  registry.register(
    makeGraffitiWallSketch('graffiti-wall', 'Graffiti · Wall', () =>
      squareTiling({ rows: 4, cols: 4, size: 1 }),
    ),
  );

  let panel: ParamPanel | null = null;
  let activeId: string | null = null;
  const menu = new Menu({
    host: menuHost,
    registry,
    onSelect: (id) => {
      void switchTo(id, {}, true);
    },
  });

  const router = new HashRouter({
    onRoute: (route) => {
      const targetId =
        route.sketchId && registry.get(route.sketchId)
          ? route.sketchId
          : registry.list()[0]?.id ?? null;
      if (!targetId) return;
      void switchTo(targetId, route.params, false);
    },
  });

  async function switchTo(
    id: string,
    urlParams: Readonly<Record<string, string>>,
    pushToUrl: boolean,
  ): Promise<void> {
    const entry = registry.get(id);
    if (!entry) return;
    if (activeId === id && panel) {
      // Same sketch — just nudge params.
      applyUrlParams(panel, entry.sketch, urlParams);
      runner.requestPaint();
      if (pushToUrl) router.setRoute(id, panel.values());
      return;
    }
    await runner.mount(entry.sketch);
    activeId = id;
    menu.setActive(id);
    panel?.dispose();
    const params = entry.sketch.defineParams?.() ?? [];
    panel = new ParamPanel({
      host: panelHost,
      sketchId: entry.sketch.id,
      params,
      onChange: (key, value) => {
        runner.setParam(key, value);
        runner.requestPaint();
        if (panel) router.setRoute(id, panel.values());
      },
    });
    // Apply URL params on top of any localStorage-restored values.
    applyUrlParams(panel, entry.sketch, urlParams);
    for (const [key, value] of Object.entries(panel.values())) {
      runner.setParam(key, value);
    }
    runner.requestPaint();
    if (pushToUrl) router.setRoute(id, panel.values());
  }

  function applyUrlParams(
    p: ParamPanel,
    sketch: Sketch,
    urlParams: Readonly<Record<string, string>>,
  ): void {
    const defs = sketch.defineParams?.() ?? [];
    const byKey = new Map(defs.map((d) => [d.key, d]));
    for (const [key, raw] of Object.entries(urlParams)) {
      const def = byKey.get(key);
      if (!def) continue;
      const value = coerce(raw, def);
      if (value !== null) p.setValue(key, value);
    }
  }

  function coerce(raw: string, def: SketchParam): SketchParamValue | null {
    switch (def.type) {
      case 'number': {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      case 'boolean':
        return raw === 'true' || raw === '1';
      case 'string':
        return raw;
    }
  }
}
