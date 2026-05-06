/**
 * Pure geometric primitives. No dependencies on three.js or DOM.
 * Tests in tests/geometry/primitives.test.ts.
 */

import type { Point, Polygon, Edge, RegularPolygonOptions } from './types';

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Midpoint of a segment. */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Returns true when two points are equal within `tolerance` (default 1e-9). */
export function pointsEqual(a: Point, b: Point, tolerance = 1e-9): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

/**
 * Build a regular n-gon.
 * Vertex 0 sits at angle `rotation` from the +x axis (default 0).
 * Vertices are ordered counter-clockwise.
 * Throws `RangeError` when `sides < 3`.
 */
export function regularPolygon(opts: RegularPolygonOptions): Polygon {
  const { sides, center, radius, rotation = 0 } = opts;
  if (sides < 3) {
    throw new RangeError(`regularPolygon: sides must be >= 3, got ${sides}`);
  }
  const step = (Math.PI * 2) / sides;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * step;
    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return { vertices };
}

/**
 * Return the directed edges of a polygon in vertex order, closing the loop.
 * Each edge records the supplied `polygonId` as its sole owner (contact graph
 * resolution happens separately in `buildContactGraph`).
 */
export function polygonEdges(polygon: Polygon, polygonId: number): Edge[] {
  const { vertices } = polygon;
  const n = vertices.length;
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i]!;
    const p2 = vertices[(i + 1) % n]!;
    edges.push({
      p1,
      p2,
      midpoint: midpoint(p1, p2),
      polygonIds: [polygonId],
    });
  }
  return edges;
}
