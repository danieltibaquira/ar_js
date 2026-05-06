/**
 * Tiling generators and contact-graph resolver for the Hankin / PIC engine.
 */

import type { Tiling, Polygon, Edge, Point } from './types';
import { polygonEdges, pointsEqual, regularPolygon } from './primitives';

export interface SquareTilingOptions {
  readonly rows: number;
  readonly cols: number;
  /** Edge length of each square. */
  readonly size: number;
}

export interface HexagonalTilingOptions {
  readonly rows: number;
  readonly cols: number;
  /** Circumradius of each hexagon (centre to vertex). */
  readonly size: number;
}

/**
 * Build an axis-aligned grid of squares.
 * Origin is the bottom-left corner of the bottom-left cell.
 * Vertices are emitted CCW starting at the bottom-left.
 */
export function squareTiling(opts: SquareTilingOptions): Tiling {
  const { rows, cols, size } = opts;
  const polygons: Polygon[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * size;
      const y0 = row * size;
      polygons.push({
        vertices: [
          { x: x0, y: y0 },
          { x: x0 + size, y: y0 },
          { x: x0 + size, y: y0 + size },
          { x: x0, y: y0 + size },
        ],
      });
    }
  }
  return {
    polygons,
    edges: buildContactGraph(polygons),
    bounds: {
      minX: 0,
      minY: 0,
      maxX: cols * size,
      maxY: rows * size,
    },
  };
}

/**
 * Build a pointy-top hexagonal tiling: vertex 0 sits at +y on every cell.
 * Hexagons within a row share their vertical left/right edges; adjacent rows
 * are offset by half a column (sqrt(3)/2 · size in x) so the slanted edges of
 * neighbouring rows align.
 */
export function hexagonalTiling(opts: HexagonalTilingOptions): Tiling {
  const { rows, cols, size } = opts;
  const colWidth = Math.sqrt(3) * size;
  const rowHeight = 1.5 * size;
  const polygons: Polygon[] = [];
  for (let row = 0; row < rows; row++) {
    const rowOffset = (row & 1) === 1 ? colWidth / 2 : 0;
    for (let col = 0; col < cols; col++) {
      polygons.push(
        regularPolygon({
          sides: 6,
          center: { x: col * colWidth + rowOffset, y: row * rowHeight },
          radius: size,
          rotation: Math.PI / 2,
        }),
      );
    }
  }
  return {
    polygons,
    edges: buildContactGraph(polygons),
    bounds: computeBounds(polygons),
  };
}

/**
 * Detect shared edges across an arbitrary list of polygons. Each emitted edge
 * carries the polygon ids of every polygon that owns it (length 1 = boundary,
 * length 2 = interior). Naive O(E²) where E is the total raw edge count;
 * sufficient up to a few thousand polygons.
 */
export function buildContactGraph(
  polygons: readonly Polygon[],
  tolerance = 1e-9,
): Edge[] {
  const raw: Edge[] = [];
  for (let i = 0; i < polygons.length; i++) {
    for (const e of polygonEdges(polygons[i]!, i)) {
      raw.push(e);
    }
  }

  const result: Edge[] = [];
  const consumed = new Array<boolean>(raw.length).fill(false);
  for (let i = 0; i < raw.length; i++) {
    if (consumed[i]) continue;
    const a = raw[i]!;
    let partner = -1;
    for (let j = i + 1; j < raw.length; j++) {
      if (consumed[j]) continue;
      if (edgesMatch(a, raw[j]!, tolerance)) {
        partner = j;
        break;
      }
    }
    if (partner === -1) {
      result.push(a);
    } else {
      const b = raw[partner]!;
      result.push({
        p1: a.p1,
        p2: a.p2,
        midpoint: a.midpoint,
        polygonIds: [...a.polygonIds, ...b.polygonIds],
      });
      consumed[partner] = true;
    }
    consumed[i] = true;
  }
  return result;
}

function edgesMatch(a: Edge, b: Edge, tol: number): boolean {
  return (
    (pointsEqual(a.p1, b.p1, tol) && pointsEqual(a.p2, b.p2, tol)) ||
    (pointsEqual(a.p1, b.p2, tol) && pointsEqual(a.p2, b.p1, tol))
  );
}

function computeBounds(polygons: readonly Polygon[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (polygons.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygons) {
    for (const v of p.vertices as readonly Point[]) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  }
  return { minX, minY, maxX, maxY };
}
