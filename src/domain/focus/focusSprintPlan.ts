/** `FocusSprintPlan`: what a task, its area and the default sprint length resolve to. */
import type { LifeArea, Task } from '@/domain/types';

import {
  clampDuration,
  clampNudgeCount,
  DEFAULT_DURATION_SECONDS,
  resolvedDuration,
  resolvedNudgeCount,
} from './focusSprintConfiguration';

export interface FocusSprintPlan {
  readonly taskId: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly durationSeconds: number;
  readonly nudgeCount: number;
}

export const FALLBACK_SPRINT_EMOJI = '🎯';

export function focusSprintPlan(input: {
  readonly taskId?: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji?: string | undefined;
  readonly durationSeconds: number;
  readonly nudgeCount: number;
}): FocusSprintPlan {
  return {
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    lifeAreaEmoji:
      input.lifeAreaEmoji && input.lifeAreaEmoji.length > 0
        ? input.lifeAreaEmoji
        : FALLBACK_SPRINT_EMOJI,
    durationSeconds: clampDuration(input.durationSeconds),
    nudgeCount: clampNudgeCount(input.nudgeCount),
  };
}

export function planForTask(
  task: Pick<Task, 'id' | 'title' | 'focusDurationSeconds' | 'nudgesCount'>,
  lifeArea: Pick<LifeArea, 'colour'> | undefined,
  defaultDurationSeconds: number = DEFAULT_DURATION_SECONDS,
): FocusSprintPlan {
  const duration = resolvedDuration(task.focusDurationSeconds, defaultDurationSeconds);
  return focusSprintPlan({
    taskId: task.id,
    taskTitle: task.title,
    lifeAreaEmoji: lifeArea?.colour,
    durationSeconds: duration,
    nudgeCount: resolvedNudgeCount(task.nudgesCount, duration),
  });
}
