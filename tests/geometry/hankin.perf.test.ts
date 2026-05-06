import { describe, expect, it } from 'vitest';
import { hankinPattern } from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';

describe('hankinPattern perf', () => {
  it('builds a 32x32 square tiling pattern under 200 ms', () => {
    const tiling = squareTiling({ rows: 32, cols: 32, size: 1 });
    const t0 = performance.now();
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const t1 = performance.now();
    // Sanity floor: at least 2 × interior edges of strap segments (default clip).
    const interior = tiling.edges.filter((e) => e.polygonIds.length === 2).length;
    expect(pattern.strapSegments.length).toBeGreaterThanOrEqual(2 * interior);
    expect(t1 - t0).toBeLessThan(200);
  });
});
