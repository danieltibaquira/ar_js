import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { extrudeStrapwork } from '../../../src/core/three/extrude';
import { hankinPattern } from '../../../src/geometry/hankin';
import { squareTiling } from '../../../src/geometry/tilings';
import type { Pattern } from '../../../src/geometry/types';

describe('extrudeStrapwork', () => {
  it('returns no geometries for an empty pattern', () => {
    const out = extrudeStrapwork({ strapSegments: [] }, { strapWidth: 0.1 });
    expect(out).toHaveLength(0);
  });

  it('returns one geometry for a single strap', () => {
    const pattern: Pattern = {
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    };
    const out = extrudeStrapwork(pattern, { strapWidth: 0.1, depth: 0.05 });
    expect(out).toHaveLength(1);
    expect(out[0]).toBeInstanceOf(THREE.BufferGeometry);
    const positions = out[0]!.getAttribute('position');
    expect(positions.count).toBeGreaterThan(0);
  });

  it('returns two geometries for two disjoint parallel straps', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 5 }, p2: { x: 1, y: 5 } },
      ],
    };
    const out = extrudeStrapwork(pattern, { strapWidth: 0.1 });
    expect(out).toHaveLength(2);
  });

  it('returns one geometry for two straps that share an endpoint', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } },
      ],
    };
    const out = extrudeStrapwork(pattern, { strapWidth: 0.1 });
    expect(out).toHaveLength(1);
  });

  it('respects an endpoint tolerance for near-coincident points', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 1 + 1e-10, y: 1e-10 }, p2: { x: 1, y: 1 } },
      ],
    };
    const out = extrudeStrapwork(pattern, {
      strapWidth: 0.1,
      tolerance: 1e-6,
    });
    expect(out).toHaveLength(1);
  });

  it('produces non-empty triangle geometry for a real Hankin pattern', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const out = extrudeStrapwork(pattern, { strapWidth: 0.1, depth: 0.05 });
    expect(out.length).toBeGreaterThan(0);
    let totalTris = 0;
    for (const geom of out) {
      const idx = geom.getIndex();
      const positions = geom.getAttribute('position');
      const triCount =
        idx !== null ? idx.count / 3 : positions.count / 3;
      expect(triCount).toBeGreaterThan(0);
      totalTris += triCount;
    }
    expect(totalTris).toBeGreaterThan(0);
  });

  it('mergeVertices does not throw on the output (no manifold-breaking)', async () => {
    const { mergeVertices } = await import(
      'three/examples/jsm/utils/BufferGeometryUtils.js'
    );
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const out = extrudeStrapwork(pattern, { strapWidth: 0.1, depth: 0.05 });
    for (const geom of out) {
      expect(() => mergeVertices(geom)).not.toThrow();
    }
  });

  it('honours the strapWidth option (wider strap → larger bounding box)', () => {
    const pattern: Pattern = {
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    };
    const thin = extrudeStrapwork(pattern, { strapWidth: 0.05 })[0]!;
    const thick = extrudeStrapwork(pattern, { strapWidth: 0.5 })[0]!;
    thin.computeBoundingBox();
    thick.computeBoundingBox();
    const thinSize = thin.boundingBox!.getSize(new THREE.Vector3());
    const thickSize = thick.boundingBox!.getSize(new THREE.Vector3());
    // Width perpendicular to the segment is the y axis here.
    expect(thickSize.y).toBeGreaterThan(thinSize.y);
  });

  it('rejects non-positive strapWidth', () => {
    expect(() =>
      extrudeStrapwork(
        { strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }] },
        { strapWidth: 0 },
      ),
    ).toThrow();
  });
});
