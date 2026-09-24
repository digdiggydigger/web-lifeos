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
