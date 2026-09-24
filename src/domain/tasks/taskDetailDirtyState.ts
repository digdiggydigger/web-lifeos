/** `TaskDetailDirtyState` + `TaskDetailAutosave`: what counts as unsaved, and when leaving should save. */
import { DEFAULT_DURATION_SECONDS } from '@/domain/focus/focusSprintConfiguration';
import type { Task } from '@/domain/types';

import { isEmptyDelta, normalizeUpdateTaskInput } from './taskUpdateValidation';
import type { TaskEditedFields } from './taskUpdateValidation';

export interface TaskDetailDirtyState {
  readonly hasUnsavedChanges: boolean;
  readonly isDueDateDirty: boolean;
}

export function taskDetailDirtyState(
  original: Task,
  edited: TaskEditedFields,
  defaultSprintSeconds = DEFAULT_DURATION_SECONDS,
): TaskDetailDirtyState {
  const isDueDateDirty = edited.dueDate?.getTime() !== original.dueDate?.getTime();
  const result = normalizeUpdateTaskInput(original, edited, defaultSprintSeconds);
  return { hasUnsavedChanges: result.ok ? !isEmptyDelta(result.value) : true, isDueDateDirty };
}

/** Exactly the Save button's enabled condition. */
export function shouldAutosave(
  hasUnsavedChanges: boolean,
  title: string,
  isSaving: boolean,
): boolean {
  return hasUnsavedChanges && !isSaving && title.trim().length > 0;
}
