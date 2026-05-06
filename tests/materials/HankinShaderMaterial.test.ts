import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createHankinShaderMaterial,
} from '../../src/materials/HankinShaderMaterial';
import { hankinPattern } from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';
import type { Pattern } from '../../src/geometry/types';

describe('createHankinShaderMaterial', () => {
  it('returns a THREE.ShaderMaterial with the expected uniform set', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const result = createHankinShaderMaterial(pattern);
    expect(result.material).toBeInstanceOf(THREE.ShaderMaterial);
    const u = result.material.uniforms;
    expect(u['u_segments']).toBeDefined();
    expect(u['u_segmentCount']).toBeDefined();
    expect(u['u_bounds']).toBeDefined();
    expect(u['u_strapWidth']).toBeDefined();
    expect(u['u_strapColor']).toBeDefined();
    expect(u['u_bgColor']).toBeDefined();
    expect(u['u_aaWidth']).toBeDefined();
    result.dispose();
  });

  it('u_segmentCount matches the pattern strap count', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const result = createHankinShaderMaterial(pattern);
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(
      pattern.strapSegments.length,
    );
    result.dispose();
  });

  it('packs segment endpoints into a DataTexture (RGBA float per segment)', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 } },
        { p1: { x: 5, y: 6 }, p2: { x: 7, y: 8 } },
      ],
    };
    const result = createHankinShaderMaterial(pattern);
    const tex = result.material.uniforms['u_segments']!.value as THREE.DataTexture;
    expect(tex).toBeInstanceOf(THREE.DataTexture);
    expect(tex.image.width).toBe(2);
    const data = tex.image.data as unknown as Float32Array;
    expect(Array.from(data.slice(0, 8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    result.dispose();
  });

  it('exposes setters for strap width, colours, and AA width', () => {
    const result = createHankinShaderMaterial({ strapSegments: [] });
    result.setStrapWidth(0.1);
    expect(result.material.uniforms['u_strapWidth']!.value).toBe(0.1);
    result.setStrapColor(0xff8800);
    expect(
      (result.material.uniforms['u_strapColor']!.value as THREE.Color).getHex(),
    ).toBe(0xff8800);
    result.setBgColor(0x112233);
    expect(
      (result.material.uniforms['u_bgColor']!.value as THREE.Color).getHex(),
    ).toBe(0x112233);
    result.setAaWidth(0.01);
    expect(result.material.uniforms['u_aaWidth']!.value).toBe(0.01);
    result.dispose();
  });

  it('setPattern rebuilds the segment texture and updates the count', () => {
    const result = createHankinShaderMaterial({
      strapSegments: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
    });
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(1);
    result.setPattern({
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
        { p1: { x: 0, y: 2 }, p2: { x: 1, y: 2 } },
      ],
    });
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(3);
    const tex = result.material.uniforms['u_segments']!.value as THREE.DataTexture;
    expect(tex.image.width).toBe(3);
    result.dispose();
  });

  it('survives an empty pattern (no segment data, but still valid)', () => {
    const result = createHankinShaderMaterial({ strapSegments: [] });
    expect(result.material.uniforms['u_segmentCount']!.value).toBe(0);
    result.dispose();
  });

  it('fragment source contains the SDF-style operations', () => {
    const result = createHankinShaderMaterial({ strapSegments: [] });
    const src = result.material.fragmentShader;
    // Key tokens expected in any branchless line-segment SDF shader.
    expect(src).toContain('smoothstep');
    expect(src).toMatch(/u_segments/);
    expect(src).toMatch(/u_strapWidth/);
    result.dispose();
  });

  it('dispose tears down the material and segment texture', () => {
    const result = createHankinShaderMaterial({
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
