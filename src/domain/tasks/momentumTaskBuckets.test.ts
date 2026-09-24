// Ports of MomentumTaskBucketsTests and TasksV3PresentationTests.
import { describe, expect, it } from 'vitest';

import type { Task, TaskPriority, TaskStatus } from '@/domain/types';

import { groupMomentum, headerLine, headerTone, MOMENTUM_BUCKET_IDS } from './momentumTaskBuckets';
import { taskGroupId } from './taskGroups';

const now = new Date(2026, 7, 14, 9, 41);
const addDays = (n: number) => new Date(2026, 7, 14 + n, 9, 41);
let counter = 0;
function task(
  title: string,
  o: {
    due?: number;
    status?: TaskStatus;
    priority?: TaskPriority;
    focus?: number;
    completedDaysAgo?: number;
  } = {},
): Task {
  counter += 1;
  return {
    id: `T${counter}`,
    title,
    status: o.status ?? 'open',
    priority: o.priority ?? 'p3',
    ...(o.due !== undefined ? { dueDate: addDays(o.due) } : {}),
    ...(o.focus !== undefined ? { focusDurationSeconds: o.focus } : {}),
    ...(o.completedDaysAgo !== undefined ? { completedAt: addDays(-o.completedDaysAgo) } : {}),
  };
}
const names = (tasks: Task[]) => groupMomentum(tasks, now).map((g) => g.lifeAreaName);

describe('groupMomentum', () => {
  it('buckets by dueness in a fixed order', () => {
    expect(
      names([
        task('Closed', { status: 'done', completedDaysAgo: 0 }),
        task('Tomorrow', { due: 1 }),
        task('Today', { due: 0 }),
      ]),
    ).toEqual(['Due today · 1', 'Tomorrow · 1', 'Closed today · 1']);
  });

  it('excludes later and undated tasks', () => {
    expect(names([task('Undated'), task('Later', { due: 3 }), task('Today', { due: 0 })])).toEqual([
      'Due today · 1',
    ]);
  });

  it('folds overdue into due today', () => {
    expect(names([task('Overdue', { due: -2 }), task('Today', { due: 0 })])).toEqual([
      'Due today · 2',
    ]);
  });

  it('omits empty buckets and drops old closures', () => {
    expect(names([task('Tomorrow', { due: 1 })])).toEqual(['Tomorrow · 1']);
    expect(names([task('Old win', { status: 'done', completedDaysAgo: 1 })])).toEqual([]);
  });

  it('sorts within a bucket by priority then shortest effort, stable otherwise', () => {
    const groups = groupMomentum(
      [
        task('P2 quick', { due: 0, priority: 'p2', focus: 900 }),
        task('P1 deep', { due: 0, priority: 'p1', focus: 1500 }),
        task('P2 slow', { due: 0, priority: 'p2', focus: 1800 }),
      ],
      now,
    );
    expect(groups[0]?.tasks.map((t) => t.title)).toEqual(['P1 deep', 'P2 quick', 'P2 slow']);
  });

  it('gives every bucket a distinct id', () => {
    const groups = groupMomentum(
      [
        task('Today', { due: 0 }),
        task('Tomorrow', { due: 1 }),
        task('Closed', { status: 'done', completedDaysAgo: 0 }),
      ],
      now,
    );
    expect(new Set(groups.map(taskGroupId)).size).toBe(3);
    expect(groups.map((g) => g.customId)).toEqual([
      MOMENTUM_BUCKET_IDS.dueToday,
      MOMENTUM_BUCKET_IDS.tomorrow,
      MOMENTUM_BUCKET_IDS.closedToday,
    ]);
  });
});

describe('headerLine and tones (TasksV3Presentation)', () => {
  it('counts open and overdue', () => {
    expect(
      headerLine(
        [
          task('a', { due: -1 }),
          task('b', { due: 0 }),
          task('c'),
          task('d', { status: 'done', completedDaysAgo: 0 }),
        ],
        now,
      ),
    ).toBe('3 open · 1 overdue');
    expect(headerLine([task('a')], now)).toBe('1 open · 0 overdue');
    expect(headerLine([], now)).toBe('0 open · 0 overdue');
  });

  it('matches the v3 hues', () => {
    expect(headerTone(MOMENTUM_BUCKET_IDS.dueToday)).toBe('state-warn');
    expect(headerTone(MOMENTUM_BUCKET_IDS.tomorrow)).toBe('accent');
    expect(headerTone(MOMENTUM_BUCKET_IDS.closedToday)).toBe('state-go');
    expect(headerTone(undefined)).toBeUndefined();
  });
});
