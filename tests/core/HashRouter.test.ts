import { describe, expect, it, beforeEach } from 'vitest';
import {
  parseHash,
  serializeHash,
  HashRouter,
  type ParsedRoute,
} from '../../src/core/HashRouter';

interface FakeWindow {
  location: { hash: string };
  addEventListener: (
    type: 'hashchange',
    listener: EventListener,
  ) => void;
  removeEventListener: (
    type: 'hashchange',
    listener: EventListener,
  ) => void;
  dispatchHashChange: () => void;
}

function makeWindow(initialHash = ''): FakeWindow {
  const listeners = new Set<EventListener>();
  const win: FakeWindow = {
    location: { hash: initialHash },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    dispatchHashChange: () => {
      const ev = { type: 'hashchange' } as unknown as Event;
      for (const l of listeners) l(ev);
    },
  };
  return win;
}

describe('parseHash', () => {
  it('returns null sketchId for an empty hash', () => {
    expect(parseHash('')).toEqual({ sketchId: null, params: {} });
    expect(parseHash('#')).toEqual({ sketchId: null, params: {} });
  });

  it('parses a bare sketch id', () => {
    expect(parseHash('#hankin-square')).toEqual({
      sketchId: 'hankin-square',
      params: {},
    });
  });

  it('parses params after the ? separator', () => {
    expect(parseHash('#hankin-square?angle=0.7&rows=5')).toEqual({
      sketchId: 'hankin-square',
      params: { angle: '0.7', rows: '5' },
    });
  });

  it('decodes percent-encoded values', () => {
    expect(parseHash('#sketch?label=hello%20world')).toEqual({
      sketchId: 'sketch',
      params: { label: 'hello world' },
    });
  });

  it('treats ill-formed value-less keys as empty strings', () => {
    expect(parseHash('#sketch?flag&other=1')).toEqual({
      sketchId: 'sketch',
      params: { flag: '', other: '1' },
    });
  });
});

describe('serializeHash', () => {
  it('emits #id when there are no params', () => {
    expect(serializeHash('hankin-square', {})).toBe('#hankin-square');
  });

  it('emits sorted params after the ? separator', () => {
    // Sorted keys → deterministic URL even for equivalent input objects.
    expect(serializeHash('id', { b: 2, a: 1 })).toBe('#id?a=1&b=2');
  });

  it('coerces boolean and number values to strings', () => {
    expect(serializeHash('s', { n: 0.5, on: true, off: false })).toBe(
      '#s?n=0.5&off=false&on=true',
    );
  });

  it('percent-encodes special characters', () => {
    expect(serializeHash('s', { q: 'hello world & friends' })).toBe(
      '#s?q=hello%20world%20%26%20friends',
    );
  });

  it('round-trips parseHash ∘ serializeHash for plain string params', () => {
    const route = parseHash(
      serializeHash('id', { angle: 0.5, mode: 'neon' }),
    );
    expect(route).toEqual({
      sketchId: 'id',
      params: { angle: '0.5', mode: 'neon' },
    });
  });
});

describe('HashRouter', () => {
  let win: FakeWindow;
  beforeEach(() => {
    win = makeWindow('');
  });

  it('exposes the current route on demand', () => {
    win.location.hash = '#a?x=1';
    const router = new HashRouter({
      window: win,
      onRoute: () => {},
    });
    expect(router.current()).toEqual({
      sketchId: 'a',
      params: { x: '1' },
    });
    router.dispose();
  });

  it('fires onRoute on construction with the current route', () => {
    win.location.hash = '#initial';
    const seen: ParsedRoute[] = [];
    const router = new HashRouter({
      window: win,
      onRoute: (r) => seen.push(r),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.sketchId).toBe('initial');
    router.dispose();
  });

  it('reacts to hashchange events', () => {
    const seen: string[] = [];
    const router = new HashRouter({
      window: win,
      onRoute: (r) => {
        if (r.sketchId !== null) seen.push(r.sketchId);
      },
    });
    seen.length = 0;
    win.location.hash = '#new';
    win.dispatchHashChange();
    expect(seen).toEqual(['new']);
    router.dispose();
  });

  it('setRoute updates the hash and suppresses the self-triggered callback', () => {
    const seen: ParsedRoute[] = [];
    const router = new HashRouter({
      window: win,
      onRoute: (r) => seen.push(r),
    });
    seen.length = 0;
    router.setRoute('id', { angle: 0.5 });
    expect(win.location.hash).toBe('#id?angle=0.5');
    win.dispatchHashChange();
    // Self-triggered hashchange must not call onRoute.
    expect(seen).toHaveLength(0);
  });

  it('does NOT update the URL when the route is identical to the current one', () => {
    win.location.hash = '#id?a=1';
    const router = new HashRouter({
      window: win,
      onRoute: () => {},
    });
    router.setRoute('id', { a: 1 });
    expect(win.location.hash).toBe('#id?a=1');
    router.dispose();
  });

  it('dispose stops listening for hashchange events', () => {
    const seen: ParsedRoute[] = [];
    const router = new HashRouter({
      window: win,
      onRoute: (r) => seen.push(r),
    });
    seen.length = 0;
    router.dispose();
    win.location.hash = '#after-dispose';
    win.dispatchHashChange();
    expect(seen).toHaveLength(0);
  });
});
