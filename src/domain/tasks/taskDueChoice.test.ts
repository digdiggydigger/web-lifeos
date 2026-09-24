// Port of TaskDueChoiceTests.
import { describe, expect, it } from 'vitest';

import {
  dueChoiceFor,
  resolvedDueDate,
  TASK_DUE_CHOICES,
  taskDueChoiceTitle,
} from './taskDueChoice';

const now = new Date(2026, 7, 25, 9, 41);
const today = new Date(2026, 7, 25);
const tomorrow = new Date(2026, 7, 26);
const picked = new Date(2026, 8, 2, 15);

describe('TaskDueChoice', () => {
  it('resolves per choice', () => {
    expect(resolvedDueDate('notYet', undefined, now)).toBeUndefined();
    expect(resolvedDueDate('today', undefined, now)).toEqual(today);
    expect(resolvedDueDate('tomorrow', undefined, now)).toEqual(tomorrow);
  });
  it('custom keeps an existing date and seeds now without one', () => {
    expect(resolvedDueDate('custom', picked, now)).toBe(picked);
    expect(resolvedDueDate('custom', undefined, now)).toBe(now);
  });
  it('recognises the date it produced, and anything else reads as custom', () => {
    for (const choice of TASK_DUE_CHOICES.filter((c) => c !== 'custom')) {
      expect(dueChoiceFor(resolvedDueDate(choice, undefined, now), now)).toBe(choice);
    }
    expect(dueChoiceFor(picked, now)).toBe('custom');
    expect(dueChoiceFor(now, now)).toBe('custom');
  });
  it('has the chip copy', () => {
    expect(TASK_DUE_CHOICES.map(taskDueChoiceTitle)).toEqual([
      'Not yet',
      'Today',
      'Tomorrow',
      'Pick a date',
    ]);
  });
});
