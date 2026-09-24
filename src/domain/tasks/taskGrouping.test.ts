// Port of TaskGroupingTests.
import { describe, expect, it } from 'vitest';

import type { LifeArea, Task } from '@/domain/types';

import { groupTasksByLifeArea, UNASSIGNED_LIFE_AREA_NAME } from './taskGrouping';
import { taskGroupId, UNASSIGNED_GROUP_ID } from './taskGroups';

const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 1, archived: false };
const health: LifeArea = { id: 'H', name: 'Health', colour: '🫀', sortOrder: 0, archived: false };
const archived: LifeArea = { id: 'A', name: 'Old', colour: '📦', sortOrder: 2, archived: true };
const t = (id: string, lifeAreaId: string | undefined, status: Task['status'] = 'open'): Task => ({
  id,
  title: id,
  status,
  priority: 'p3',
  ...(lifeAreaId ? { lifeAreaId } : {}),
});

describe('groupTasksByLifeArea', () => {
  it('groups under areas ordered by sort_order, open before done, omitting empty areas', () => {
    const groups = groupTasksByLifeArea(
      [t('w-done', 'W', 'done'), t('w-open', 'W'), t('h', 'H')],
      [work, health],
    );
    expect(groups.map((g) => g.lifeAreaName)).toEqual(['Health', 'Work']);
    expect(groups[1]?.tasks.map((x) => x.id)).toEqual(['w-open', 'w-done']);
    expect(taskGroupId(groups[0]!)).toBe('H');
  });

  it('routes nil, archived and unknown areas into one trailing Unassigned group, open before done', () => {
    const groups = groupTasksByLifeArea(
      [t('a-done', 'A', 'done'), t('none', undefined), t('ghost', 'ZZZ'), t('w', 'W')],
      [work, archived],
    );
    expect(groups.map((g) => g.lifeAreaName)).toEqual(['Work', UNASSIGNED_LIFE_AREA_NAME]);
    expect(groups[1]?.tasks.map((x) => x.id)).toEqual(['none', 'ghost', 'a-done']);
    expect(taskGroupId(groups[1]!)).toBe(UNASSIGNED_GROUP_ID);
  });

  it('returns nothing for no tasks', () => {
    expect(groupTasksByLifeArea([], [work])).toEqual([]);
  });
});
