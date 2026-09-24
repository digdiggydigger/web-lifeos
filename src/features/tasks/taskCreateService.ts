/** `TaskCreateService`: the composer's two-step create (task, then its effort as a follow-up update). */
import type { LifeArea, Task } from '@/domain/types';
import {
  effortChoiceSeconds,
  normalizeCreateTaskInput,
  taskCreateValidationMessage,
} from '@/domain/tasks';
import type { TaskEffortChoice } from '@/domain/tasks';

import { errorText } from './tasksClient';
import type { TaskCreateClient } from './tasksClient';

export const TIME_NOT_SAVED_WARNING = "Task created, but couldn't save its time.";

export interface TaskCreateInput {
  readonly title: string;
  readonly lifeAreaId?: string;
  readonly dueDate?: Date;
  readonly effort: TaskEffortChoice;
}

export type TaskCreateOutcome =
  | { readonly ok: true; readonly task: Task; readonly warning?: string }
  | { readonly ok: false; readonly error: string };

export function isTitleValid(title: string): boolean {
  return title.trim().length > 0;
}

/** Non-archived areas, plus the currently selected one even if archived. */
export function offeredAreas(
  areas: readonly LifeArea[],
  selectedId: string | undefined,
): LifeArea[] {
  return areas.filter((a) => !a.archived || a.id === selectedId);
}

export async function createTaskFlow(
  client: TaskCreateClient,
  input: TaskCreateInput,
): Promise<TaskCreateOutcome> {
  const normalized = normalizeCreateTaskInput({
    title: input.title,
    ...(input.lifeAreaId ? { lifeAreaId: input.lifeAreaId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  });
  if (!normalized.ok) return { ok: false, error: taskCreateValidationMessage(normalized.error) };
  let task: Task;
  try {
    task = await client.createTask(normalized.value);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  try {
    await client.updateTask(task.id, { focusDurationSeconds: effortChoiceSeconds(input.effort) });
  } catch {
    return { ok: true, task, warning: TIME_NOT_SAVED_WARNING };
  }
  return { ok: true, task };
}
