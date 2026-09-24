// Port of TaskCompletionStampTests (the two codec cases live in the schema tests).
import { describe, expect, it } from 'vitest';

import type { Task } from '@/domain/types';

import { applyingStatus, completedAtFor, completedTasks } from './taskCompletionStamp';

const now = new Date(1_787_000_000_000);
function makeTask(status: Task['status'], completedAt?: Date, title = 'task'): Task {
  const task: Task = { id: 'ID', title, status, priority: 'p2' };
  return completedAt ? { ...task, completedAt } : task;
}

describe('TaskCompletionStamp', () => {
  it('completing stamps the moment; reopening clears it', () => {
    expect(completedAtFor('done', now)).toBe(now);
    expect(completedAtFor('open', now)).toBeUndefined();
  });

  it('reopening discards a previous stamp, and applying done sets both', () => {
    const reopened = applyingStatus(
      'open',
      makeTask('done', new Date(now.getTime() - 86_400_000)),
      now,
    );
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.status).toBe('open');
    const done = applyingStatus('done', makeTask('open'), now);
    expect(done.status).toBe('done');
    expect(done.completedAt).toBe(now);
  });

  it("completedTasks keeps only today's done tasks, day-granular, newest first", () => {
    const tasks = [
      makeTask('done', now, 'today'),
      makeTask('done', new Date(now.getTime() - 86_400_000), 'yesterday'),
      makeTask('open', undefined, 'open'),
      makeTask('done', undefined, 'legacy'),
    ];
    expect(completedTasks(tasks, now).map((t) => t.title)).toEqual(['today']);

    const morning = new Date(2026, 7, 21, 9);
    const evening = new Date(2026, 7, 21, 23);
    expect(
      completedTasks([makeTask('done', morning, 'morning')], evening).map((t) => t.title),
    ).toEqual(['morning']);

    const ordered = [
      makeTask('done', new Date(now.getTime() - 3_600_000), 'early'),
      makeTask('done', now, 'late'),
    ];
    expect(completedTasks(ordered, now).map((t) => t.title)).toEqual(['late', 'early']);
  });
});
