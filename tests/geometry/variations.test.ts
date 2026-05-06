import { describe, expect, it } from 'vitest';
import {
  strapToRibbon,
  rosetteHull,
  convexHull,
} from '../../src/geometry/variations';
import { hankinPattern } from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';
import { distance } from '../../src/geometry/primitives';
import type { Pattern, Point, StrapSegment } from '../../src/geometry/types';

function signedArea(vertices: readonly Point[]): number {
  let a = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i]!;
    const v2 = vertices[(i + 1) % n]!;
    a += v1.x * v2.y - v2.x * v1.y;
  }
  return a / 2;
}

describe('strapToRibbon', () => {
  it('produces a 4-vertex polygon', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    const ribbon = strapToRibbon(seg, 0.2);
    expect(ribbon.vertices).toHaveLength(4);
  });

  it('measures width perpendicular to the segment', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 2, y: 0 } };
    const ribbon = strapToRibbon(seg, 0.4);
    // For a horizontal segment, the ribbon spans y ∈ [-0.2, 0.2].
    const ys = ribbon.vertices.map((v) => v.y);
    const span = Math.max(...ys) - Math.min(...ys);
    expect(span).toBeCloseTo(0.4, 10);
  });

  it('extends along the full segment length', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 3, y: 0 } };
    const ribbon = strapToRibbon(seg, 0.1);
    const xs = ribbon.vertices.map((v) => v.x);
    expect(Math.min(...xs)).toBeCloseTo(0, 10);
    expect(Math.max(...xs)).toBeCloseTo(3, 10);
  });

  it('emits vertices in CCW order (positive signed area)', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } };
    const ribbon = strapToRibbon(seg, 0.2);
    expect(signedArea(ribbon.vertices)).toBeGreaterThan(0);
  });

  it('handles a diagonal segment correctly', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } };
    const ribbon = strapToRibbon(seg, Math.SQRT2);
    // Width perpendicular to a 45° diagonal of length √2 with width √2 should
    // produce a ribbon whose corners sit at unit distance from the segment line.
    // The corners along the normal (-1,1)/√2 at p1 are (∓0.5·√2/√2, ±0.5·√2/√2)
    // → (∓0.5, ±0.5). Verify one expected corner exists.
    const expected = { x: -0.5, y: 0.5 };
    const closest = ribbon.vertices.reduce((acc, v) => {
      const d = distance(v, expected);
      return d < acc ? d : acc;
    }, Infinity);
    expect(closest).toBeLessThan(1e-9);
  });

  it('throws on a zero-length segment', () => {
    const seg: StrapSegment = { p1: { x: 1, y: 1 }, p2: { x: 1, y: 1 } };
    expect(() => strapToRibbon(seg, 0.1)).toThrow();
  });

  it('throws on non-positive width', () => {
    const seg: StrapSegment = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    expect(() => strapToRibbon(seg, 0)).toThrow();
    expect(() => strapToRibbon(seg, -0.1)).toThrow();
  });
});

describe('convexHull', () => {
  it('returns null for fewer than 3 unique points', () => {
    expect(convexHull([])).toBeNull();
    expect(convexHull([{ x: 0, y: 0 }])).toBeNull();
    expect(convexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
  });

  it('hulls a square in CCW order', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 }, // interior — must be excluded
    ];
    const hull = convexHull(pts)!;
    expect(hull.vertices).toHaveLength(4);
    expect(signedArea(hull.vertices)).toBeGreaterThan(0);
  });

  it('drops collinear interior points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const hull = convexHull(pts)!;
    expect(hull.vertices).toHaveLength(4);
  });
});

describe('rosetteHull', () => {
  function syntheticSpokes(center: Point, n: number, r: number): Pattern {
    const segs: StrapSegment[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      segs.push({
        p1: center,
        p2: { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) },
      });
    }
    return { strapSegments: segs };
  }

  it('returns null when fewer than 3 endpoints fall in the radius', () => {
    const pattern = syntheticSpokes({ x: 0, y: 0 }, 6, 1);
    // Tiny radius catches only the shared origin endpoint.
    const hull = rosetteHull(pattern, { x: 0, y: 0 }, 1e-6);
    expect(hull).toBeNull();
  });

  it('throws on non-positive radius', () => {
    const pattern = syntheticSpokes({ x: 0, y: 0 }, 6, 1);
    expect(() => rosetteHull(pattern, { x: 0, y: 0 }, 0)).toThrow();
    expect(() => rosetteHull(pattern, { x: 0, y: 0 }, -1)).toThrow();
  });

  it('captures all spoke tips of a synthetic 6-spoke pattern', () => {
    const pattern = syntheticSpokes({ x: 0, y: 0 }, 6, 1);
    const hull = rosetteHull(pattern, { x: 0, y: 0 }, 1.5);
    expect(hull).not.toBeNull();
    expect(hull!.vertices.length).toBeGreaterThanOrEqual(6);
    // Every hull vertex must lie within the search radius.
    for (const v of hull!.vertices) {
      expect(distance(v, { x: 0, y: 0 })).toBeLessThanOrEqual(1.5 + 1e-9);
    }
    expect(signedArea(hull!.vertices)).toBeGreaterThan(0);
  });

  it('extracts a non-degenerate hull from a real Hankin pattern', () => {
    const tiling = squareTiling({ rows: 3, cols: 3, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    // Centre of the middle square in a 3×3 grid sits at (1.5, 1.5).
    const hull = rosetteHull(pattern, { x: 1.5, y: 1.5 }, 0.6);
    expect(hull).not.toBeNull();
    expect(hull!.vertices.length).toBeGreaterThanOrEqual(3);
    expect(signedArea(hull!.vertices)).toBeGreaterThan(0);
  });
});
