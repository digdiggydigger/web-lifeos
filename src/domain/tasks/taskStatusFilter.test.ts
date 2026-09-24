// Port of TaskStatusFilterTests.
import { describe, expect, it } from 'vitest';

import type { Task } from '@/domain/types';

import { filterTasks, TASK_STATUS_FILTER_OPTIONS, taskStatusFilterLabel } from './taskStatusFilter';

const now = new Date(2026, 7, 14, 9, 41);
const open: Task = { id: 'O', title: 'open', status: 'open', priority: 'p3' };
const doneToday: Task = {
  id: 'D1',
  title: 'done today',
  status: 'done',
  priority: 'p3',
  completedAt: now,
};
const doneYesterday: Task = {
  id: 'D2',
  title: 'done yesterday',
  status: 'done',
  priority: 'p3',
  completedAt: new Date(2026, 7, 13, 9),
};
const all = [open, doneToday, doneYesterday];

describe('filterTasks', () => {
  it('open / done / all', () => {
    expect(filterTasks(all, 'open', now)).toEqual([open]);
    expect(filterTasks(all, 'done', now)).toEqual([doneToday, doneYesterday]);
    expect(filterTasks(all, 'all', now)).toEqual(all);
    expect(filterTasks([open], 'done', now)).toEqual([]);
  });

  it("momentum returns open plus today's closures", () => {
    expect(filterTasks(all, 'momentum', now)).toEqual([open, doneToday]);
  });

  it('has human-readable labels for every option', () => {
    expect(TASK_STATUS_FILTER_OPTIONS.map(taskStatusFilterLabel)).toEqual([
      'Momentum',
      'Open',
      'Done',
      'All',
    ]);
  });
});
