/** `TaskDueChoice`: the composer's When chips. */
import { addDays, startOfDay } from '@/domain/time/calendar';

export type TaskDueChoice = 'notYet' | 'today' | 'tomorrow' | 'custom';
export const TASK_DUE_CHOICES: readonly TaskDueChoice[] = ['notYet', 'today', 'tomorrow', 'custom'];

export function taskDueChoiceTitle(choice: TaskDueChoice): string {
  switch (choice) {
    case 'notYet':
      return 'Not yet';
    case 'today':
      return 'Today';
    case 'tomorrow':
      return 'Tomorrow';
    case 'custom':
      return 'Pick a date';
  }
}

/** Custom keeps a date already picked and seeds `now` without one. */
export function resolvedDueDate(
  choice: TaskDueChoice,
  existing: Date | undefined,
  now: Date,
): Date | undefined {
  switch (choice) {
    case 'notYet':
      return undefined;
    case 'today':
      return startOfDay(now);
    case 'tomorrow':
      return addDays(startOfDay(now), 1);
    case 'custom':
      return existing ?? now;
  }
}

export function dueChoiceFor(dueDate: Date | undefined, now: Date): TaskDueChoice {
  if (!dueDate) return 'notYet';
  const today = startOfDay(now);
  if (dueDate.getTime() === today.getTime()) return 'today';
  if (dueDate.getTime() === addDays(today, 1).getTime()) return 'tomorrow';
  return 'custom';
}
