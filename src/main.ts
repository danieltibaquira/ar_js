/**
 * Entry point. Registers the Hankin demo sketches with the SketchRegistry,
 * wires a Menu to the registry, and routes selections through the
 * SketchRunner. The proper ParamPanel (S-03) and hash routing (S-04) will
 * layer on top of this.
 */

import { hankinPattern } from './geometry/hankin';
import { hexagonalTiling, squareTiling } from './geometry/tilings';
import { renderToContext, resizeCanvas } from './render/canvas2d';
import { SketchRunner, type Sketch } from './core/SketchRunner';
import { SketchRegistry } from './core/Registry';
import { Menu } from './ui/Menu';
import type { Tiling } from './geometry/types';

function makeHankinSketch(
  id: string,
  title: string,
  buildTiling: () => Tiling,
): Sketch {
  return {
    id,
    title,
    defineParams: () => [{ key: 'angle', type: 'number', default: Math.PI / 4 }],
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
        const pattern = hankinPattern(tiling, { contactAngle: angle });
        renderToContext(c2d, w, h, pattern, {
          strapWidth: 4,
          strapColor: '#eeeeee',
          background: '#0b0b0d',
          showConstructionLines: true,
        });
      };

      draw();
      window.addEventListener('resize', draw);
    },
    update() {},
    dispose() {},
  };
}

const root = document.getElementById('app');
if (root) {
  const menuHost = document.createElement('div');
  const stage = document.createElement('div');
  stage.className = 'stage';
  root.replaceChildren(menuHost, stage);

  const registry = new SketchRegistry();
  const runner = new SketchRunner({ host: stage });

  registry.register(
    makeHankinSquareSketch(),
  );
  registry.register(
    makeHankinHexSketch(),
  );

  const menu = new Menu({
    host: menuHost,
    registry,
    onSelect: (id) => switchTo(id),
  });

  function switchTo(id: string): void {
    const entry = registry.get(id);
    if (!entry) return;
    void runner.mount(entry.sketch);
    menu.setActive(id);
  }

  // Boot with the first registered sketch.
  const first = registry.list()[0];
  if (first) switchTo(first.id);
}

function makeHankinSquareSketch(): Sketch {
  return makeHankinSketch('hankin-square', 'Hankin · Square 4×4', () =>
    squareTiling({ rows: 4, cols: 4, size: 1 }),
  );
}

function makeHankinHexSketch(): Sketch {
  return makeHankinSketch('hankin-hex', 'Hankin · Hex 4×4', () =>
    hexagonalTiling({ rows: 4, cols: 4, size: 1 }),
  );
}
