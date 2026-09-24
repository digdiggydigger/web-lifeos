/** `TagEditor/TagEditorValidation.swift` + `TagEditorPresentation.swift` + `TagEditorService.sorted`. */
import type { Tag } from '@/domain/types';

export { normalizeNewName, renameChange } from '@/domain/lifeAreas/lifeAreaEditor';

export interface EditableTag extends Tag {
  readonly usageCount: number;
}

export function usagePhrase(count: number): string {
  if (count <= 0) return 'Not used yet';
  return count === 1 ? 'Used on 1 item' : `Used on ${count} items`;
}

export function mergeAlertTitle(conflictingName: string): string {
  return `“${conflictingName}” already exists`;
}

export function mergeAlertMessage(survivorName: string, survivorUsageCount: number): string {
  const usage =
    survivorUsageCount <= 0
      ? `“${survivorName}” isn't used yet.`
      : survivorUsageCount === 1
        ? `“${survivorName}” is used on 1 item.`
        : `“${survivorName}” is used on ${survivorUsageCount} items.`;
  return `${usage} Merge this tag into it? This can't be undone.`;
}

export function tagsFooter(count: number): string {
  return count === 1 ? '1 tag' : `${count} tags`;
}

export function alreadyExistsInfo(name: string): string {
  return `"${name}" already exists.`;
}

export function sortTagsCaseInsensitively<T extends Pick<Tag, 'name'>>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function noOtherTagError(name: string): string {
  return `There's no other tag named "${name}" to merge into.`;
}
