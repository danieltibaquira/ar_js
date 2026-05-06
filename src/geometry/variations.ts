/**
 * Pattern variations & helpers built on top of the Hankin core.
 *
 * Two named contracts (per tracker §G-05):
 *   - `strapToRibbon`: expand a 1D strap segment into a 4-vertex rectangular
 *     polygon offset by `width / 2` on each side.
 *   - `rosetteHull`: convex hull of strap endpoints near a polygon centre,
 *     used as a quick rosette fingerprint.
 *
 * `convexHull` is exported so external callers can hull arbitrary point sets
 * without going through `rosetteHull` (and so it can be unit-tested directly).
 */

import type { Pattern, Point, Polygon, StrapSegment } from './types';
import { distance, pointsEqual } from './primitives';

const ZERO_LEN_TOL = 1e-12;

/**
 * Expand a strap segment into a rectangular ribbon of constant width.
 * Vertices are emitted CCW starting at `p1 + (width/2)·N` and walking around
 * the rectangle, where N is the left-hand normal of the segment direction.
 *
 * Throws `RangeError` for zero-length segments or non-positive widths.
 */
export function strapToRibbon(segment: StrapSegment, width: number): Polygon {
  if (!(width > 0)) {
    throw new RangeError(`strapToRibbon: width must be > 0, got ${width}`);
  }
  const { p1, p2 } = segment;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < ZERO_LEN_TOL) {
    throw new RangeError('strapToRibbon: segment endpoints coincide');
  }
  const ux = dx / len;
  const uy = dy / len;
  const h = width / 2;
  // Left-hand normal of (ux, uy) is (-uy, ux). Walk the rectangle CCW:
  // start at the right-hand offset of p1, run along the segment to p2's
  // right-hand offset, then back along the left-hand offsets.
  const nx = -uy;
  const ny = ux;
  return {
    vertices: [
      { x: p1.x - h * nx, y: p1.y - h * ny },
      { x: p2.x - h * nx, y: p2.y - h * ny },
      { x: p2.x + h * nx, y: p2.y + h * ny },
      { x: p1.x + h * nx, y: p1.y + h * ny },
    ],
  };
}

/**
 * Andrew's monotone-chain convex hull.
 * Returns a CCW polygon, or null when the input has fewer than 3 unique
 * points. Collinear interior points on a hull edge are dropped.
 */
export function convexHull(points: readonly Point[]): Polygon | null {
  const unique: Point[] = [];
  for (const p of points) {
    if (!unique.some((q) => pointsEqual(p, q))) unique.push(p);
  }
  if (unique.length < 3) return null;

  const sorted = unique.slice().sort((a, b) => a.x - b.x || a.y - b.y);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Drop the duplicated first/last points where the chains join.
  lower.pop();
  upper.pop();
  const vertices = lower.concat(upper);
  if (vertices.length < 3) return null;
  return { vertices };
}

/**
 * Convex hull of every strap endpoint within `radius` of `center`.
 * Returns null when the radius captures fewer than 3 unique endpoints (the
 * minimum needed to form a polygon).
 */
export function rosetteHull(
  pattern: Pattern,
  center: Point,
  radius: number,
): Polygon | null {
  if (!(radius > 0)) {
    throw new RangeError(`rosetteHull: radius must be > 0, got ${radius}`);
  }
  const captured: Point[] = [];
  for (const seg of pattern.strapSegments) {
    if (distance(seg.p1, center) <= radius) captured.push(seg.p1);
    if (distance(seg.p2, center) <= radius) captured.push(seg.p2);
  }
  return convexHull(captured);
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
