import { describe, expect, it } from 'vitest';
import { renderToSVG } from '../../src/render/svg';
import { hankinPattern } from '../../src/geometry/hankin';
import { squareTiling } from '../../src/geometry/tilings';
import type { Pattern } from '../../src/geometry/types';

function parseSVG(source: string): Document {
  // happy-dom returns a Document with null documentElement for
  // 'image/svg+xml'; 'text/xml' works.
  return new DOMParser().parseFromString(source, 'text/xml');
}

describe('renderToSVG', () => {
  it('returns a string starting with <svg and declares the SVG namespace', () => {
    const svg = renderToSVG({ strapSegments: [] }, { width: 200, height: 200 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('output is valid XML (parses without errors)', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const svg = renderToSVG(pattern, { width: 400, height: 400 });
    const doc = parseSVG(svg);
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    // The document must contain an <svg> element with our namespace.
    expect(doc.getElementsByTagName('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('width / height / viewBox match the supplied dimensions', () => {
    const svg = renderToSVG(
      { strapSegments: [] },
      { width: 320, height: 240 },
    );
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="240"');
    expect(svg).toContain('viewBox="0 0 320 240"');
  });

  it('renders a strap path with one moveTo + lineTo per segment', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } },
      ],
    };
    const svg = renderToSVG(pattern, { width: 200, height: 200 });
    const root = parseSVG(svg).documentElement;
    const strapPath = root.querySelector('path.straps, g.straps path');
    expect(strapPath).not.toBeNull();
    const d = strapPath!.getAttribute('d') ?? '';
    expect((d.match(/M /g) ?? []).length).toBe(2);
    expect((d.match(/L /g) ?? []).length).toBe(2);
  });

  it('emits a background rect when configured', () => {
    const svg = renderToSVG(
      { strapSegments: [] },
      { width: 100, height: 50, background: '#0b0b0d' },
    );
    const root = parseSVG(svg).documentElement;
    const rect = root.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute('fill')).toBe('#0b0b0d');
    expect(rect!.getAttribute('width')).toBe('100');
    expect(rect!.getAttribute('height')).toBe('50');
  });

  it('omits the background rect by default', () => {
    const svg = renderToSVG({ strapSegments: [] }, { width: 100, height: 100 });
    const root = parseSVG(svg).documentElement;
    expect(root.querySelector('rect')).toBeNull();
  });

  it('includes a construction-line group when showConstructionLines is true', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const svg = renderToSVG(pattern, {
      width: 200,
      height: 200,
      showConstructionLines: true,
    });
    const root = parseSVG(svg).documentElement;
    const group = root.querySelector('g.construction');
    expect(group).not.toBeNull();
  });

  it('omits the construction group by default', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const svg = renderToSVG(pattern, { width: 200, height: 200 });
    const root = parseSVG(svg).documentElement;
    expect(root.querySelector('g.construction')).toBeNull();
  });

  it('produces identical output for identical inputs (snapshot stability)', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const a = renderToSVG(pattern, { width: 400, height: 400 });
    const b = renderToSVG(pattern, { width: 400, height: 400 });
    expect(a).toBe(b);
  });

  it('strap path count matches strap segment count (round-trippable)', () => {
    const tiling = squareTiling({ rows: 2, cols: 2, size: 1 });
    const pattern = hankinPattern(tiling, { contactAngle: Math.PI / 4 });
    const svg = renderToSVG(pattern, { width: 400, height: 400 });
    const root = parseSVG(svg).documentElement;
    const d =
      root.querySelector('g.straps path')?.getAttribute('d') ?? '';
    expect((d.match(/M /g) ?? []).length).toBe(pattern.strapSegments.length);
  });

  it('honours the precision option for coordinate formatting', () => {
    const pattern: Pattern = {
      strapSegments: [
        { p1: { x: 1.123456789, y: 2 }, p2: { x: 3, y: 4 } },
      ],
    };
    const svg = renderToSVG(pattern, {
      width: 100,
      height: 100,
      precision: 1,
    });
    expect(svg).toContain('M ');
    // No more than 1 fractional digit anywhere in the path.
    const paths = svg.match(/d="[^"]*"/g) ?? [];
    for (const p of paths) {
      const fracs = p.match(/\.(\d+)/g) ?? [];
      for (const f of fracs) expect(f.length - 1).toBeLessThanOrEqual(1);
    }
  });

  it('rejects non-positive dimensions', () => {
    expect(() =>
      renderToSVG({ strapSegments: [] }, { width: 0, height: 100 }),
    ).toThrow();
    expect(() =>
      renderToSVG({ strapSegments: [] }, { width: 100, height: -1 }),
    ).toThrow();
  });
});
