/**
 * Entry point. Registers the Hankin demo sketches with the SketchRegistry,
 * wires a Menu to the registry, and routes selections through the
 * SketchRunner. Each sketch's parameters are exposed live via ParamPanel
 * (Tweakpane), persisted per-sketch in localStorage.
 */

import { hankinPattern } from './geometry/hankin';
import { hexagonalTiling, squareTiling } from './geometry/tilings';
import { renderToContext, resizeCanvas } from './render/canvas2d';
import { SketchRunner, type Sketch } from './core/SketchRunner';
import { SketchRegistry } from './core/Registry';
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

  let panel: ParamPanel | null = null;
  const menu = new Menu({
    host: menuHost,
    registry,
    onSelect: (id) => {
      void switchTo(id);
    },
  });

  async function switchTo(id: string): Promise<void> {
    const entry = registry.get(id);
    if (!entry) return;
    await runner.mount(entry.sketch);
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
      },
    });
    // Seed runner state with whatever the panel restored.
    for (const [key, value] of Object.entries(panel.values())) {
      runner.setParam(key, value);
    }
    runner.requestPaint();
  }

  const first = registry.list()[0];
  if (first) void switchTo(first.id);
}
