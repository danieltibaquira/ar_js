/**
 * Tiling generators for the Hankin / PIC engine.
 *
 * STATUS: contracts only — implementations come in the GREEN phase.
 */

import type { Tiling, Polygon, Edge } from './types';

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
 */
export declare function squareTiling(opts: SquareTilingOptions): Tiling;

/**
 * Build a flat-top hexagonal tiling. Adjacent rows are offset by half a column.
 */
export declare function hexagonalTiling(opts: HexagonalTilingOptions): Tiling;

/**
 * Detect shared edges across an arbitrary list of polygons.
 * Two edges are considered shared when their endpoints match (in either order)
 * within `tolerance`.
 */
export declare function buildContactGraph(
  polygons: readonly Polygon[],
  tolerance?: number,
): Edge[];
