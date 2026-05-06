/**
 * Sketch registry. Add a sketch with one `register()` call; the entry is
 * keyed by `sketch.id`. Subscribers receive a snapshot on subscribe and on
 * every subsequent change, which is what lets the Menu (and any other UI)
 * stay in sync without manual wiring.
 */

import type { Sketch } from './SketchRunner';

export interface SketchEntry {
  readonly id: string;
  readonly title: string;
  readonly sketch: Sketch;
}

export type RegistryListener = (entries: readonly SketchEntry[]) => void;

export class SketchRegistry {
  private readonly entries = new Map<string, SketchEntry>();
  private readonly listeners = new Set<RegistryListener>();

  register(sketch: Sketch): void {
    if (this.entries.has(sketch.id)) {
      throw new Error(
        `SketchRegistry: id "${sketch.id}" already registered`,
      );
    }
    this.entries.set(sketch.id, {
      id: sketch.id,
      title: sketch.title ?? sketch.id,
      sketch,
    });
    this.notify();
  }

  unregister(id: string): boolean {
    const ok = this.entries.delete(id);
    if (ok) this.notify();
    return ok;
  }

  get(id: string): SketchEntry | undefined {
    return this.entries.get(id);
  }

  list(): readonly SketchEntry[] {
    return Array.from(this.entries.values());
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.list();
    for (const listener of this.listeners) listener(snapshot);
  }
}
