/** `Theme/AreaPalette.swift`: which colour family an area paints with. */
import type { LifeArea } from '@/domain/types';

export type AreaFamily =
  'work' | 'health' | 'admin' | 'growth' | 'hobby' | 'green' | 'orange' | 'red' | 'slate';
export const AREA_FAMILIES: readonly AreaFamily[] = [
  'work',
  'health',
  'admin',
  'growth',
  'hobby',
  'green',
  'orange',
  'red',
  'slate',
];

export function familyDisplayName(family: AreaFamily): string {
  return {
    work: 'Blue',
    health: 'Teal',
    admin: 'Gold',
    growth: 'Purple',
    hobby: 'Pink',
    green: 'Green',
    orange: 'Orange',
    red: 'Red',
    slate: 'Slate',
  }[family];
}

/** The wire key IS the family name; asset-catalog names ("AreaWork") are not keys. */
export function familyFromKey(key: string | undefined): AreaFamily | undefined {
  return (AREA_FAMILIES as readonly string[]).includes(key ?? '') ? (key as AreaFamily) : undefined;
}

/** The token names generated from the asset catalog (`--color-area-work`, `-vivid`, `-tint`, `--color-on-area-work`). */
export function familyTokens(family: AreaFamily): {
  base: string;
  vivid: string;
  tint: string;
  on: string;
} {
  return {
    base: `area-${family}`,
    vivid: `area-${family}-vivid`,
    tint: `area-${family}-tint`,
    on: `on-area-${family}`,
  };
}

const EMOJI_FAMILIES: Readonly<Record<string, AreaFamily>> = {
  '🫀': 'health',
  '🏋': 'health',
  '💼': 'work',
  '🏠': 'admin',
  '📝': 'admin',
  '💰': 'admin',
  '🌱': 'growth',
  '🧘': 'growth',
  '💬': 'hobby',
  '🎨': 'hobby',
};

const AUTOMATIC_FAMILIES: readonly AreaFamily[] = ['work', 'health', 'admin', 'growth', 'hobby'];

/** Stored key wins (an unknown key is ignored); then the emoji table; then a UUID-stable pick from the original five. */
export function familyFor(area: Pick<LifeArea, 'id' | 'colour' | 'palette'>): AreaFamily {
  const stored = familyFromKey(area.palette);
  if (stored) return stored;
  const mapped = EMOJI_FAMILIES[area.colour.replace(/️/g, '')];
  if (mapped) return mapped;
  const firstByte = Number.parseInt(area.id.slice(0, 2), 16);
  return AUTOMATIC_FAMILIES[(Number.isNaN(firstByte) ? 0 : firstByte) % AUTOMATIC_FAMILIES.length]!;
}
