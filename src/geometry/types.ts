/**
 * Core geometric types for the Islamic Geometry Explorer.
 *
 * The Hankin / Polygons-In-Contact (PIC) method, formalised by Kaplan, drives the
 * primary pattern engine. A tiling of polygons in contact is decorated by drawing
 * two lines through the midpoint of every shared edge; the lines are extended until
 * they meet other lines from neighbouring edges. The set of resulting strap segments
 * is the pattern.
 *
 * References:
 *   - Hankin, E.H. "The Drawing of Geometric Patterns in Saracenic Art" (1925)
 *   - Kaplan, C.S. "Islamic Star Patterns from Polygons in Contact" (2005)
 *   - Lu, P.J. & Steinhardt, P.J. "Decagonal and Quasi-Crystalline Tilings ..." Science (2007)
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Polygon {
  readonly vertices: readonly Point[];
}

export interface Edge {
  readonly p1: Point;
  readonly p2: Point;
  readonly midpoint: Point;
  /**
   * Indices of polygons that share this edge inside a Tiling.
   * Length 1 for boundary edges, length 2 for interior edges.
   */
  readonly polygonIds: readonly number[];
}

export interface Tiling {
  readonly polygons: readonly Polygon[];
  readonly edges: readonly Edge[];
  readonly bounds: Bounds;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Hankin contact angle in radians, measured from the edge tangent.
 *  - π/2 produces straps perpendicular to the edge (a square grid pattern).
 *  - Smaller angles produce more acute, "sharper" star points.
 *  - Typical artistic range: [π/12, 5π/12].
 */
export type ContactAngle = number;

export interface StrapSegment {
  readonly p1: Point;
  readonly p2: Point;
}

export interface Pattern {
  readonly strapSegments: readonly StrapSegment[];
  readonly sourceTiling?: Tiling;
}

export interface RegularPolygonOptions {
  readonly sides: number;
  readonly center: Point;
  readonly radius: number;
  /** Rotation in radians applied to vertex 0. Defaults to 0 (vertex 0 on +x axis). */
  readonly rotation?: number;
}
