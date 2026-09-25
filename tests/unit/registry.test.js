import { describe, it, expect } from 'vitest';
import { tools } from '../../src/tools/index.js';

describe('tool registry', () => {
  it('is a non-empty list', () => {
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('has unique, URL-safe ids', () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 'home' is page 0 in the deck; a tool with that id would collide with it.
    expect(ids).not.toContain('home');
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(tools.map((t) => [t.id, t]))('%s has name, blurb and a lazy load()', (_, tool) => {
    expect(typeof tool.name).toBe('string');
    expect(tool.name.trim()).not.toBe('');
    expect(typeof tool.blurb).toBe('string');
    expect(tool.blurb.trim()).not.toBe('');
    // Not called: loading the component is the deck's job, on first visit.
    expect(typeof tool.load).toBe('function');
  });

  it('includes Tonspur', () => {
    expect(tools.find((t) => t.id === 'tonspur')?.name).toBe('Tonspur');
  });
});
