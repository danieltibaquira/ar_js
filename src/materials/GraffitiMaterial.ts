/**
 * Graffiti material — Hankin pattern overlaid on a procedural concrete wall
 * with FBM-modulated edge bleed and an optional vertical drip mask.
 *
 * The wall base inlines the M-01 contract: a tile-free matte surface
 * driven by Worley noise, with a configurable scale to break up
 * repetition at 4× tiling. The pattern overlay reuses the same
 * line-segment SDF as `HankinShaderMaterial` (T-03), but the strap edge
 * is jittered by FBM (`u_bleed`) so it reads as paint rather than vector
 * art, optionally cut by drips (`u_drip`) and faded (`u_fade`).
 *
 * Hand-toggleable knobs (per tracker M-02 acceptance): bleed, drip, fade,
 * palette (`paint` + `paintVar` + `wall`).
 */

import * as THREE from 'three';
import type { Pattern } from '../geometry/types';

export interface GraffitiOptions {
  readonly strapWidth?: number;
  readonly bleed?: number;
  readonly drip?: number;
  readonly fade?: number;
  readonly paintColor?: THREE.ColorRepresentation;
  readonly paintVariationColor?: THREE.ColorRepresentation;
  readonly wallColor?: THREE.ColorRepresentation;
  readonly wallNoiseScale?: number;
}

export interface GraffitiResult {
  readonly material: THREE.ShaderMaterial;
  setPattern(pattern: Pattern): void;
  setStrapWidth(value: number): void;
  setBleed(value: number): void;
  setDrip(value: number): void;
  setFade(value: number): void;
  setPaintColor(color: THREE.ColorRepresentation): void;
  setPaintVariationColor(color: THREE.ColorRepresentation): void;
  setWallColor(color: THREE.ColorRepresentation): void;
  setWallNoiseScale(value: number): void;
  dispose(): void;
}

const DEFAULTS = {
  strapWidth: 0.05,
  bleed: 0.012,
  drip: 0.0,
  fade: 1.0,
  paintColor: 0xe5d8b1,
  paintVariationColor: 0x9a8a55,
  wallColor: 0x6c655d,
  wallNoiseScale: 12,
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
  uniform vec4 u_bounds;
  uniform float u_strapWidth;
  uniform float u_bleed;
  uniform float u_drip;
  uniform float u_fade;
  uniform vec3 u_paint;
  uniform vec3 u_paintVar;
  uniform vec3 u_wall;
  uniform float u_wallNoise;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Worley (cellular) noise — minimum distance to one of 9 jittered points
  // around the local cell. Yields a tile-free matte texture for M-01.
  float worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 8.0;
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 cell = i + vec2(float(dx), float(dy));
        vec2 jitter = vec2(hash21(cell), hash21(cell + vec2(17.13, 31.71)));
        float d = length(vec2(float(dx), float(dy)) + jitter - f);
        minDist = min(minDist, d);
      }
    }
    return minDist;
  }

  // Cheap FBM: 4 octaves of value noise, used for paint-edge bleed and drips.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.07;
      a *= 0.5;
    }
    return v;
  }

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

    // ---- Wall base (M-01 inlined) ----
    float w = worley(vUv * u_wallNoise);
    float wallShade = smoothstep(0.0, 0.55, w);
    vec3 wall = mix(u_wall * 0.82, u_wall * 1.10, wallShade);
    wall += (hash21(vUv * 1024.0) - 0.5) * 0.025;

    // ---- Pattern SDF ----
    float minD = 1e9;
    float n = u_segmentCount;
    for (int i = 0; i < 4096; i++) {
      if (float(i) >= n) break;
      vec2 uv2 = vec2((float(i) + 0.5) / max(n, 1.0), 0.5);
      vec4 seg = texture2D(u_segments, uv2);
      float d = segDist(p, seg.xy, seg.zw);
      minD = min(minD, d);
    }

    float halfW = u_strapWidth * 0.5;
    // Bleed: jitter the half-width threshold by FBM in pattern-space.
    float bleedAmount = u_bleed * (fbm(p * 6.0) - 0.5) * 2.0;
    float threshold = halfW + bleedAmount;
    float edge = smoothstep(threshold + 0.004, threshold - 0.004, minD);

    // Drip: vertical streaks of FBM that punch the pattern further down.
    float dripFbm = fbm(vec2(p.x * 18.0, p.y * 0.8));
    float dripMask = smoothstep(0.55, 0.95, dripFbm);
    float dripExtra = smoothstep(threshold + u_drip * 0.25, threshold, minD)
                    * dripMask * u_drip;
    edge = max(edge, dripExtra);

    // Paint colour with subtle variation.
    float paintShade = fbm(p * 3.5);
    vec3 paint = mix(u_paint, u_paintVar, smoothstep(0.3, 0.75, paintShade));

    // Apply fade overall.
    float alpha = clamp(edge * u_fade, 0.0, 1.0);

    vec3 col = mix(wall, paint, alpha);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGraffitiMaterial(
  pattern: Pattern,
  options: GraffitiOptions = {},
): GraffitiResult {
  const opts = { ...DEFAULTS, ...options };
  const bounds = computeBounds(pattern);
  const segTex = buildSegmentTexture(pattern);

  const uniforms = {
    u_segments: { value: segTex },
    u_segmentCount: { value: pattern.strapSegments.length },
    u_bounds: {
      value: new THREE.Vector4(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
    },
    u_strapWidth: { value: opts.strapWidth },
    u_bleed: { value: opts.bleed },
    u_drip: { value: opts.drip },
    u_fade: { value: opts.fade },
    u_paint: { value: new THREE.Color(opts.paintColor) },
    u_paintVar: { value: new THREE.Color(opts.paintVariationColor) },
    u_wall: { value: new THREE.Color(opts.wallColor) },
    u_wallNoise: { value: opts.wallNoiseScale },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  });

  return {
    material,
    setPattern(p) {
      uniforms.u_segments.value.dispose();
      uniforms.u_segments.value = buildSegmentTexture(p);
      uniforms.u_segmentCount.value = p.strapSegments.length;
      const b = computeBounds(p);
      uniforms.u_bounds.value.set(b.minX, b.minY, b.maxX, b.maxY);
    },
    setStrapWidth(v) {
      uniforms.u_strapWidth.value = v;
    },
    setBleed(v) {
      uniforms.u_bleed.value = v;
    },
    setDrip(v) {
      uniforms.u_drip.value = v;
    },
    setFade(v) {
      uniforms.u_fade.value = v;
    },
    setPaintColor(c) {
      uniforms.u_paint.value.set(c);
    },
    setPaintVariationColor(c) {
      uniforms.u_paintVar.value.set(c);
    },
    setWallColor(c) {
      uniforms.u_wall.value.set(c);
    },
    setWallNoiseScale(v) {
      uniforms.u_wallNoise.value = v;
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
