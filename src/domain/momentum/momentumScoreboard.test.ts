import { describe, expect, it } from 'vitest';

import type { Task } from '@/domain/types';

import { closedThisWeek, effortLabel, streak } from './momentumScoreboard';

const now = new Date(2026, 7, 14, 9, 41);
const daysAgo = (n: number) => new Date(2026, 7, 14 - n, 9, 41);
const done = (n: number): Task => ({
  id: `D${n}`,
  title: 'Done',
  status: 'done',
  priority: 'p3',
  completedAt: daysAgo(n),
});

describe('streak', () => {
  it('counts consecutive days back from today, or from yesterday when today is still empty', () => {
    expect(streak([done(0), done(1), done(2)], now)).toBe(3);
    expect(streak([done(1), done(2)], now)).toBe(2);
    expect(streak([done(0), done(2)], now)).toBe(1);
    expect(streak([done(2)], now)).toBe(0);
    expect(streak([{ id: 'X', title: 'legacy', status: 'done', priority: 'p3' }], now)).toBe(0);
  });
});

describe('closedThisWeek', () => {
  it('keeps closures from the last seven calendar days including today', () => {
    expect(closedThisWeek([done(0), done(6), done(7)], now).map((t) => t.id)).toEqual(['D0', 'D6']);
  });
});

describe('effortLabel', () => {
  it('rounds up to whole minutes with a one-minute floor', () => {
    expect(effortLabel(undefined)).toBeUndefined();
    expect(effortLabel(900)).toBe('15 min');
    expect(effortLabel(61)).toBe('2 min');
    expect(effortLabel(5)).toBe('1 min');
  });
});
