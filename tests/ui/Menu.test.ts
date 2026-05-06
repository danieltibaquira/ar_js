import { describe, expect, it, beforeEach } from 'vitest';
import { Menu } from '../../src/ui/Menu';
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

function buttonIds(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .map((b) => b.dataset['sketchId'] ?? '')
    .filter(Boolean);
}

describe('Menu', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('renders one button per registered sketch with its title', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a', 'Alpha'));
    reg.register(stubSketch('b', 'Beta'));
    new Menu({ host, registry: reg, onSelect: () => {} });
    const labels = Array.from(host.querySelectorAll('button')).map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Alpha', 'Beta']);
  });

  it('reacts to registry changes without manual wiring', () => {
    const reg = new SketchRegistry();
    new Menu({ host, registry: reg, onSelect: () => {} });
    expect(buttonIds(host)).toEqual([]);
    reg.register(stubSketch('a'));
    expect(buttonIds(host)).toEqual(['a']);
    reg.register(stubSketch('b'));
    expect(buttonIds(host)).toEqual(['a', 'b']);
    reg.unregister('a');
    expect(buttonIds(host)).toEqual(['b']);
  });

  it('fires onSelect with the sketch id on click', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    reg.register(stubSketch('b'));
    const selected: string[] = [];
    new Menu({ host, registry: reg, onSelect: (id) => selected.push(id) });
    const btnB = host.querySelector<HTMLButtonElement>(
      'button[data-sketch-id="b"]',
    )!;
    btnB.click();
    expect(selected).toEqual(['b']);
  });

  it('marks the active sketch via setActive', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    reg.register(stubSketch('b'));
    const menu = new Menu({ host, registry: reg, onSelect: () => {} });
    menu.setActive('b');
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
    const active = buttons.find((b) => b.classList.contains('is-active'));
    expect(active?.dataset['sketchId']).toBe('b');
  });

  it('keeps the active marker when the registry re-renders', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    const menu = new Menu({ host, registry: reg, onSelect: () => {} });
    menu.setActive('a');
    reg.register(stubSketch('b'));
    const activeIds = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button.is-active'),
    ).map((b) => b.dataset['sketchId']);
    expect(activeIds).toEqual(['a']);
  });

  it('dispose removes the menu DOM and stops reacting to registry changes', () => {
    const reg = new SketchRegistry();
    reg.register(stubSketch('a'));
    const menu = new Menu({ host, registry: reg, onSelect: () => {} });
    expect(host.children.length).toBeGreaterThan(0);
    menu.dispose();
    expect(host.children.length).toBe(0);
    reg.register(stubSketch('b'));
    expect(host.children.length).toBe(0);
  });
});
