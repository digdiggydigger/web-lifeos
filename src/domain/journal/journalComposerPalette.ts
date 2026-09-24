/**
 * `Journal/JournalComposerPalette.swift`: a journal entry is written on paper, a quick log on the
 * ordinary page. The values are Tailwind token classes (the iOS asset names, one to one).
 */
import type { LogType } from '@/domain/types';

export interface ComposerChipPalette {
  readonly quietSurface: string;
  readonly quietLabel: string;
  readonly selectedFill: string;
  readonly selectedLabel: string;
  readonly softInk: string | undefined;
}

export const ORDINARY_CHIPS: ComposerChipPalette = {
  quietSurface: 'bg-card-surface-secondary',
  quietLabel: 'text-label-secondary',
  selectedFill: 'bg-accent',
  selectedLabel: 'text-on-area-work',
  softInk: undefined,
};

export const PAD_CHIPS: ComposerChipPalette = {
  quietSurface: 'bg-journal-paper-surface',
  quietLabel: 'text-journal-paper-ink',
  selectedFill: 'bg-journal-paper-ink',
  selectedLabel: 'text-journal-paper',
  softInk: 'text-journal-paper-ink',
};

export function isPaper(type: LogType): boolean {
  return type === 'journal';
}

export function composerBackground(type: LogType): string {
  return isPaper(type) ? 'bg-journal-paper' : 'bg-page-background';
}

export function composerChrome(type: LogType): string {
  return isPaper(type) ? 'bg-journal-paper-chrome' : 'bg-page-background';
}

export function composerInk(type: LogType): string {
  return isPaper(type) ? 'text-journal-paper-ink' : 'text-label-primary';
}

export function composerChromeInk(type: LogType): string | undefined {
  return isPaper(type) ? 'text-journal-paper-chrome-ink' : undefined;
}

export function writingSurface(type: LogType): string {
  return isPaper(type) ? 'bg-journal-paper-surface' : 'bg-card-surface-secondary';
}

export function placeholderInk(type: LogType): string | undefined {
  return isPaper(type) ? 'placeholder:text-journal-paper-placeholder' : undefined;
}

export function chipPalette(type: LogType): ComposerChipPalette {
  return isPaper(type) ? PAD_CHIPS : ORDINARY_CHIPS;
}
