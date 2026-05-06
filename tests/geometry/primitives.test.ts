import { describe, expect, it } from 'vitest';
import {
  distance,
  midpoint,
  pointsEqual,
  regularPolygon,
  polygonEdges,
} from '../../src/geometry/primitives';

const TAU = Math.PI * 2;

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
  });

  it('computes Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('midpoint', () => {
  it('returns the average of the endpoints', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 6 })).toEqual({ x: 2, y: 3 });
  });
});

describe('pointsEqual', () => {
  it('treats identical points as equal', () => {
    expect(pointsEqual({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
  });

  it('treats points within tolerance as equal', () => {
    expect(pointsEqual({ x: 1, y: 1 }, { x: 1 + 1e-12, y: 1 }, 1e-9)).toBe(true);
  });

  it('rejects points outside tolerance', () => {
    expect(pointsEqual({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 1e-6)).toBe(false);
  });
});

describe('regularPolygon', () => {
  it('returns N vertices for an N-gon', () => {
    const hex = regularPolygon({ sides: 6, center: { x: 0, y: 0 }, radius: 1 });
    expect(hex.vertices).toHaveLength(6);
  });

  it('places vertex 0 on the +x axis when rotation is 0', () => {
    const hex = regularPolygon({ sides: 6, center: { x: 0, y: 0 }, radius: 1 });
    expect(hex.vertices[0]!.x).toBeCloseTo(1, 10);
    expect(hex.vertices[0]!.y).toBeCloseTo(0, 10);
  });

  it('places every vertex on the circumscribed circle', () => {
    const poly = regularPolygon({ sides: 12, center: { x: 5, y: -3 }, radius: 2 });
    for (const v of poly.vertices) {
      const r = distance(v, { x: 5, y: -3 });
      expect(r).toBeCloseTo(2, 10);
    }
  });

  it('honours the rotation parameter', () => {
    const square = regularPolygon({
      sides: 4,
      center: { x: 0, y: 0 },
      radius: 1,
      rotation: TAU / 8,
    });
    expect(square.vertices[0]!.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(square.vertices[0]!.y).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('throws (or returns degenerate) when sides < 3', () => {
    expect(() =>
      regularPolygon({ sides: 2, center: { x: 0, y: 0 }, radius: 1 }),
    ).toThrow();
  });
});

describe('polygonEdges', () => {
  it('returns N edges for an N-gon', () => {
    const poly = regularPolygon({ sides: 5, center: { x: 0, y: 0 }, radius: 1 });
    expect(polygonEdges(poly, 0)).toHaveLength(5);
  });

  it('computes correct midpoints', () => {
    const square = regularPolygon({
      sides: 4,
      center: { x: 0, y: 0 },
      radius: 1,
      rotation: TAU / 8,
    });
    const edges = polygonEdges(square, 0);
    for (const e of edges) {
      const m = midpoint(e.p1, e.p2);
      expect(e.midpoint.x).toBeCloseTo(m.x, 10);
      expect(e.midpoint.y).toBeCloseTo(m.y, 10);
    }
  });

  it('records the supplied polygon id on every edge', () => {
    const poly = regularPolygon({ sides: 3, center: { x: 0, y: 0 }, radius: 1 });
    const edges = polygonEdges(poly, 7);
    for (const e of edges) {
      expect(e.polygonIds).toEqual([7]);
    }
  });
});
