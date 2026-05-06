/**
 * Strapwork extrusion. Each strap segment becomes a thin ribbon polygon
 * (offset by `strapWidth/2` on each side), then a `THREE.Shape`, then an
 * `ExtrudeGeometry`. Straps that share endpoints (within tolerance) form a
 * connected component — the function emits one merged `BufferGeometry` per
 * component so caller-side mesh count matches the strap-graph component
 * count.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pattern, StrapSegment } from '../../geometry/types';
import { strapToRibbon } from '../../geometry/variations';

export interface ExtrudeStrapworkOptions {
  readonly strapWidth: number;
  readonly depth?: number;
  readonly bevelEnabled?: boolean;
  readonly bevelSize?: number;
  readonly bevelThickness?: number;
  readonly bevelSegments?: number;
  /**
   * Tolerance for endpoint matching when computing connected components.
   * Defaults to 1e-9.
   */
  readonly tolerance?: number;
}

const DEFAULTS = {
  depth: 0.1,
  bevelEnabled: false,
  bevelSize: 0,
  bevelThickness: 0,
  bevelSegments: 1,
  tolerance: 1e-9,
};

export function extrudeStrapwork(
  pattern: Pattern,
  options: ExtrudeStrapworkOptions,
): THREE.BufferGeometry[] {
  if (!(options.strapWidth > 0)) {
    throw new RangeError(
      `extrudeStrapwork: strapWidth must be > 0, got ${options.strapWidth}`,
    );
  }
  const opts = { ...DEFAULTS, ...options };
  if (pattern.strapSegments.length === 0) return [];

  const components = connectedComponents(
    pattern.strapSegments,
    opts.tolerance,
  );

  const extrudeSettings = {
    depth: opts.depth,
    bevelEnabled: opts.bevelEnabled,
    bevelSize: opts.bevelSize,
    bevelThickness: opts.bevelThickness,
    bevelSegments: opts.bevelSegments,
    steps: 1,
  };

  const out: THREE.BufferGeometry[] = [];
  for (const component of components) {
    const perStrap: THREE.BufferGeometry[] = [];
    for (const seg of component) {
      const ribbon = strapToRibbon(seg, opts.strapWidth);
      const shape = new THREE.Shape();
      const v0 = ribbon.vertices[0]!;
      shape.moveTo(v0.x, v0.y);
      for (let i = 1; i < ribbon.vertices.length; i++) {
        const v = ribbon.vertices[i]!;
        shape.lineTo(v.x, v.y);
      }
      shape.closePath();
      perStrap.push(new THREE.ExtrudeGeometry(shape, extrudeSettings));
    }
    if (perStrap.length === 0) continue;
    if (perStrap.length === 1) {
      out.push(perStrap[0]!);
    } else {
      const merged = mergeGeometries(perStrap, false);
      if (merged) {
        out.push(merged);
      } else {
        // Fallback: keep the first geometry if merge declined.
        out.push(perStrap[0]!);
      }
    }
  }
  return out;
}

/**
 * Group strap segments by connected component using union-find on
 * endpoints quantised to a tolerance grid.
 */
function connectedComponents(
  segments: readonly StrapSegment[],
  tolerance: number,
): StrapSegment[][] {
  const parent: number[] = [];
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[i] !== root) {
      const next = parent[i]!;
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const pointIndex = new Map<string, number>();
  const keyOf = (x: number, y: number): string => {
    const inv = 1 / Math.max(tolerance, Number.EPSILON);
    return `${Math.round(x * inv)},${Math.round(y * inv)}`;
  };
  const idForPoint = (x: number, y: number): number => {
    const k = keyOf(x, y);
    let id = pointIndex.get(k);
    if (id === undefined) {
      id = parent.length;
      parent.push(id);
      pointIndex.set(k, id);
    }
    return id;
  };

  const segPoints: [number, number][] = [];
  for (const seg of segments) {
    const a = idForPoint(seg.p1.x, seg.p1.y);
    const b = idForPoint(seg.p2.x, seg.p2.y);
    union(a, b);
    segPoints.push([a, b]);
  }

  const groups = new Map<number, StrapSegment[]>();
  for (let i = 0; i < segments.length; i++) {
    const root = find(segPoints[i]![0]);
    let bucket = groups.get(root);
    if (!bucket) {
      bucket = [];
      groups.set(root, bucket);
    }
    bucket.push(segments[i]!);
  }
  return Array.from(groups.values());
}
