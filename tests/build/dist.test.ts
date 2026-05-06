/**
 * Build smoke test. Validates the static-host-ready output of `vite build`.
 * Skipped automatically when `dist/` is missing (so `npm test` works on a
 * clean checkout); CI runs `npm run build && npm test` to exercise it.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const haveBuild = existsSync(distDir);

describe.skipIf(!haveBuild)('vite build output', () => {
  it('emits dist/index.html', () => {
    expect(existsSync(join(distDir, 'index.html'))).toBe(true);
  });

  it('html references its bundle via a relative URL (works on any static host)', () => {
    const html = readFileSync(join(distDir, 'index.html'), 'utf8');
    const match = html.match(/<script[^>]+src="([^"]+)"/);
    expect(match).not.toBeNull();
    const src = match![1]!;
    expect(src.startsWith('./') || src.startsWith('/')).toBe(true);
    expect(src).not.toMatch(/^https?:/);
  });

  it('preloads the heavy vendor chunks (three, tweakpane)', () => {
    const html = readFileSync(join(distDir, 'index.html'), 'utf8');
    expect(html).toMatch(/modulepreload[^>]*three-/);
    expect(html).toMatch(/modulepreload[^>]*tweakpane-/);
  });

  it('emits separate chunks for the heavy vendors so they cache independently', () => {
    const assets = readdirSync(join(distDir, 'assets'));
    const jsAssets = assets.filter((a) => a.endsWith('.js'));
    expect(jsAssets.some((a) => /^three-/.test(a))).toBe(true);
    expect(jsAssets.some((a) => /^tweakpane-/.test(a))).toBe(true);
    expect(jsAssets.some((a) => /^index-/.test(a))).toBe(true);
  });

  it('total gzipped JS payload is under the v1.0 §2.8 broadband budget', () => {
    // Rough budget: 600 kB gzip is the B-01 ceiling; v1.0 §2.8 demands
    // < 2 s on broadband (≈ 10 Mbps → 1.25 MB/s → 2.5 MB in 2 s), so we're
    // well inside. We assert against the B-01 ceiling for a sanity guard.
    const total = readdirSync(join(distDir, 'assets'))
      .filter((a) => a.endsWith('.js'))
      .map((a) => statSync(join(distDir, 'assets', a)).size)
      .reduce((acc, n) => acc + n, 0);
    // Raw size; gzip is ~3.5–4× smaller. 2.4 MB raw ≈ 600 kB gzip.
    expect(total).toBeLessThan(2_400_000);
  });

  it('app entry chunk is significantly smaller than three.js (vendor split worked)', () => {
    const assetsDir = join(distDir, 'assets');
    const sizeFor = (prefix: string): number => {
      const file = readdirSync(assetsDir).find(
        (a) => a.startsWith(prefix) && a.endsWith('.js'),
      );
      return file ? statSync(join(assetsDir, file)).size : 0;
    };
    expect(sizeFor('index-')).toBeLessThan(sizeFor('three-'));
  });
});
