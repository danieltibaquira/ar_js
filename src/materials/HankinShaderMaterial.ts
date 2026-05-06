/**
 * Hankin pattern as a fragment shader.
 *
 * Strap segments are packed into a 1D DataTexture (RGBA float per
 * segment: x1, y1, x2, y2). The fragment shader maps every UV to
 * pattern-space, runs a branchless line-segment SDF over each segment,
 * and antialiases via `smoothstep` around the strap-half-width threshold.
 *
 * Configurable: strap width, strap colour, background colour, AA width.
 * Visual parity with `renderToContext` (R-01) is verified manually until
 * the visual-regression harness (B-03) is in place.
 */

import * as THREE from 'three';
import type { Pattern } from '../geometry/types';

export interface HankinShaderOptions {
  readonly strapWidth?: number;
  readonly strapColor?: THREE.ColorRepresentation;
  readonly bgColor?: THREE.ColorRepresentation;
  readonly aaWidth?: number;
}

export interface HankinShaderResult {
  readonly material: THREE.ShaderMaterial;
  setPattern(pattern: Pattern): void;
  setStrapWidth(value: number): void;
  setStrapColor(color: THREE.ColorRepresentation): void;
  setBgColor(color: THREE.ColorRepresentation): void;
  setAaWidth(value: number): void;
  dispose(): void;
}

const DEFAULTS = {
  strapWidth: 0.05,
  strapColor: 0xeeeeee,
  bgColor: 0x0b0b0d,
  aaWidth: 0.005,
};

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D u_segments;
  uniform float u_segmentCount;
  uniform vec4 u_bounds;       // minX, minY, maxX, maxY
  uniform float u_strapWidth;
  uniform vec3 u_strapColor;
  uniform vec3 u_bgColor;
  uniform float u_aaWidth;

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 mn = u_bounds.xy;
    vec2 mx = u_bounds.zw;
    vec2 p = mix(mn, mx, vUv);

    float minD = 1e9;
    float n = u_segmentCount;
    // Loop bounded by a constant; early-exit on i >= n keeps WebGL1 happy.
    for (int i = 0; i < 4096; i++) {
      if (float(i) >= n) break;
      vec2 uv = vec2((float(i) + 0.5) / max(n, 1.0), 0.5);
      vec4 seg = texture2D(u_segments, uv);
      float d = segDist(p, seg.xy, seg.zw);
      minD = min(minD, d);
    }

    float halfW = u_strapWidth * 0.5;
    float alpha = 1.0 - smoothstep(halfW - u_aaWidth, halfW + u_aaWidth, minD);
    vec3 col = mix(u_bgColor, u_strapColor, alpha);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createHankinShaderMaterial(
  pattern: Pattern,
  options: HankinShaderOptions = {},
): HankinShaderResult {
  const opts = { ...DEFAULTS, ...options };
  const bounds = computeBounds(pattern);
  const segTex = buildSegmentTexture(pattern);

  const uniforms = {
    u_segments: { value: segTex },
    u_segmentCount: { value: pattern.strapSegments.length },
    u_bounds: {
      value: new THREE.Vector4(
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY,
      ),
    },
    u_strapWidth: { value: opts.strapWidth },
    u_strapColor: { value: new THREE.Color(opts.strapColor) },
    u_bgColor: { value: new THREE.Color(opts.bgColor) },
    u_aaWidth: { value: opts.aaWidth },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  });

  return {
    material,
    setPattern(p) {
      const tex = uniforms.u_segments.value;
      tex.dispose();
      uniforms.u_segments.value = buildSegmentTexture(p);
      uniforms.u_segmentCount.value = p.strapSegments.length;
      const b = computeBounds(p);
      uniforms.u_bounds.value.set(b.minX, b.minY, b.maxX, b.maxY);
    },
    setStrapWidth(v) {
      uniforms.u_strapWidth.value = v;
    },
    setStrapColor(c) {
      uniforms.u_strapColor.value.set(c);
    },
    setBgColor(c) {
      uniforms.u_bgColor.value.set(c);
    },
    setAaWidth(v) {
      uniforms.u_aaWidth.value = v;
    },
    dispose() {
      uniforms.u_segments.value.dispose();
      material.dispose();
    },
  };
}

function buildSegmentTexture(pattern: Pattern): THREE.DataTexture {
  const n = Math.max(1, pattern.strapSegments.length);
  const data = new Float32Array(n * 4);
  for (let i = 0; i < pattern.strapSegments.length; i++) {
    const seg = pattern.strapSegments[i]!;
    data[i * 4 + 0] = seg.p1.x;
    data[i * 4 + 1] = seg.p1.y;
    data[i * 4 + 2] = seg.p2.x;
    data[i * 4 + 3] = seg.p2.y;
  }
  const tex = new THREE.DataTexture(
    data,
    n,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function computeBounds(pattern: Pattern): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (pattern.sourceTiling) {
    const b = pattern.sourceTiling.bounds;
    if (b.maxX > b.minX && b.maxY > b.minY) return { ...b };
  }
  if (pattern.strapSegments.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const seg of pattern.strapSegments) {
    if (seg.p1.x < minX) minX = seg.p1.x;
    if (seg.p1.y < minY) minY = seg.p1.y;
    if (seg.p1.x > maxX) maxX = seg.p1.x;
    if (seg.p1.y > maxY) maxY = seg.p1.y;
    if (seg.p2.x < minX) minX = seg.p2.x;
    if (seg.p2.y < minY) minY = seg.p2.y;
    if (seg.p2.x > maxX) maxX = seg.p2.x;
    if (seg.p2.y > maxY) maxY = seg.p2.y;
  }
  return { minX, minY, maxX, maxY };
}
