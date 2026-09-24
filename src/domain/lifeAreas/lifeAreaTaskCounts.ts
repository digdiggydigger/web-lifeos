/** `Home/LifeAreaTaskCounts.swift`. */
import type { LifeArea, Task } from '@/domain/types';

export interface LifeAreaTaskCount {
  readonly lifeArea: LifeArea;
  readonly openTaskCount: number;
}

export function countOpenTasksByLifeArea(
  lifeAreas: readonly LifeArea[],
  tasks: readonly Task[],
): LifeAreaTaskCount[] {
  return [...lifeAreas]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((lifeArea) => ({
      lifeArea,
      openTaskCount: tasks.filter((t) => t.status === 'open' && t.lifeAreaId === lifeArea.id)
        .length,
    }));
}
