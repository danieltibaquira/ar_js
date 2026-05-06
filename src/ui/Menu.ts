/**
 * Sketch menu UI. Subscribes to a `SketchRegistry` and renders one button per
 * registered sketch. Clicking a button fires `onSelect(id)`. The active
 * sketch is marked with `is-active` and survives registry-driven re-renders.
 */

import type { SketchEntry, SketchRegistry } from '../core/Registry';

export interface MenuOptions {
  readonly host: HTMLElement;
  readonly registry: SketchRegistry;
  readonly onSelect: (id: string) => void;
  readonly className?: string;
}

export class Menu {
  private readonly host: HTMLElement;
  private readonly onSelect: (id: string) => void;
  private readonly root: HTMLElement;
  private readonly unsubscribe: () => void;
  private activeId: string | null = null;
  private currentEntries: readonly SketchEntry[] = [];

  constructor(options: MenuOptions) {
    this.host = options.host;
    this.onSelect = options.onSelect;
    this.root = document.createElement('nav');
    this.root.className = options.className ?? 'sketch-menu';
    this.host.appendChild(this.root);
    this.unsubscribe = options.registry.subscribe((entries) => {
      this.currentEntries = entries;
      this.render();
    });
  }

  setActive(id: string | null): void {
    this.activeId = id;
    this.applyActiveState();
  }

  dispose(): void {
    this.unsubscribe();
    this.root.remove();
  }

  private render(): void {
    this.root.replaceChildren();
    for (const entry of this.currentEntries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sketchId'] = entry.id;
      btn.textContent = entry.title;
      btn.addEventListener('click', () => this.onSelect(entry.id));
      this.root.appendChild(btn);
    }
    this.applyActiveState();
  }

  private applyActiveState(): void {
    for (const btn of this.root.querySelectorAll<HTMLButtonElement>('button')) {
      btn.classList.toggle(
        'is-active',
        btn.dataset['sketchId'] === this.activeId,
      );
    }
  }
}
