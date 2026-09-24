/**
 * The life-area colour override (`FirestoreFieldPayloads.lifeAreaPalette`): `automatic` ERASES the
 * field, so absence is the one representation of automatic.
 */
import { clear } from '../fields';
import type { Fields } from '../fields';

export type LifeAreaPaletteEdit =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'set'; readonly key: string }
  | { readonly kind: 'automatic' };

/** `LifeAreaPaletteEdit.edit(from:to:)`: derives the edit from what the document holds and what the editor shows. */
export function lifeAreaPaletteEdit(
  current: string | undefined,
  proposed: string | undefined,
): LifeAreaPaletteEdit {
  if (current === proposed) return { kind: 'unchanged' };
  if (proposed === undefined) return { kind: 'automatic' };
  return { kind: 'set', key: proposed };
}

export function lifeAreaPalette(edit: LifeAreaPaletteEdit): Fields {
  switch (edit.kind) {
    case 'unchanged':
      return {};
    case 'set':
      return { palette: edit.key };
    case 'automatic':
      return { palette: clear() };
  }
}

/** A reorder writes the COMPLETE order (active then archived) as one batch: index → `sort_order`. */
export function lifeAreaSortOrders(orderedIds: readonly string[]): ReadonlyArray<{
  readonly id: string;
  readonly fields: Fields;
}> {
  return orderedIds.map((id, index) => ({ id, fields: { sort_order: index } }));
}
