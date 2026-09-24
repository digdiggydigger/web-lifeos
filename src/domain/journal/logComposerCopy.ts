/** `Journal/LogComposerCopy.swift`: the composer's voice. */
import type { LogType } from '@/domain/types';

export const COMPOSER_GUIDANCE = 'One honest line about now is enough.';
export const COMPOSER_FOOTER = 'Entries are append-only — saved means saved.';
export const COMPOSER_PLACEHOLDER = "What's on your mind?";

export function composerExplainer(type: LogType): string {
  return type === 'log'
    ? 'A quick line, saved as-is — no questions asked.'
    : 'A fuller entry — energy and mood ride along.';
}

/** Off wins over a stale place line. Places arrive in Phase 3; the copy is ported with its tests now. */
export function locationSubtitle(attach: boolean, placeLine: string | undefined): string {
  if (!attach) return "This entry won't record where you made it.";
  if (!placeLine) return 'This entry will record where you made it.';
  return `This entry will record you're ${placeLine}.`;
}
