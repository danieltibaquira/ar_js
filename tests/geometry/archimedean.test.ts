import { describe, expect, it } from 'vitest';
import {
  truncatedSquareTiling,
  trihexagonalTiling,
} from '../../src/geometry/archimedean';
import { hankinPattern } from '../../src/geometry/hankin';
import { distance } from '../../src/geometry/primitives';

describe('truncatedSquareTiling (4.8.8)', () => {
  it('produces rows*cols octagons + (rows-1)*(cols-1) interior squares', () => {
    const t = truncatedSquareTiling({ rows: 3, cols: 4, size: 1 });
    const octagons = t.polygons.filter((p) => p.vertices.length === 8);
    const squares = t.polygons.filter((p) => p.vertices.length === 4);
    expect(octagons).toHaveLength(12);
    expect(squares).toHaveLength(2 * 3); // (rows-1)*(cols-1) = 2*3
  });

  it('every edge has the supplied length within tolerance', () => {
    const a = 1;
    const t = truncatedSquareTiling({ rows: 2, cols: 2, size: a });
    for (const poly of t.polygons) {
      for (let i = 0; i < poly.vertices.length; i++) {
        const v1 = poly.vertices[i]!;
        const v2 = poly.vertices[(i + 1) % poly.vertices.length]!;
        expect(distance(v1, v2)).toBeCloseTo(a, 9);
      }
    }
  });

  it('shares edges between adjacent octagons and surrounding diamonds', () => {
    const t = truncatedSquareTiling({ rows: 2, cols: 2, size: 1 });
    const interiorEdges = t.edges.filter((e) => e.polygonIds.length === 2);
    // 2x2 octagons share 4 edges (right of (0,0) with (1,0); top of (0,0)
    // with (0,1); right of (0,1) with (1,1); top of (1,0) with (1,1)).
    // The 1 interior diamond shares 4 edges with the 4 surrounding octagons.
    // Total: 4 + 4 = 8.
    expect(interiorEdges.length).toBe(8);
  });

  it('feeds into hankinPattern unchanged', () => {
    const t = truncatedSquareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(t, { contactAngle: Math.PI / 4 });
    expect(pattern.strapSegments.length).toBeGreaterThan(0);
    for (const seg of pattern.strapSegments) {
      expect(Number.isFinite(seg.p1.x)).toBe(true);
      expect(Number.isFinite(seg.p2.y)).toBe(true);
    }
  });

  it('reports finite bounds spanning the polygon set', () => {
    const t = truncatedSquareTiling({ rows: 2, cols: 2, size: 1 });
    expect(t.bounds.maxX - t.bounds.minX).toBeGreaterThan(0);
    expect(t.bounds.maxY - t.bounds.minY).toBeGreaterThan(0);
  });
});

describe('trihexagonalTiling (3.6.3.6)', () => {
  it('produces hexagons + 2 triangles per hexagon (plus boundary)', () => {
    const t = trihexagonalTiling({ rows: 2, cols: 2, size: 1 });
    const hex = t.polygons.filter((p) => p.vertices.length === 6);
    const tri = t.polygons.filter((p) => p.vertices.length === 3);
    expect(hex.length).toBe(4);
    // Each interior triangle is shared between 3 hexagons; on a 2×2 grid we
    // emit one upward + one downward triangle per hexagon-cell, so 2×4 = 8
    // triangles before deduplication. The contact graph keeps duplicates as
    // separate polygons (we don't merge identical polygons), so:
    expect(tri.length).toBeGreaterThanOrEqual(8);
  });

  it('every edge has the supplied length within tolerance', () => {
    const a = 1;
    const t = trihexagonalTiling({ rows: 2, cols: 2, size: a });
    for (const poly of t.polygons) {
      for (let i = 0; i < poly.vertices.length; i++) {
        const v1 = poly.vertices[i]!;
        const v2 = poly.vertices[(i + 1) % poly.vertices.length]!;
        expect(distance(v1, v2)).toBeCloseTo(a, 9);
      }
    }
  });

  it('feeds into hankinPattern unchanged', () => {
    const t = trihexagonalTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(t, { contactAngle: Math.PI / 4 });
    expect(pattern.strapSegments.length).toBeGreaterThan(0);
  });
});
