/**
 * Hankin / Polygons-In-Contact pattern construction.
 *
 * For every edge `e` of the tiling we emit one strap ray per host polygon,
 * starting at `midpoint(e)` and leaving the edge at `±contactAngle` measured
 * from the edge tangent. The sign is chosen so the ray points into the host
 * polygon. Inside each polygon, every ray is then either (a) clipped at the
 * closest intersection with another ray in the same polygon, or (b) clipped at
 * the polygon boundary when no opposing ray is hit first.
 *
 * Interior edges (two hosts) therefore yield two rays — one per half-plane,
 * mirror images across the edge. Boundary edges (one host) yield a single
 * inward ray; the corresponding outward ray would escape the tiling and is
 * dropped.
 */

import type { ContactAngle, Pattern, Point, Polygon, StrapSegment, Tiling } from './types';

export interface HankinOptions {
  readonly contactAngle: ContactAngle;
  /**
   * If true, rays that exit a polygon without hitting another ray are clipped
   * at the polygon edge. Defaults to true.
   */
  readonly clipToPolygons?: boolean;
}

interface Ray {
  readonly origin: Point;
  readonly exit: Point;
}

const PARALLEL_TOL = 1e-12;
const BOUNDARY_TOL = 1e-9;

/**
 * Compute the intersection point of two line segments, or null when they do
 * not intersect within their finite extents (open intervals at both ends).
 * Tolerance applied to parallel-line detection.
 */
export function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  tolerance: number = PARALLEL_TOL,
): Point | null {
  const dx = a2.x - a1.x;
  const dy = a2.y - a1.y;
  const ex = b2.x - b1.x;
  const ey = b2.y - b1.y;
  const det = ex * dy - dx * ey;
  if (Math.abs(det) < tolerance) return null;
  const wx = b1.x - a1.x;
  const wy = b1.y - a1.y;
  const t = (ex * wy - ey * wx) / det;
  const s = (dx * wy - dy * wx) / det;
  if (t <= 0 || t >= 1 || s <= 0 || s >= 1) return null;
  return { x: a1.x + t * dx, y: a1.y + t * dy };
}

/**
 * Given a starting ray (origin + direction) and a convex polygon, return the
 * exit point where the ray meets the polygon boundary, or null if the ray
 * never exits (origin outside).
 */
export function rayExitPoint(
  origin: Point,
  direction: Point,
  polygon: Polygon,
): Point | null {
  const verts = polygon.vertices;
  const n = verts.length;
  if (n < 3) return null;

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const v1 = verts[i]!;
    const v2 = verts[(i + 1) % n]!;
    signedArea += v1.x * v2.y - v2.x * v1.y;
  }
  const ccw = signedArea > 0;

  for (let i = 0; i < n; i++) {
    const v1 = verts[i]!;
    const v2 = verts[(i + 1) % n]!;
    const cross = (v2.x - v1.x) * (origin.y - v1.y) - (v2.y - v1.y) * (origin.x - v1.x);
    if (ccw ? cross < -BOUNDARY_TOL : cross > BOUNDARY_TOL) {
      return null;
    }
  }

  let bestT = Infinity;
  let bestPoint: Point | null = null;
  for (let i = 0; i < n; i++) {
    const v1 = verts[i]!;
    const v2 = verts[(i + 1) % n]!;
    const ex = v2.x - v1.x;
    const ey = v2.y - v1.y;
    const det = ex * direction.y - direction.x * ey;
    if (Math.abs(det) < PARALLEL_TOL) continue;
    const wx = v1.x - origin.x;
    const wy = v1.y - origin.y;
    const t = (ex * wy - ey * wx) / det;
    const s = (direction.x * wy - direction.y * wx) / det;
    if (t > BOUNDARY_TOL && s >= -BOUNDARY_TOL && s <= 1 + BOUNDARY_TOL && t < bestT) {
      bestT = t;
      bestPoint = { x: origin.x + t * direction.x, y: origin.y + t * direction.y };
    }
  }
  return bestPoint;
}

/**
 * Build the Hankin pattern for a tiling at a given contact angle.
 */
export function hankinPattern(tiling: Tiling, options: HankinOptions): Pattern {
  const { contactAngle, clipToPolygons = true } = options;
  const cosA = Math.cos(contactAngle);
  const sinA = Math.sin(contactAngle);
  const polygons = tiling.polygons;

  const rayBuckets: Ray[][] = polygons.map(() => []);

  for (const edge of tiling.edges) {
    const tx0 = edge.p2.x - edge.p1.x;
    const ty0 = edge.p2.y - edge.p1.y;
    const len = Math.sqrt(tx0 * tx0 + ty0 * ty0);
    if (len < PARALLEL_TOL) continue;
    const tx = tx0 / len;
    const ty = ty0 / len;
    const m = edge.midpoint;
    // d_plus = rotate(T, +angle); d_minus = rotate(T, -angle).
    // Edge normal N = (-ty, tx); d_plus·N = +sin(angle), d_minus·N = -sin(angle).
    const dpx = tx * cosA - ty * sinA;
    const dpy = tx * sinA + ty * cosA;
    const dmx = tx * cosA + ty * sinA;
    const dmy = -tx * sinA + ty * cosA;

    for (const pid of edge.polygonIds) {
      const poly = polygons[pid];
      if (!poly) continue;
      const c = polygonCentroid(poly);
      // Side of the edge the polygon's centroid lies on, projected onto N.
      const sideNormal = (c.x - m.x) * -ty + (c.y - m.y) * tx;
      const useDPlus = sideNormal >= 0;
      const dir = useDPlus ? { x: dpx, y: dpy } : { x: dmx, y: dmy };
      const exit = rayExitPoint(m, dir, poly);
      if (exit === null) continue;
      rayBuckets[pid]!.push({ origin: m, exit });
    }
  }

  const segments: StrapSegment[] = [];
  for (const rays of rayBuckets) {
    for (let i = 0; i < rays.length; i++) {
      const r = rays[i]!;
      let bestPoint = r.exit;
      let bestDistSq = sqDist(r.origin, r.exit);
      let intersected = false;
      for (let j = 0; j < rays.length; j++) {
        if (j === i) continue;
        const r2 = rays[j]!;
        const inter = segmentIntersection(r.origin, r.exit, r2.origin, r2.exit);
        if (inter === null) continue;
        const dsq = sqDist(r.origin, inter);
        if (dsq < bestDistSq) {
          bestDistSq = dsq;
          bestPoint = inter;
          intersected = true;
        }
      }
      if (intersected || clipToPolygons) {
        segments.push({ p1: r.origin, p2: bestPoint });
      }
    }
  }

  segments.sort(compareSegments);
  return { strapSegments: segments, sourceTiling: tiling };
}

function polygonCentroid(polygon: Polygon): Point {
  let sx = 0;
  let sy = 0;
  const n = polygon.vertices.length;
  for (const v of polygon.vertices) {
    sx += v.x;
    sy += v.y;
  }
  return { x: sx / n, y: sy / n };
}

function sqDist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

function compareSegments(a: StrapSegment, b: StrapSegment): number {
  return (
    a.p1.x - b.p1.x ||
    a.p1.y - b.p1.y ||
    a.p2.x - b.p2.x ||
    a.p2.y - b.p2.y
  );
}

export type { StrapSegment };
