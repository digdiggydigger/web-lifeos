// Port of MomentumTaskContextTests.
import { describe, expect, it } from 'vitest';

import type { LifeArea, Task } from '@/domain/types';

import { buildMomentumContext, closeButtonLabel } from './momentumTaskContext';

const now = new Date(2026, 7, 14, 9, 41);
const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
let n = 0;
const done = (daysAgo: number, lifeAreaId?: string): Task => ({
  id: `D${(n += 1)}`,
  title: 'Done',
  status: 'done',
  priority: 'p3',
  completedAt: new Date(2026, 7, 14 - daysAgo, 9, 41),
  ...(lifeAreaId ? { lifeAreaId } : {}),
});
const open = (lifeAreaId?: string): Task => ({
  id: `O${(n += 1)}`,
  title: 'Open',
  status: 'open',
  priority: 'p3',
  ...(lifeAreaId ? { lifeAreaId } : {}),
});
const build = (lifeAreaId: string | undefined, tasks: Task[], showStreaks = true) =>
  buildMomentumContext({ lifeAreaId, tasks, lifeAreas: [work], showStreaks, now });

describe('closeButtonLabel', () => {
  it('states the streak consequence, or not', () => {
    expect(closeButtonLabel(7)).toBe('Close it — keeps a 7-day streak');
    expect(closeButtonLabel(1)).toBe('Close it — keeps a 1-day streak');
    expect(closeButtonLabel(0)).toBe('Close it');
  });
});

describe('buildMomentumContext', () => {
  it('reads closed over total with the last closure', () => {
    expect(build('W', [done(2, 'W'), done(3, 'W'), open('W')]).areaLine).toBe(
      '💼 Work: 2 of 3 closed this week. Last closed 2 days ago.',
    );
  });
  it('reads today and yesterday as words', () => {
    expect(build('W', [done(0, 'W')]).areaLine).toBe(
      '💼 Work: 1 of 1 closed this week. Last closed today.',
    );
    expect(build('W', [done(1, 'W')]).areaLine).toBe(
      '💼 Work: 1 of 1 closed this week. Last closed yesterday.',
    );
  });
  it('says when nothing closed this week', () => {
    expect(build('W', [open('W')]).areaLine).toBe('💼 Work: nothing closed this week yet. 1 open.');
  });
  it('has no line without an area, and respects the streak toggle', () => {
    expect(build(undefined, []).areaLine).toBeUndefined();
    expect(build(undefined, [done(0), done(1)]).streak).toBe(2);
    expect(build(undefined, [done(0), done(1)], false).streak).toBe(0);
  });
});
