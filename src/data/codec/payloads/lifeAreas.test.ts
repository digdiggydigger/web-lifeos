import { describe, expect, it } from 'vitest';

import { isFieldDelete } from '../fields';
import { lifeAreaPalette, lifeAreaPaletteEdit, lifeAreaSortOrders } from './lifeAreas';

describe('lifeAreaPaletteEdit', () => {
  it('derives unchanged / set / automatic from the document and the editor', () => {
    expect(lifeAreaPaletteEdit('work', 'work')).toEqual({ kind: 'unchanged' });
    expect(lifeAreaPaletteEdit(undefined, undefined)).toEqual({ kind: 'unchanged' });
    expect(lifeAreaPaletteEdit(undefined, 'health')).toEqual({ kind: 'set', key: 'health' });
    expect(lifeAreaPaletteEdit('work', undefined)).toEqual({ kind: 'automatic' });
  });
});

describe('lifeAreaPalette', () => {
  it('writes nothing, the key, or a delete: absence is the one representation of automatic', () => {
    expect(lifeAreaPalette({ kind: 'unchanged' })).toEqual({});
    expect(lifeAreaPalette({ kind: 'set', key: 'growth' })).toEqual({ palette: 'growth' });
    const automatic = lifeAreaPalette({ kind: 'automatic' });
    expect(Object.keys(automatic)).toEqual(['palette']);
    expect(isFieldDelete(automatic['palette'])).toBe(true);
  });
});

describe('lifeAreaSortOrders', () => {
  it('maps the complete order onto sort_order by index', () => {
    expect(lifeAreaSortOrders(['B', 'A', 'C'])).toEqual([
      { id: 'B', fields: { sort_order: 0 } },
      { id: 'A', fields: { sort_order: 1 } },
      { id: 'C', fields: { sort_order: 2 } },
    ]);
  });
});

describe('lifeAreaUpdate / lifeAreaArchived', () => {
  it('writes only the keys given, with the palette fragment, and archived as a plain boolean', async () => {
    const { lifeAreaArchived, lifeAreaUpdate } = await import('./lifeAreas');
    expect(lifeAreaUpdate({ palette: { kind: 'unchanged' } })).toEqual({});
    expect(lifeAreaUpdate({ name: 'Career', palette: { kind: 'unchanged' } })).toEqual({
      name: 'Career',
    });
    expect(lifeAreaUpdate({ colour: '💼', palette: { kind: 'set', key: 'growth' } })).toEqual({
      colour: '💼',
      palette: 'growth',
    });
    expect(
      Object.keys(
        lifeAreaUpdate({ name: 'A', colour: 'B', palette: { kind: 'automatic' } }),
      ).sort(),
    ).toEqual(['colour', 'name', 'palette']);
    expect(lifeAreaArchived(false)).toEqual({ archived: false });
  });
});
