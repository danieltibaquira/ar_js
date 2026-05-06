/**
 * Archimedean tilings — mixed regular polygons. Each implemented tiling
 * feeds into the standard `Tiling` shape so the Hankin engine consumes it
 * unchanged.
 *
 * Implemented:
 *   - 4.8.8 (truncated square): octagon + diagonal square pairs.
 *   - 3.6.3.6 (trihexagonal): hexagons separated by upward/downward
 *     equilateral triangles.
 *
 * Future: 4.6.12 (rhombitrihexagonal) and a generic vertex-configuration
 * builder.
 */

import type { Polygon, Tiling } from './types';
import { buildContactGraph } from './tilings';

export interface ArchimedeanTilingOptions {
  readonly rows: number;
  readonly cols: number;
  /** Edge length shared by every polygon in the tiling. */
  readonly size: number;
}

/**
 * 4.8.8 truncated-square tiling: octagons on a square lattice with
 * diagonal squares (rotated 45°) filling the corner gaps. Octagon and
 * square edges all have length `size`.
 */
export function truncatedSquareTiling(opts: ArchimedeanTilingOptions): Tiling {
  const { rows, cols, size: a } = opts;
  const h = (a * (1 + Math.SQRT2)) / 2; // half the octagon's flat-to-flat width
  const stride = 2 * h;
  const polygons: Polygon[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      polygons.push(makeOctagon(col * stride, row * stride, a, h));
    }
  }
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      polygons.push(makeDiamond(col * stride + h, row * stride + h, a));
    }
  }

  return {
    polygons,
    edges: buildContactGraph(polygons),
    bounds: computeBounds(polygons),
  };
}

/**
 * 3.6.3.6 trihexagonal tiling: hexagons (pointy-top) separated by upward
 * and downward equilateral triangles. Edge length `size` is shared.
 */
export function trihexagonalTiling(opts: ArchimedeanTilingOptions): Tiling {
  const { rows, cols, size: a } = opts;
  // Hex circumradius = a (pointy-top: vertex 0 at +y).
  const colWidth = Math.sqrt(3) * a; // horizontal centre spacing
  const rowHeight = 1.5 * a; // vertical centre spacing (only between rows of hexagons of the same parity)
  const polygons: Polygon[] = [];

  for (let row = 0; row < rows; row++) {
    const offset = (row & 1) === 1 ? colWidth / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const cx = col * colWidth + offset;
      const cy = row * rowHeight;
      polygons.push(makeHexagon(cx, cy, a));
      // Pair of triangles sitting on the right side of this hexagon, between
      // it and the next-row hex above-right (and the next-row hex below-right).
      // We emit a triangle pair per cell; the boundary cells will produce
      // some triangles that have no opposing host, but that's fine — they
      // simply end up as boundary polygons in the contact graph.
      polygons.push(makeUpwardTriangle(cx + colWidth / 2, cy + rowHeight / 2, a));
      polygons.push(makeDownwardTriangle(cx + colWidth / 2, cy - rowHeight / 2, a));
    }
  }

  return {
    polygons,
    edges: buildContactGraph(polygons),
    bounds: computeBounds(polygons),
  };
}

function makeOctagon(cx: number, cy: number, a: number, h: number): Polygon {
  const half = a / 2;
  return {
    vertices: [
      { x: cx + h, y: cy + half },
      { x: cx + half, y: cy + h },
      { x: cx - half, y: cy + h },
      { x: cx - h, y: cy + half },
      { x: cx - h, y: cy - half },
      { x: cx - half, y: cy - h },
      { x: cx + half, y: cy - h },
      { x: cx + h, y: cy - half },
    ],
  };
}

function makeDiamond(cx: number, cy: number, a: number): Polygon {
  const r = a / Math.SQRT2;
  return {
    vertices: [
      { x: cx + r, y: cy },
      { x: cx, y: cy + r },
      { x: cx - r, y: cy },
      { x: cx, y: cy - r },
    ],
  };
}

function makeHexagon(cx: number, cy: number, a: number): Polygon {
  // Pointy-top: vertex 0 at angle π/2 from the centre.
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 3;
    vertices.push({
      x: cx + a * Math.cos(angle),
      y: cy + a * Math.sin(angle),
    });
  }
  return { vertices };
}

function makeUpwardTriangle(cx: number, cy: number, a: number): Polygon {
  // Equilateral triangle with the apex up. Side length a.
  const r = a / Math.sqrt(3); // circumradius
  return {
    vertices: [
      { x: cx, y: cy + r },
      { x: cx - a / 2, y: cy - r / 2 },
      { x: cx + a / 2, y: cy - r / 2 },
    ],
  };
}

function makeDownwardTriangle(cx: number, cy: number, a: number): Polygon {
  const r = a / Math.sqrt(3);
  return {
    vertices: [
      { x: cx, y: cy - r },
      { x: cx + a / 2, y: cy + r / 2 },
      { x: cx - a / 2, y: cy + r / 2 },
    ],
  };
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
    for (const v of p.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  }
  return { minX, minY, maxX, maxY };
}
