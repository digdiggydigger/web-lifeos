/** `Capture/ComposerDraftFiling.swift`: what a closed composer keeps, and how the capsule names it. */

export const DRAFT_SUBJECT_LIMIT = 80;

export function shouldFileDraft(text: string): boolean {
  return text.trim().length > 0;
}

/** The first non-blank line, trimmed, cut with an ellipsis past the limit. */
export function draftSubject(text: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  const chars = Array.from(firstLine);
  if (chars.length <= DRAFT_SUBJECT_LIMIT) return firstLine;
  return `${chars.slice(0, DRAFT_SUBJECT_LIMIT - 1).join('')}…`;
}
