/** `MomentumTaskBuckets` (`Tasks/MomentumTaskBuckets.swift`): the Momentum board's three buckets. */
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import type { Task, TaskPriority } from '@/domain/types';

import type { LifeAreaTaskGroup } from './taskGroups';

export const MOMENTUM_BUCKET_IDS = {
  dueToday: 'momentum-dueToday',
  tomorrow: 'momentum-tomorrow',
  closedToday: 'momentum-closedToday',
} as const;

const PRIORITY_RANK: Record<TaskPriority, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

function sortWithinBucket(tasks: readonly Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const byPriority = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
      if (byPriority !== 0) return byPriority;
      const effortA = a.task.focusDurationSeconds ?? Number.POSITIVE_INFINITY;
      const effortB = b.task.focusDurationSeconds ?? Number.POSITIVE_INFINITY;
      if (effortA !== effortB) return effortA - effortB;
      return a.index - b.index;
    })
    .map(({ task }) => task);
}

/** Due today (overdue folded in), Tomorrow, Closed today; always in that order; empty buckets omitted. */
export function groupMomentum(tasks: readonly Task[], now: Date): LifeAreaTaskGroup[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const dueToday: Task[] = [];
  const dueTomorrow: Task[] = [];
  const closedToday: Task[] = [];
  for (const task of tasks) {
    if (task.status === 'done') {
      if (task.completedAt && isSameDay(task.completedAt, now)) closedToday.push(task);
      continue;
    }
    if (!task.dueDate) continue;
    const dueDay = startOfDay(task.dueDate);
    if (dueDay <= today) dueToday.push(task);
    else if (dueDay.getTime() === tomorrow.getTime()) dueTomorrow.push(task);
  }
  const buckets: [string, string, Task[]][] = [
    [MOMENTUM_BUCKET_IDS.dueToday, 'Due today', dueToday],
    [MOMENTUM_BUCKET_IDS.tomorrow, 'Tomorrow', dueTomorrow],
    [MOMENTUM_BUCKET_IDS.closedToday, 'Closed today', closedToday],
  ];
  return buckets
    .filter(([, , bucket]) => bucket.length > 0)
    .map(([customId, name, bucket]) => ({
      lifeAreaName: `${name} · ${bucket.length}`,
      tasks: sortWithinBucket(bucket),
      customId,
    }));
}

/** `"3 open · 1 overdue"`; overdue means open with a due day strictly before today. */
export function headerLine(tasks: readonly Task[], now: Date): string {
  const today = startOfDay(now);
  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.dueDate !== undefined && startOfDay(t.dueDate) < today);
  return `${open.length} open · ${overdue.length} overdue`;
}

export type HeaderTone = 'state-warn' | 'accent' | 'state-go';

export function headerTone(customId: string | undefined): HeaderTone | undefined {
  switch (customId) {
    case MOMENTUM_BUCKET_IDS.dueToday:
      return 'state-warn';
    case MOMENTUM_BUCKET_IDS.tomorrow:
      return 'accent';
    case MOMENTUM_BUCKET_IDS.closedToday:
      return 'state-go';
    default:
      return undefined;
  }
}
