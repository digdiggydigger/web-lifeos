/** `TaskGrouping` (`Tasks/TaskGrouping.swift`): the non-Momentum board, one card per active area plus Unassigned. */
import type { LifeArea, Task } from '@/domain/types';

import type { LifeAreaTaskGroup } from './taskGroups';

export const UNASSIGNED_LIFE_AREA_NAME = 'Unassigned';

function openBeforeDone(tasks: readonly Task[]): Task[] {
  return [...tasks.filter((t) => t.status === 'open'), ...tasks.filter((t) => t.status !== 'open')];
}

export function groupTasksByLifeArea(
  tasks: readonly Task[],
  lifeAreas: readonly LifeArea[],
): LifeAreaTaskGroup[] {
  const active = lifeAreas.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIds = new Set(active.map((a) => a.id));
  const groups: LifeAreaTaskGroup[] = [];
  for (const area of active) {
    const own = tasks.filter((t) => t.lifeAreaId === area.id);
    if (own.length > 0)
      groups.push({ lifeAreaId: area.id, lifeAreaName: area.name, tasks: openBeforeDone(own) });
  }
  const unassigned = tasks.filter(
    (t) => t.lifeAreaId === undefined || !activeIds.has(t.lifeAreaId),
  );
  if (unassigned.length > 0) {
    groups.push({ lifeAreaName: UNASSIGNED_LIFE_AREA_NAME, tasks: openBeforeDone(unassigned) });
  }
  return groups;
}
