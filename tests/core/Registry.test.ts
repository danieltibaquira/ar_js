import { describe, expect, it } from 'vitest';
import { SketchRegistry } from '../../src/core/Registry';
import type { Sketch } from '../../src/core/SketchRunner';

function stubSketch(id: string, title?: string): Sketch {
  return {
    id,
    ...(title !== undefined ? { title } : {}),
    init: () => {},
    dispose: () => {},
  };
}

describe('SketchRegistry', () => {
  it('registers and retrieves a sketch by id', () => {
    const reg = new SketchRegistry();
    const sketch = stubSketch('a', 'Sketch A');
    reg.register(sketch);
    const entry = reg.get('a');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('a');
    expect(entry!.title).toBe('Sketch A');
    expect(entry!.sketch).toBe(sketch);
  });

  it('falls back to id when title is missing', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('only-id'));
    expect(reg.get('only-id')!.title).toBe('only-id');
  });

  it('throws on duplicate id', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    expect(() => reg.register(stubSketch('a'))).toThrow(/already registered/);
  });

  it('returns undefined for unknown id', () => {
    const reg = new SketchRegistry();
    expect(reg.get('nope')).toBeUndefined();
  });

  it('list returns entries in insertion order', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    reg.register(stubSketch('b'));
    reg.register(stubSketch('c'));
    expect(reg.list().map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('unregister removes entries and reports the deletion', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    expect(reg.unregister('a')).toBe(true);
    expect(reg.get('a')).toBeUndefined();
    expect(reg.unregister('a')).toBe(false);
  });

  it('subscribe fires immediately with the current snapshot', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    const seen: string[][] = [];
    reg.subscribe((entries) => {
      seen.push(entries.map((e) => e.id));
    });
    expect(seen).toEqual([['a']]);
  });

  it('subscribe fires on register and unregister', () => {
    const reg = new SketchRegistry();
    const seen: string[][] = [];
    reg.subscribe((entries) => {
      seen.push(entries.map((e) => e.id));
    });
    reg.register(stubSketch('a'));
    reg.register(stubSketch('b'));
    reg.unregister('a');
    expect(seen).toEqual([[], ['a'], ['a', 'b'], ['b']]);
  });

  it('unsubscribe stops further notifications', () => {
    const reg = new SketchRegistry();
    let count = 0;
    const off = reg.subscribe(() => {
      count += 1;
    });
    reg.register(stubSketch('a'));
    off();
    reg.register(stubSketch('b'));
    expect(count).toBe(2); // initial snapshot + first register
  });
});
