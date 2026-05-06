/**
 * Pure geometric primitives. No dependencies on three.js or DOM.
 * Tests in tests/geometry/primitives.test.ts.
 *
 * STATUS: contracts only — implementations come in the GREEN phase.
 */

import type { Point, Polygon, Edge, RegularPolygonOptions } from './types';

/** Build a regular n-gon. Vertex 0 sits at angle `rotation` (default 0). */
export declare function regularPolygon(opts: RegularPolygonOptions): Polygon;

/** Return the directed edges of a polygon in vertex order, closing the loop. */
export declare function polygonEdges(polygon: Polygon, polygonId: number): Edge[];

/** Euclidean distance. */
export declare function distance(a: Point, b: Point): number;

/** Midpoint of a segment. */
export declare function midpoint(a: Point, b: Point): Point;

/**
 * Returns true when two points are equal within `tolerance` (default 1e-9).
 */
export declare function pointsEqual(a: Point, b: Point, tolerance?: number): boolean;
