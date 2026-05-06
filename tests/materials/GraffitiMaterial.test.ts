import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGraffitiMaterial } from '../../src/materials/GraffitiMaterial';
import type { Pattern } from '../../src/geometry/types';

describe('createGraffitiMaterial', () => {
  it('returns a ShaderMaterial with the full uniform set', () => {
    const result = createGraffitiMaterial({ strapSegments: [] });
    const u = result.material.uniforms;
    for (const key of [
      'u_segments',
      'u_segmentCount',
      'u_bounds',
      'u_strapWidth',
      'u_bleed',
      'u_drip',
      'u_fade',
      'u_paint',
      'u_paintVar',
      'u_wall',
      'u_wallNoise',
    ]) {
      expect(u[key]).toBeDefined();
    }
    result.dispose();
  });

  it('exposes the four hand-toggleable knobs the tracker calls out', () => {
    const result = createGraffitiMaterial({ strapSegments: [] });
    result.setBleed(0.04);
    result.setDrip(0.6);
    result.setFade(0.7);
    result.setPaintColor(0xff3322);
    expect(result.material.uniforms['u_bleed']!.value).toBeCloseTo(0.04, 8);
    expect(result.material.uniforms['u_drip']!.value).toBeCloseTo(0.6, 8);
    expect(result.material.uniforms['u_fade']!.value).toBeCloseTo(0.7, 8);
    expect(
      (result.material.uniforms['u_paint']!.value as THREE.Color).getHex(),
    ).toBe(0xff3322);
    result.dispose();
  });

  it('palette setters cover paint, paintVariation, and wall', () => {
    const result = createGraffitiMaterial({ strapSegments: [] });
    result.setPaintVariationColor(0x112233);
    result.setWallColor(0x445566);
    expect(
      (result.material.uniforms['u_paintVar']!.value as THREE.Color).getHex(),
    ).toBe(0x112233);
    expect(
      (result.material.uniforms['u_wall']!.value as THREE.Color).getHex(),
    ).toBe(0x445566);
    result.dispose();
  });

  it('strapWidth + wallNoiseScale setters update uniforms', () => {
    const result = createGraffitiMaterial({ strapSegments: [] });
    result.setStrapWidth(0.05);
    result.setWallNoiseScale(8.0);
    expect(result.material.uniforms['u_strapWidth']!.value).toBeCloseTo(0.05, 8);
    expect(result.material.uniforms['u_wallNoise']!.value).toBeCloseTo(8.0, 8);
    result.dispose();
  });

  it('setPattern rebuilds the segment texture and updates the count', () => {
    const a: Pattern = {
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    };
    const result = createGraffitiMaterial(a);
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(1);
    result.setPattern({
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
      ],
    });
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(2);
    result.dispose();
  });

  it('fragment source contains the wall-noise + pattern-bleed + drip ops', () => {
    const result = createGraffitiMaterial({ strapSegments: [] });
    const src = result.material.fragmentShader;
    // Worley keeps tiling invisible (M-01 acceptance via the wall base).
    expect(src).toMatch(/worley/i);
    // FBM modulates the SDF threshold for paint bleed.
    expect(src).toMatch(/fbm/i);
    // Line-segment SDF for the pattern itself.
    expect(src).toMatch(/segDist|sdSegment|segment_dist/i);
    // The four toggleable knobs all reach the shader.
    expect(src).toMatch(/u_bleed/);
    expect(src).toMatch(/u_drip/);
    expect(src).toMatch(/u_fade/);
    result.dispose();
  });

  it('dispose tears down the material and segment texture', () => {
    const result = createGraffitiMaterial({
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    });
    const tex = result.material.uniforms['u_segments']!.value as THREE.DataTexture;
    let materialDisposed = false;
    let texDisposed = false;
    result.material.addEventListener('dispose', () => {
      materialDisposed = true;
    });
    tex.addEventListener('dispose', () => {
      texDisposed = true;
    });
    result.dispose();
    expect(materialDisposed).toBe(true);
    expect(texDisposed).toBe(true);
  });
});
