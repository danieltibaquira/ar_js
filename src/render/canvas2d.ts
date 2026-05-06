/**
 * Canvas 2D rasterizer for Hankin patterns.
 *
 * Two entry points:
 *   - `renderToContext(ctx, cssWidth, cssHeight, pattern, opts?)`
 *     Pure draw routine; takes a CanvasRenderingContext2D and treats the
 *     supplied dimensions as the CSS-space drawing surface. Use this when you
 *     are managing the canvas + DPR transform yourself, e.g. in tests with a
 *     mock context.
 *   - `renderCanvas2D(canvas, pattern, opts?)`
 *     Convenience wrapper that grabs the 2D context from an HTMLCanvasElement
 *     and uses its current pixel dimensions as the drawing surface.
 *
 * `resizeCanvas(canvas, cssW, cssH, dpr?)` is the DPR-aware sizing helper.
 * Call it before render so the device-pixel backing store matches CSS size.
 */

import type { Pattern, Polygon, Tiling } from '../geometry/types';

export interface Canvas2DRenderOptions {
  readonly strapWidth?: number;
  readonly strapColor?: string;
  readonly background?: string | null;
  readonly lineCap?: CanvasLineCap;
  readonly lineJoin?: CanvasLineJoin;
  readonly showConstructionLines?: boolean;
  readonly constructionLineColor?: string;
  readonly constructionLineWidth?: number;
  readonly padding?: number;
}

const DEFAULTS = {
  strapWidth: 4,
  strapColor: '#eeeeee',
  background: null as string | null,
  lineCap: 'round' as CanvasLineCap,
  lineJoin: 'round' as CanvasLineJoin,
  showConstructionLines: false,
  constructionLineColor: 'rgba(255, 255, 255, 0.18)',
  constructionLineWidth: 1,
  padding: 16,
};

export function renderToContext(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  pattern: Pattern,
  options: Canvas2DRenderOptions = {},
): void {
  const opts = { ...DEFAULTS, ...options };

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (opts.background !== null) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  if (pattern.strapSegments.length === 0 && !opts.showConstructionLines) return;

  const bounds = computeBounds(pattern);
  if (bounds === null) return;

  const { scale, tx, ty } = fitTransform(bounds, cssWidth, cssHeight, opts.padding);

  if (opts.showConstructionLines && pattern.sourceTiling) {
    drawConstructionLines(ctx, pattern.sourceTiling, scale, tx, ty, opts);
  }

  ctx.strokeStyle = opts.strapColor;
  ctx.lineWidth = opts.strapWidth;
  ctx.lineCap = opts.lineCap;
  ctx.lineJoin = opts.lineJoin;
  ctx.beginPath();
  for (const seg of pattern.strapSegments) {
    ctx.moveTo(seg.p1.x * scale + tx, seg.p1.y * scale + ty);
    ctx.lineTo(seg.p2.x * scale + tx, seg.p2.y * scale + ty);
  }
  ctx.stroke();
}

export function renderCanvas2D(
  canvas: HTMLCanvasElement,
  pattern: Pattern,
  options: Canvas2DRenderOptions = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('renderCanvas2D: 2D context not available on canvas');
  }
  renderToContext(ctx, canvas.width, canvas.height, pattern, options);
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio?: number,
): void {
  if (!(cssWidth > 0) || !(cssHeight > 0)) {
    throw new RangeError(
      `resizeCanvas: dimensions must be > 0, got ${cssWidth}×${cssHeight}`,
    );
  }
  const dpr =
    devicePixelRatio ??
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio ??
    1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function computeBounds(
  pattern: Pattern,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (pattern.sourceTiling) {
    const b = pattern.sourceTiling.bounds;
    if (b.maxX > b.minX && b.maxY > b.minY) return { ...b };
  }
  if (pattern.strapSegments.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const seg of pattern.strapSegments) {
    if (seg.p1.x < minX) minX = seg.p1.x;
    if (seg.p1.y < minY) minY = seg.p1.y;
    if (seg.p1.x > maxX) maxX = seg.p1.x;
    if (seg.p1.y > maxY) maxY = seg.p1.y;
    if (seg.p2.x < minX) minX = seg.p2.x;
    if (seg.p2.y < minY) minY = seg.p2.y;
    if (seg.p2.x > maxX) maxX = seg.p2.x;
    if (seg.p2.y > maxY) maxY = seg.p2.y;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function fitTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  cssWidth: number,
  cssHeight: number,
  padding: number,
): { scale: number; tx: number; ty: number } {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const availW = Math.max(1, cssWidth - 2 * padding);
  const availH = Math.max(1, cssHeight - 2 * padding);
  const scaleX = w > 0 ? availW / w : Infinity;
  const scaleY = h > 0 ? availH / h : Infinity;
  const scale = Number.isFinite(Math.min(scaleX, scaleY))
    ? Math.min(scaleX, scaleY)
    : 1;
  const tx = (cssWidth - w * scale) / 2 - bounds.minX * scale;
  const ty = (cssHeight - h * scale) / 2 - bounds.minY * scale;
  return { scale, tx, ty };
}

function drawConstructionLines(
  ctx: CanvasRenderingContext2D,
  tiling: Tiling,
  scale: number,
  tx: number,
  ty: number,
  opts: typeof DEFAULTS,
): void {
  ctx.strokeStyle = opts.constructionLineColor;
  ctx.lineWidth = opts.constructionLineWidth;
  ctx.lineCap = opts.lineCap;
  ctx.lineJoin = opts.lineJoin;
  ctx.beginPath();
  for (const polygon of tiling.polygons) {
    tracePolygon(ctx, polygon, scale, tx, ty);
  }
  ctx.stroke();
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Polygon,
  scale: number,
  tx: number,
  ty: number,
): void {
  const verts = polygon.vertices;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    ctx.moveTo(v.x * scale + tx, v.y * scale + ty);
    ctx.lineTo(next.x * scale + tx, next.y * scale + ty);
  }
}
