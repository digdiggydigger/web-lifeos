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

/** The editor's partial update: name and/or colour (emoji) plus the palette fragment. Empty when nothing changed. */
export function lifeAreaUpdate(input: {
  readonly name?: string;
  readonly colour?: string;
  readonly palette: LifeAreaPaletteEdit;
}): Fields {
  const fields: Fields = {};
  if (input.name !== undefined) fields['name'] = input.name;
  if (input.colour !== undefined) fields['colour'] = input.colour;
  return { ...fields, ...lifeAreaPalette(input.palette) };
}

/** Archive / unarchive writes the boolean; unarchiving writes `false` rather than clearing the field. */
export function lifeAreaArchived(archived: boolean): Fields {
  return { archived };
}
