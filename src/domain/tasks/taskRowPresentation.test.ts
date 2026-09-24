// Ports of TaskRowPresentationTests and TaskRowSwipeTests.
import { describe, expect, it } from 'vitest';

import { formatShortTime } from '@/domain/time/calendar';
import type { LifeArea, Task } from '@/domain/types';

import { taskAccessibilityLabel, taskMetaLine } from './taskRowPresentation';
import { rubberBanded, SWIPE_ELASTIC_LIMIT, SWIPE_THRESHOLD, swipeCloses } from './taskRowSwipe';

const now = new Date(2026, 7, 14, 9, 41);
const work: LifeArea = {
  id: 'W',
  name: 'Work & Career',
  colour: '💼',
  sortOrder: 0,
  archived: false,
};
const task = (o: { status?: Task['status']; due?: number; completedAt?: Date } = {}): Task => ({
  id: 'T',
  title: 'Task',
  status: o.status ?? 'open',
  priority: 'p1',
  lifeAreaId: 'W',
  ...(o.due !== undefined ? { dueDate: new Date(2026, 7, 14 + o.due, 9, 41) } : {}),
  ...(o.completedAt ? { completedAt: o.completedAt } : {}),
});
const closedAt = new Date(2026, 7, 14, 5, 41);

describe('taskMetaLine', () => {
  it('reads area, priority and the due phrase', () => {
    expect(taskMetaLine(task({ due: 0 }), work, now)).toBe('💼 Work & Career · P1 · Due today');
    expect(taskMetaLine(task({ due: -2 }), work, now)).toBe('💼 Work & Career · P1 · Overdue');
    expect(taskMetaLine(task(), work, now)).toBe('💼 Work & Career · P1');
    expect(
      taskMetaLine({ id: 'O', title: 'Task', status: 'open', priority: 'p3' }, undefined, now),
    ).toBe('P3');
  });
  it('reads the closed time instead of priority', () => {
    const line = taskMetaLine(task({ status: 'done', completedAt: closedAt }), work, now);
    expect(line).toBe(`💼 Work & Career · closed ${formatShortTime(closedAt)}`);
    expect(line).not.toContain('P1');
    expect(taskMetaLine(task({ status: 'done' }), work, now)).toBe('💼 Work & Career · closed');
  });
});

describe('taskAccessibilityLabel', () => {
  it('reads area and priority in words, or the closure', () => {
    expect(taskAccessibilityLabel(task({ due: 0 }), work, now)).toBe(
      'Work & Career, Priority p1, Due today',
    );
    expect(taskAccessibilityLabel(task({ status: 'done', completedAt: closedAt }), work, now)).toBe(
      `Work & Career, closed ${formatShortTime(closedAt)}`,
    );
  });
});

describe('TaskRowSwipe', () => {
  it('closes only past the rightward threshold', () => {
    expect(swipeCloses(74)).toBe(false);
    expect(swipeCloses(SWIPE_THRESHOLD)).toBe(false);
    expect(swipeCloses(76)).toBe(true);
    expect(swipeCloses(-200)).toBe(false);
  });
  it('tracks one-to-one to the threshold, damps past it, caps at the elastic limit, ignores leftward', () => {
    expect(rubberBanded(40)).toBe(40);
    expect(rubberBanded(SWIPE_THRESHOLD)).toBe(SWIPE_THRESHOLD);
    expect(rubberBanded(125)).toBe(75 + 50 * 0.4);
    expect(rubberBanded(10_000)).toBe(SWIPE_ELASTIC_LIMIT);
    expect(rubberBanded(-1)).toBe(0);
    expect(rubberBanded(-500)).toBe(0);
  });
});
