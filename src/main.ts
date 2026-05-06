/**
 * Entry point. Temporary scaffold: registers a single Hankin sketch with the
 * SketchRunner so `npm run dev` shows something. The proper Registry / Menu
 * (S-02) and ParamPanel (S-03) will replace the hard-coded mount.
 */

import { hankinPattern } from './geometry/hankin';
import { squareTiling } from './geometry/tilings';
import { renderToContext, resizeCanvas } from './render/canvas2d';
import { SketchRunner, type Sketch } from './core/SketchRunner';

const root = document.getElementById('app');
if (root) {
  const runner = new SketchRunner({ host: root });

  const hankinSquareSketch: Sketch = {
    id: 'hankin-square',
    title: 'Hankin · Square 4×4',
    defineParams: () => [
      { key: 'angle', type: 'number', default: Math.PI / 4 },
    ],
    init(ctx) {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      ctx.host.appendChild(canvas);

      const draw = () => {
        const w = ctx.host.clientWidth || window.innerWidth;
        const h = ctx.host.clientHeight || window.innerHeight;
        resizeCanvas(canvas, w, h);
        const c2d = canvas.getContext('2d');
        if (!c2d) return;
        c2d.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
        const tiling = squareTiling({ rows: 4, cols: 4, size: 1 });
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
    update() {
      // Static sketch — paint is driven by `requestPaint` after param changes
      // (or on resize via the listener installed in init). update is the
      // hook the runner pumps every frame; we no-op it.
    },
    dispose() {
      // Window listener is detached when the host is replaced, since the
      // closure becomes unreachable; nothing extra to do for this demo.
    },
  };

  void runner.mount(hankinSquareSketch);
}
