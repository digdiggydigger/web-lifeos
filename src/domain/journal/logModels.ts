/** `Journal/LogModels.swift`: the readouts for energy and mood. The raw values are the wire contract. */
import { ENERGY_LEVELS } from '@/domain/types';
import type { EnergyLevel } from '@/domain/types';

export { ENERGY_LEVELS };

/** Paired with the title everywhere it is shown: meaning never rides on a glyph alone. */
export function energyGlyph(level: EnergyLevel): string {
  return { low: '🪫', medium: '⚡', high: '🔥' }[level];
}

export function energyTitle(level: EnergyLevel): string {
  return { low: 'Low', medium: 'Medium', high: 'High' }[level];
}

export function energyDetail(level: EnergyLevel): string {
  return { low: 'Fatigue', medium: 'Steady', high: 'Hyperfocus' }[level];
}

/** The journal list's chip, mirroring the web prototype's `{energyLevel} energy`. */
export function energyChipLabel(level: EnergyLevel): string {
  return `${level} energy`;
}

/** The mood palette, verbatim from the prototype's `moodOptions`; the first is the composer's start. */
export const JOURNAL_MOOD_OPTIONS: readonly string[] = [
  '⚡',
  '🔥',
  '🧘',
  '🔋',
  '😴',
  '🧠',
  '🌊',
  '🎯',
];
export const DEFAULT_MOOD_EMOJI = JOURNAL_MOOD_OPTIONS[0]!;
export const DEFAULT_ENERGY_LEVEL: EnergyLevel = 'medium';
