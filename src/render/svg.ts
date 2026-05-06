/**
 * SVG export for Hankin patterns. Pure string output — no DOM access.
 *
 * Output is a single `<svg>` document. Strap segments combine into one
 * `<path>` inside a `<g class="straps">` group; an optional construction-line
 * group sits behind it. Coordinates are formatted with a configurable
 * fixed precision (default 4) so the same input always produces the same
 * string — that is what satisfies the snapshot-stability acceptance.
 */

import type { Pattern, Polygon, Tiling } from '../geometry/types';

export interface SVGRenderOptions {
  readonly width: number;
  readonly height: number;
  readonly padding?: number;
  readonly strapWidth?: number;
  readonly strapColor?: string;
  readonly background?: string | null;
  readonly showConstructionLines?: boolean;
  readonly constructionLineColor?: string;
  readonly constructionLineWidth?: number;
  /** Fractional digits in coordinates. Defaults to 4. */
  readonly precision?: number;
}

const DEFAULTS = {
  padding: 16,
  strapWidth: 4,
  strapColor: '#eeeeee',
  background: null as string | null,
  showConstructionLines: false,
  constructionLineColor: 'rgba(255,255,255,0.18)',
  constructionLineWidth: 1,
  precision: 4,
};

export function renderToSVG(
  pattern: Pattern,
  options: SVGRenderOptions,
): string {
  if (!(options.width > 0) || !(options.height > 0)) {
    throw new RangeError(
      `renderToSVG: dimensions must be > 0, got ${options.width}×${options.height}`,
    );
  }
  const opts = { ...DEFAULTS, ...options };
  const { width, height, padding, precision } = opts;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  );

  if (opts.background !== null) {
    parts.push(
      `<rect width="${width}" height="${height}" fill="${escapeAttr(opts.background)}"/>`,
    );
  }

  const bounds = computeBounds(pattern);
  const transform =
    bounds === null
      ? null
      : fitTransform(bounds, width, height, padding);

  if (transform && opts.showConstructionLines && pattern.sourceTiling) {
    parts.push(constructionGroup(pattern.sourceTiling, transform, opts));
  }
  if (transform && pattern.strapSegments.length > 0) {
    parts.push(strapsGroup(pattern, transform, opts));
  }

  parts.push('</svg>');
  return parts.join('');

  function constructionGroup(
    tiling: Tiling,
    t: FitTransform,
    o: typeof DEFAULTS,
  ): string {
    const segs: string[] = [];
    for (const polygon of tiling.polygons) {
      segs.push(polygonToPath(polygon, t, precision));
    }
    return (
      `<g class="construction" fill="none" stroke="${escapeAttr(o.constructionLineColor)}" stroke-width="${o.constructionLineWidth}">` +
      `<path d="${segs.join(' ')}"/>` +
      `</g>`
    );
  }

  function strapsGroup(
    p: Pattern,
    t: FitTransform,
    o: typeof DEFAULTS,
  ): string {
    const out: string[] = [];
    for (const seg of p.strapSegments) {
      const x1 = fmt(seg.p1.x * t.scale + t.tx, precision);
      const y1 = fmt(seg.p1.y * t.scale + t.ty, precision);
      const x2 = fmt(seg.p2.x * t.scale + t.tx, precision);
      const y2 = fmt(seg.p2.y * t.scale + t.ty, precision);
      out.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    }
    return (
      `<g class="straps" fill="none" stroke="${escapeAttr(o.strapColor)}" stroke-width="${o.strapWidth}" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${out.join(' ')}"/>` +
      `</g>`
    );
  }
}

interface FitTransform {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

function polygonToPath(
  polygon: Polygon,
  t: FitTransform,
  precision: number,
): string {
  const verts = polygon.vertices;
  const parts: string[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    const x1 = fmt(v.x * t.scale + t.tx, precision);
    const y1 = fmt(v.y * t.scale + t.ty, precision);
    const x2 = fmt(next.x * t.scale + t.tx, precision);
    const y2 = fmt(next.y * t.scale + t.ty, precision);
    parts.push(`M ${x1} ${y1} L ${x2} ${y2}`);
  }
  return parts.join(' ');
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
  width: number,
  height: number,
  padding: number,
): FitTransform {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const availW = Math.max(1, width - 2 * padding);
  const availH = Math.max(1, height - 2 * padding);
  const scaleX = w > 0 ? availW / w : Infinity;
  const scaleY = h > 0 ? availH / h : Infinity;
  const scale = Number.isFinite(Math.min(scaleX, scaleY))
    ? Math.min(scaleX, scaleY)
    : 1;
  const tx = (width - w * scale) / 2 - bounds.minX * scale;
  const ty = (height - h * scale) / 2 - bounds.minY * scale;
  return { scale, tx, ty };
}

function fmt(value: number, precision: number): string {
  // Stable, locale-independent fixed-point. Strip trailing zeros for size.
  const fixed = value.toFixed(precision);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
