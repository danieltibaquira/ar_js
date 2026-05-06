/**
 * Hash routing for shareable links.
 *
 * URL shape: `#<sketchId>` for the bare sketch, or
 * `#<sketchId>?key=value&...` for a parameter-bound view. Keys are sorted
 * alphabetically when serialised so two equivalent param objects produce
 * the same URL — that is what makes back/forward navigation and copy-paste
 * stable.
 *
 * `parseHash` and `serializeHash` are pure string transforms exported for
 * direct use; `HashRouter` wires them to a window-like object so the page
 * can react to `hashchange` events.
 */

export interface ParsedRoute {
  readonly sketchId: string | null;
  readonly params: Readonly<Record<string, string>>;
}

export type HashValue = string | number | boolean;

export interface HashRouterOptions {
  readonly onRoute: (route: ParsedRoute) => void;
  /** Injectable for testing. Defaults to the global `window`. */
  readonly window?: WindowLike;
}

export interface WindowLike {
  location: { hash: string };
  addEventListener(type: 'hashchange', listener: EventListener): void;
  removeEventListener(type: 'hashchange', listener: EventListener): void;
}

export function parseHash(hash: string): ParsedRoute {
  if (!hash || hash === '#') return { sketchId: null, params: {} };
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = stripped.indexOf('?');
  const sketchId = queryAt === -1 ? stripped : stripped.slice(0, queryAt);
  const query = queryAt === -1 ? '' : stripped.slice(queryAt + 1);

  const params: Record<string, string> = {};
  if (query.length > 0) {
    for (const part of query.split('&')) {
      if (part.length === 0) continue;
      const eq = part.indexOf('=');
      const k = eq === -1 ? part : part.slice(0, eq);
      const v = eq === -1 ? '' : part.slice(eq + 1);
      params[safeDecode(k)] = safeDecode(v);
    }
  }
  return {
    sketchId: sketchId.length === 0 ? null : safeDecode(sketchId),
    params,
  };
}

export function serializeHash(
  sketchId: string,
  params: Readonly<Record<string, HashValue>>,
): string {
  const keys = Object.keys(params).sort();
  if (keys.length === 0) return `#${encodeURIComponent(sketchId)}`;
  const pairs = keys.map(
    (k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`,
  );
  return `#${encodeURIComponent(sketchId)}?${pairs.join('&')}`;
}

export class HashRouter {
  private readonly window: WindowLike;
  private readonly onRoute: (route: ParsedRoute) => void;
  private readonly listener: EventListener;
  private suppressNext = false;
  private disposed = false;

  constructor(options: HashRouterOptions) {
    this.window = options.window ?? (globalThis.window as unknown as WindowLike);
    this.onRoute = options.onRoute;
    this.listener = () => {
      if (this.suppressNext) {
        this.suppressNext = false;
        return;
      }
      if (this.disposed) return;
      this.onRoute(this.current());
    };
    this.window.addEventListener('hashchange', this.listener);
    // Fire once with the current hash so the host can boot from the URL.
    this.onRoute(this.current());
  }

  current(): ParsedRoute {
    return parseHash(this.window.location.hash);
  }

  setRoute(sketchId: string, params: Readonly<Record<string, HashValue>>): void {
    if (this.disposed) return;
    const next = serializeHash(sketchId, params);
    if (this.window.location.hash === next) return;
    this.suppressNext = true;
    this.window.location.hash = next;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.window.removeEventListener('hashchange', this.listener);
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
