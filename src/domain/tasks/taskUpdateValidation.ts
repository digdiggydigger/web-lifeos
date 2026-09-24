/** `TaskUpdateValidation`: the detail screen's delta, with the focus fields clamped and compared to resolved originals. */
import {
  clampDuration,
  clampNudgeCount,
  DEFAULT_DURATION_SECONDS,
  resolvedDuration,
  resolvedNudgeCount,
} from '@/domain/focus/focusSprintConfiguration';
import type { Task, TaskPriority } from '@/domain/types';

import type { Validated } from './taskCreateValidation';

/** `TaskEditedFields`: what the form holds; `notes` is a string ("" for none). */
export interface TaskEditedFields {
  readonly title: string;
  readonly notes: string;
  readonly lifeAreaId?: string;
  readonly priority: TaskPriority;
  readonly dueDate?: Date;
  readonly focusDurationSeconds?: number;
  readonly nudgesCount?: number;
  readonly atPlaceId?: string;
}

/** Mirrors the codec's `TaskUpdatePayload`: absent = untouched, `null` = clear. */
export interface TaskUpdateDelta {
  readonly title?: string;
  readonly notes?: string | null;
  readonly lifeAreaId?: string | null;
  readonly priority?: TaskPriority;
  readonly dueDate?: Date | null;
  readonly focusDurationSeconds?: number;
  readonly nudgesCount?: number;
  readonly atPlaceId?: string | null;
}

export function isEmptyDelta(delta: TaskUpdateDelta): boolean {
  return Object.keys(delta).length === 0;
}

export function editedFieldsFrom(task: Task): TaskEditedFields {
  return {
    title: task.title,
    notes: task.notes ?? '',
    priority: task.priority,
    ...(task.lifeAreaId ? { lifeAreaId: task.lifeAreaId } : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    ...(task.atPlaceId ? { atPlaceId: task.atPlaceId } : {}),
  };
}

function sameDate(a: Date | undefined, b: Date | undefined): boolean {
  return a?.getTime() === b?.getTime();
}

export function normalizeUpdateTaskInput(
  original: Task,
  edited: TaskEditedFields,
  defaultSprintSeconds = DEFAULT_DURATION_SECONDS,
): Validated<TaskUpdateDelta> {
  const title = edited.title.trim();
  if (title.length === 0) return { ok: false, error: 'emptyTitle' };
  const trimmedNotes = edited.notes.trim();
  const notes = trimmedNotes.length === 0 ? undefined : trimmedNotes;

  const delta: Record<string, unknown> = {};
  if (title !== original.title) delta['title'] = title;
  if (notes !== original.notes) delta['notes'] = notes ?? null;
  if (edited.lifeAreaId !== original.lifeAreaId) delta['lifeAreaId'] = edited.lifeAreaId ?? null;
  if (edited.priority !== original.priority) delta['priority'] = edited.priority;
  if (!sameDate(edited.dueDate, original.dueDate)) delta['dueDate'] = edited.dueDate ?? null;
  if (edited.atPlaceId !== original.atPlaceId) delta['atPlaceId'] = edited.atPlaceId ?? null;

  const originalDuration = resolvedDuration(original.focusDurationSeconds, defaultSprintSeconds);
  if (edited.focusDurationSeconds !== undefined) {
    const clamped = clampDuration(edited.focusDurationSeconds);
    if (clamped !== originalDuration) delta['focusDurationSeconds'] = clamped;
  }
  if (edited.nudgesCount !== undefined) {
    const clamped = clampNudgeCount(edited.nudgesCount);
    if (clamped !== resolvedNudgeCount(original.nudgesCount, originalDuration))
      delta['nudgesCount'] = clamped;
  }
  return { ok: true, value: delta };
}
