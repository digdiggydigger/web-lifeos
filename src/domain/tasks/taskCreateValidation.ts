/** `TaskCreateValidation`: what the composer will submit. Priority is always p4 on create. */
import type { TaskPriority } from '@/domain/types';

export type TaskCreateValidationError = 'emptyTitle' | 'emptyTagName';

export function taskCreateValidationMessage(error: TaskCreateValidationError): string {
  return error === 'emptyTitle' ? 'Title is required.' : 'Tag name is required.';
}

export interface NormalizedCreateTaskInput {
  readonly title: string;
  readonly notes?: string;
  readonly lifeAreaId?: string;
  readonly dueDate?: Date;
  readonly atPlaceId?: string;
  readonly priority: TaskPriority;
}

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TaskCreateValidationError };

export function normalizeCreateTaskInput(input: {
  readonly title: string;
  readonly notes?: string;
  readonly lifeAreaId?: string;
  readonly dueDate?: Date;
  readonly atPlaceId?: string;
}): Validated<NormalizedCreateTaskInput> {
  const title = input.title.trim();
  if (title.length === 0) return { ok: false, error: 'emptyTitle' };
  const notes = input.notes?.trim();
  const value: NormalizedCreateTaskInput = {
    title,
    priority: 'p4',
    ...(notes ? { notes } : {}),
    ...(input.lifeAreaId ? { lifeAreaId: input.lifeAreaId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.atPlaceId ? { atPlaceId: input.atPlaceId } : {}),
  };
  return { ok: true, value };
}

export function normalizeCreateTagInput(name: string): Validated<string> {
  const trimmed = name.trim();
  return trimmed.length === 0 ? { ok: false, error: 'emptyTagName' } : { ok: true, value: trimmed };
}
