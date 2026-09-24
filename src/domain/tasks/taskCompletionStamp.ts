/** `TaskCompletionStamp` (`Tasks/TaskModels.swift`): status and stamp move together; "today" is day-granular. */
import { isSameDay } from '@/domain/time/calendar';
import type { Task, TaskStatus } from '@/domain/types';

export function completedAtFor(status: TaskStatus, now: Date): Date | undefined {
  return status === 'done' ? now : undefined;
}

export function applyingStatus(status: TaskStatus, task: Task, now: Date): Task {
  const rest: Record<string, unknown> = { ...task };
  delete rest['completedAt'];
  const stamp = completedAtFor(status, now);
  const updated = stamp ? { ...rest, status, completedAt: stamp } : { ...rest, status };
  return updated as unknown as Task;
}

/** Done tasks stamped on the same calendar day as `date`, newest first; unstamped closures belong to no day. */
export function completedTasks(tasks: readonly Task[], date: Date): Task[] {
  return tasks
    .filter(
      (task) =>
        task.status === 'done' &&
        task.completedAt !== undefined &&
        isSameDay(task.completedAt, date),
    )
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
}
