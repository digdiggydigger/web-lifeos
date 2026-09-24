/** `Home/ActiveGoalSelection.swift`: the top open task by priority band, then earliest due (undated last), then input order. */
import { TASK_PRIORITIES } from '@/domain/types';
import type { Task } from '@/domain/types';

export function topTask(tasks: readonly Task[]): Task | undefined {
  const open = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === 'open');
  if (open.length === 0) return undefined;
  return open.reduce((best, entry) => {
    const bestRank = TASK_PRIORITIES.indexOf(best.task.priority);
    const rank = TASK_PRIORITIES.indexOf(entry.task.priority);
    if (rank !== bestRank) return rank < bestRank ? entry : best;
    const bestDue = best.task.dueDate?.getTime();
    const due = entry.task.dueDate?.getTime();
    if (bestDue !== due) {
      if (due === undefined) return best;
      if (bestDue === undefined) return entry;
      return due < bestDue ? entry : best;
    }
    return entry.index < best.index ? entry : best;
  }).task;
}
