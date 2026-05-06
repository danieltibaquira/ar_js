/**
 * Entry point. Temporary scaffold: while the sketch registry (S-02) is not
 * yet built, we render a single Hankin pattern so `npm run dev` shows
 * something. The renderer (R-01) is the v1.0 critical-path foundation; the
 * proper SketchRunner / Menu / ParamPanel will replace this wiring.
 */

import { hankinPattern } from './geometry/hankin';
import { squareTiling } from './geometry/tilings';
import { renderToContext, resizeCanvas } from './render/canvas2d';

const root = document.getElementById('app');
if (root) {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  root.replaceChildren(canvas);

  const tiling = squareTiling({ rows: 4, cols: 4, size: 1 });
  const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });

  const draw = () => {
    const cssWidth = root.clientWidth || window.innerWidth;
    const cssHeight = root.clientHeight || window.innerHeight;
    resizeCanvas(canvas, cssWidth, cssHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Drive drawing in CSS-pixel space; the backing store is dpr× larger.
    const dpr = canvas.width / cssWidth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderToContext(ctx, cssWidth, cssHeight, pattern, {
      strapWidth: 4,
      strapColor: '#eeeeee',
      background: '#0b0b0d',
      showConstructionLines: true,
    });
  };

  draw();
  window.addEventListener('resize', draw);
}
