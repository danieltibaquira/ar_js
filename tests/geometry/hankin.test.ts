import { describe, expect, it } from 'vitest';
import {
  hankinPattern,
  segmentIntersection,
  rayExitPoint,
} from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';

describe('segmentIntersection', () => {
  it('returns the crossing point of two intersecting segments', () => {
    const p = segmentIntersection(
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 2, y: 0 },
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(1, 10);
    expect(p!.y).toBeCloseTo(1, 10);
  });

  it('returns null for parallel segments', () => {
    const p = segmentIntersection(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    );
    expect(p).toBeNull();
  });

  it('returns null when the lines cross outside both segment extents', () => {
    const p = segmentIntersection(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: -1 },
      { x: 2, y: 1 },
    );
    expect(p).toBeNull();
  });
});

describe('rayExitPoint', () => {
  const unitSquare = {
    vertices: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  };

  it('exits on the right wall when shooting east from the centre', () => {
    const exit = rayExitPoint({ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, unitSquare);
    expect(exit).not.toBeNull();
    expect(exit!.x).toBeCloseTo(1, 10);
    expect(exit!.y).toBeCloseTo(0.5, 10);
  });

  it('exits on the top wall when shooting north from the centre', () => {
    const exit = rayExitPoint({ x: 0.5, y: 0.5 }, { x: 0, y: 1 }, unitSquare);
    expect(exit).not.toBeNull();
    expect(exit!.y).toBeCloseTo(1, 10);
  });

  it('returns null when the origin is outside the polygon', () => {
    const exit = rayExitPoint({ x: -1, y: -1 }, { x: 1, y: 0 }, unitSquare);
    expect(exit).toBeNull();
  });
});

describe('hankinPattern', () => {
  it('produces an empty pattern for an empty tiling', () => {
    const pattern = hankinPattern(
      { polygons: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } },
      { contactAngle: Math.PI / 4 },
    );
    expect(pattern.strapSegments).toHaveLength(0);
  });

  it('produces two straps per interior edge on a square tiling', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const interior = tiling.edges.filter((e) => e.polygonIds.length === 2);
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    // Each interior edge contributes 2 strap rays; each ray becomes 1 segment
    // either by intersecting another ray or by clipping at a polygon boundary.
    // Boundary edges may add 0–2 more depending on clipping. We assert the
    // lower bound: at least 2 * |interior|.
    expect(pattern.strapSegments.length).toBeGreaterThanOrEqual(2 * interior.length);
  });

  it('is deterministic for identical inputs', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const a = hankinPattern(tiling, { contactAngle: Math.PI / 3 });
    const b = hankinPattern(tiling, { contactAngle: Math.PI / 3 });
    expect(a.strapSegments).toEqual(b.strapSegments);
  });

  it('with contactAngle = π/2 every strap is perpendicular to its source edge', () => {
    // On a square tiling, perpendicular straps are axis-aligned. We only check
    // that every segment is either horizontal or vertical (within tolerance).
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 2 });
    for (const seg of pattern.strapSegments) {
      const dx = Math.abs(seg.p2.x - seg.p1.x);
      const dy = Math.abs(seg.p2.y - seg.p1.y);
      const isAxisAligned = dx < 1e-9 || dy < 1e-9;
      expect(isAxisAligned).toBe(true);
    }
  });
});
