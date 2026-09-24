/** `TaskStatusFilter` (`Tasks/TaskStatusFilter.swift`). Momentum = every open task plus today's closures. */
import { isSameDay } from '@/domain/time/calendar';
import type { Task } from '@/domain/types';

export type TaskStatusFilterOption = 'momentum' | 'open' | 'done' | 'all';
export const TASK_STATUS_FILTER_OPTIONS: readonly TaskStatusFilterOption[] = [
  'momentum',
  'open',
  'done',
  'all',
];
/** What the life-area detail uses (no Momentum). */
export const STANDARD_STATUS_FILTER_OPTIONS: readonly TaskStatusFilterOption[] = [
  'open',
  'done',
  'all',
];

export function taskStatusFilterLabel(option: TaskStatusFilterOption): string {
  switch (option) {
    case 'momentum':
      return 'Momentum';
    case 'open':
      return 'Open';
    case 'done':
      return 'Done';
    case 'all':
      return 'All';
  }
}

export function filterTasks(tasks: readonly Task[], by: TaskStatusFilterOption, now: Date): Task[] {
  switch (by) {
    case 'momentum':
      return tasks.filter(
        (t) =>
          t.status === 'open' || (t.completedAt !== undefined && isSameDay(t.completedAt, now)),
      );
    case 'open':
      return tasks.filter((t) => t.status === 'open');
    case 'done':
      return tasks.filter((t) => t.status === 'done');
    case 'all':
      return [...tasks];
  }
}
