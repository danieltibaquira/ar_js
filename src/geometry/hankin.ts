/**
 * Hankin / Polygons-In-Contact pattern construction.
 *
 * For every interior edge `e` of the tiling we emit two strap rays starting at
 * `midpoint(e)`, leaving the edge at angles `+contactAngle` and `-contactAngle`
 * measured from the edge tangent. Rays are then extended within their host
 * polygon until they hit another ray (intersection) or the polygon boundary.
 *
 * STATUS: contracts only — implementations come in the GREEN phase.
 */

import type { ContactAngle, Pattern, StrapSegment, Tiling, Point, Polygon } from './types';

export interface HankinOptions {
  readonly contactAngle: ContactAngle;
  /**
   * If true, rays that exit a polygon without hitting another ray are clipped
   * at the polygon edge. Defaults to true.
   */
  readonly clipToPolygons?: boolean;
}

/**
 * Build the Hankin pattern for a tiling at a given contact angle.
 *
 * Exit criteria (verified by tests):
 *   - For every interior edge, the pattern contains exactly 2 strap segments
 *     starting at its midpoint.
 *   - Boundary edges contribute zero, one, or two segments depending on
 *     `clipToPolygons` (zero when true and the strap escapes the tiling).
 *   - With contactAngle = π/2 on a square tiling, every strap is parallel to
 *     a tiling axis (perpendicular to its edge of origin).
 *   - The output is deterministic given identical inputs.
 */
export declare function hankinPattern(tiling: Tiling, options: HankinOptions): Pattern;

/**
 * Compute the intersection point of two line segments, or null when they do
 * not intersect within their finite extents (open intervals at both ends).
 * Tolerance applied to parallel-line detection.
 */
export declare function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  tolerance?: number,
): Point | null;

/**
 * Given a starting ray (origin + direction) and a convex polygon, return the
 * exit point where the ray meets the polygon boundary, or null if the ray
 * never exits (origin outside).
 */
export declare function rayExitPoint(
  origin: Point,
  direction: Point,
  polygon: Polygon,
): Point | null;

/** Re-export for external consumers building higher-level visualisations. */
export type { StrapSegment };
