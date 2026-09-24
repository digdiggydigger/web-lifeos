/** `TaskRowPresentation`: the row's meta line and accessibility label. */
import { formatShortTime, formatWeekdayDayMonth, startOfDay } from '@/domain/time/calendar';
import type { LifeArea, Task } from '@/domain/types';

function closedPhrase(task: Task): string {
  return task.completedAt ? `closed ${formatShortTime(task.completedAt)}` : 'closed';
}

export function duePhrase(dueDate: Date | undefined, now: Date): string | undefined {
  if (!dueDate) return undefined;
  const today = startOfDay(now);
  const dueDay = startOfDay(dueDate);
  if (dueDay < today) return 'Overdue';
  if (dueDay.getTime() === today.getTime()) return 'Due today';
  return formatWeekdayDayMonth(dueDate);
}

export function taskMetaLine(task: Task, lifeArea: LifeArea | undefined, now: Date): string {
  const parts: string[] = [];
  if (lifeArea) parts.push(`${lifeArea.colour} ${lifeArea.name}`);
  if (task.status === 'done') {
    parts.push(closedPhrase(task));
  } else {
    parts.push(task.priority.toUpperCase());
    const due = duePhrase(task.dueDate, now);
    if (due) parts.push(due);
  }
  return parts.join(' · ');
}

export function taskAccessibilityLabel(
  task: Task,
  lifeArea: LifeArea | undefined,
  now: Date,
): string {
  const parts: string[] = [];
  if (lifeArea) parts.push(lifeArea.name);
  if (task.status === 'done') {
    parts.push(closedPhrase(task));
  } else {
    parts.push(`Priority ${task.priority}`);
    const due = duePhrase(task.dueDate, now);
    if (due) parts.push(due);
  }
  return parts.join(', ');
}
