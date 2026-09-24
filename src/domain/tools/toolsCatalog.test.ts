// Port of ToolsCatalogTests, plus the web's availability rule.
import { describe, expect, it } from 'vitest';

import { TOOLS_DESTINATIONS, TOOLS_ENTRIES, toolsEntryId } from './index';

describe('ToolsCatalog', () => {
  it('offers both doors with Places first, Places always, Life Areas as a route', () => {
    expect(TOOLS_ENTRIES.map((e) => e.destination)).toEqual(['places', 'lifeAreas']);
    expect(TOOLS_ENTRIES.find((e) => e.destination === 'places')?.availability).toEqual({
      kind: 'phone',
    });
    expect(TOOLS_ENTRIES.find((e) => e.destination === 'lifeAreas')?.availability).toEqual({
      kind: 'route',
      path: '/areas/editor',
    });
  });
  it('every entry carries copy and a glyph, ids are namespaced and unique, the page stays sparse, every destination has an entry', () => {
    for (const entry of TOOLS_ENTRIES) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.caption.length).toBeGreaterThan(0);
      expect(entry.glyph.length).toBeGreaterThan(0);
    }
    const ids = TOOLS_ENTRIES.map(toolsEntryId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('tools-')).toBe(true);
    expect(TOOLS_ENTRIES).toHaveLength(2);
    expect(new Set(TOOLS_ENTRIES.map((e) => e.destination))).toEqual(new Set(TOOLS_DESTINATIONS));
  });
});
