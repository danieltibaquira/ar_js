import { describe, expect, it } from 'vitest';
import {
  squareTiling,
  hexagonalTiling,
  buildContactGraph,
} from '../../src/geometry/tilings';
import { regularPolygon } from '../../src/geometry/primitives';

describe('squareTiling', () => {
  it('produces rows*cols polygons', () => {
    const t = squareTiling({ rows: 3, cols: 4, size: 1 });
    expect(t.polygons).toHaveLength(12);
  });

  it('every polygon is a quadrilateral', () => {
    const t = squareTiling({ rows: 2, cols: 2, size: 1 });
    for (const p of t.polygons) {
      expect(p.vertices).toHaveLength(4);
    }
  });

  it('reports correct bounds for unit squares', () => {
    const t = squareTiling({ rows: 2, cols: 3, size: 1 });
    expect(t.bounds.minX).toBeCloseTo(0, 10);
    expect(t.bounds.minY).toBeCloseTo(0, 10);
    expect(t.bounds.maxX).toBeCloseTo(3, 10);
    expect(t.bounds.maxY).toBeCloseTo(2, 10);
  });

  it('flags interior edges as shared between two polygons', () => {
    const t = squareTiling({ rows: 2, cols: 2, size: 1 });
    const interior = t.edges.filter((e) => e.polygonIds.length === 2);
    // 2x2 grid: 4 interior edges (one shared between each adjacent pair).
    expect(interior).toHaveLength(4);
  });

  it('flags boundary edges as belonging to one polygon', () => {
    const t = squareTiling({ rows: 2, cols: 2, size: 1 });
    const boundary = t.edges.filter((e) => e.polygonIds.length === 1);
    // 2x2 grid: 8 boundary edges around the perimeter.
    expect(boundary).toHaveLength(8);
  });
});

describe('hexagonalTiling', () => {
  it('produces rows*cols hexagons', () => {
    const t = hexagonalTiling({ rows: 2, cols: 3, size: 1 });
    expect(t.polygons).toHaveLength(6);
  });

  it('every polygon is a hexagon', () => {
    const t = hexagonalTiling({ rows: 2, cols: 2, size: 1 });
    for (const p of t.polygons) {
      expect(p.vertices).toHaveLength(6);
    }
  });
});

describe('buildContactGraph', () => {
  it('returns no shared edges for a single polygon (only boundary)', () => {
    const tri = regularPolygon({ sides: 3, center: { x: 0, y: 0 }, radius: 1 });
    const edges = buildContactGraph([tri]);
    expect(edges.every((e) => e.polygonIds.length === 1)).toBe(true);
    expect(edges).toHaveLength(3);
  });

  it('detects a shared edge between two adjacent unit squares', () => {
    const left = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    const right = {
      vertices: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ],
    };
    const edges = buildContactGraph([left, right]);
    const shared = edges.filter((e) => e.polygonIds.length === 2);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.polygonIds.slice().sort()).toEqual([0, 1]);
  });

  it('honours the tolerance argument', () => {
    const a = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    const b = {
      vertices: [
        { x: 1 + 1e-10, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1 + 1e-10, y: 1 },
      ],
    };
    const edges = buildContactGraph([a, b], 1e-6);
    expect(edges.filter((e) => e.polygonIds.length === 2)).toHaveLength(1);
  });
});
