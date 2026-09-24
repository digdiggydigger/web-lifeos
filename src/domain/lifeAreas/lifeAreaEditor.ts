/** `LifeAreaEditor/LifeAreaEditorValidation.swift`, `LifeAreaEditorPresentation.swift`, `Theme/EmojiPicker.swift`'s validation. */
import type { LifeArea } from '@/domain/types';

export type RenameChange =
  | { readonly kind: 'invalidEmpty' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'valid'; readonly name: string };

/** Trimmed, compared case-sensitively (the case-insensitive clash check is the data layer's). */
export function renameChange(current: string, proposed: string): RenameChange {
  const trimmed = proposed.trim();
  if (trimmed.length === 0) return { kind: 'invalidEmpty' };
  if (trimmed === current.trim()) return { kind: 'unchanged' };
  return { kind: 'valid', name: trimmed };
}

export function normalizeNewName(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export type EmojiValidation =
  | { readonly kind: 'invalidEmpty' }
  | { readonly kind: 'invalidNotSingleGlyph' }
  | { readonly kind: 'valid'; readonly emoji: string };

export const SINGLE_EMOJI_ERROR = 'Enter a single emoji.';

function graphemeCount(text: string): number {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string,
        o?: { granularity: string },
      ) => { segment(s: string): Iterable<unknown> };
    }
  ).Segmenter;
  if (Segmenter)
    return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
  return Array.from(text).length;
}

/** Exactly one extended grapheme cluster after trimming: a family ZWJ emoji is one, "ab" and "🏠💼" are two. */
export function validateEmoji(raw: string): EmojiValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: 'invalidEmpty' };
  if (graphemeCount(trimmed) !== 1) return { kind: 'invalidNotSingleGlyph' };
  return { kind: 'valid', emoji: trimmed };
}

/** `EmojiPalette.lifeArea`: 40 glyphs, the first is the default for a new area. */
export const LIFE_AREA_EMOJI: readonly string[] = [
  '🏠',
  '💼',
  '💪',
  '🧠',
  '❤️',
  '👨‍👩‍👧‍👦',
  '💰',
  '📚',
  '🎯',
  '✅',
  '🎨',
  '🎵',
  '🏃',
  '🧘',
  '🍎',
  '🌱',
  '✈️',
  '🛠️',
  '📝',
  '🗂️',
  '📅',
  '💡',
  '🔧',
  '🎮',
  '🐶',
  '🌍',
  '⚽️',
  '🎬',
  '🍳',
  '🛒',
  '💊',
  '🚗',
  '✏️',
  '📱',
  '💻',
  '🎓',
  '🏥',
  '🧹',
  '🌿',
  '⭐️',
];
export const DEFAULT_LIFE_AREA_EMOJI = LIFE_AREA_EMOJI[0]!;

export function partitionLifeAreas(areas: readonly LifeArea[]): {
  active: LifeArea[];
  archived: LifeArea[];
} {
  const bySort = (a: LifeArea, b: LifeArea) => a.sortOrder - b.sortOrder;
  return {
    active: areas.filter((a) => !a.archived).sort(bySort),
    archived: areas.filter((a) => a.archived).sort(bySort),
  };
}

export const ARCHIVED_BADGE = 'Archived';

export function createConflictTitle(name: string): string {
  return `“${name}” already exists`;
}
export function createConflictMessage(name: string, holderArchived: boolean): string {
  return holderArchived
    ? `You already have an archived life area called “${name}”. Unarchive it instead of making a new one?`
    : `You already have a life area called “${name}”. Pick a different name.`;
}
export function renameConflictTitle(name: string): string {
  return `“${name}” is taken`;
}
export function renameConflictMessage(name: string, holderArchived: boolean): string {
  return holderArchived
    ? `That name is taken by an archived life area called “${name}”. Choose a different name.`
    : `You already have a life area called “${name}”. Choose a different name.`;
}

export function activeAreasFooter(count: number): string {
  return count === 1 ? '1 active area' : `${count} active areas`;
}

/** `LifeAreaReorderPayload.completeOrder`: the dragged active order, then archived by sort order; never partial. */
export function completeOrder(
  activeInNewOrder: readonly LifeArea[],
  archived: readonly LifeArea[],
): string[] {
  return [
    ...activeInNewOrder.map((a) => a.id),
    ...[...archived].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => a.id),
  ];
}

/** `LifeAreaPicker.isRowDisabled`. */
export function isPickerRowDisabled(
  area: Pick<LifeArea, 'archived'>,
  isSelected: boolean,
): boolean {
  return area.archived && !isSelected;
}

/** Case-insensitive name clash among `areas`, excluding `excludingId`; the holder decides the copy. */
export function findNameClash(
  areas: readonly LifeArea[],
  name: string,
  excludingId?: string,
): LifeArea | undefined {
  const wanted = name.trim().toLocaleLowerCase();
  return areas.find((a) => a.id !== excludingId && a.name.toLocaleLowerCase() === wanted);
}

/** New areas append after the highest sort order, or start at zero. */
export function nextSortOrder(areas: readonly Pick<LifeArea, 'sortOrder'>[]): number {
  return areas.length === 0 ? 0 : Math.max(...areas.map((a) => a.sortOrder)) + 1;
}
