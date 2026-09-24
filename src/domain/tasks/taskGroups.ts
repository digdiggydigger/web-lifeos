/** `LifeAreaTaskGroup` (`Tasks/TaskModels.swift`). */
import type { Task } from '@/domain/types';

export interface LifeAreaTaskGroup {
  readonly lifeAreaId?: string;
  readonly lifeAreaName: string;
  readonly tasks: readonly Task[];
  /** Momentum buckets name their own identity; life-area groups derive it. */
  readonly customId?: string;
}

export const UNASSIGNED_GROUP_ID = 'unassigned';

export function taskGroupId(group: LifeAreaTaskGroup): string {
  return group.customId ?? group.lifeAreaId ?? UNASSIGNED_GROUP_ID;
}
