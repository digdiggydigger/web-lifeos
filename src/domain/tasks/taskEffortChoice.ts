/** `TaskEffortChoice`: the composer's Time menu, written as `focus_duration_seconds`. */
export type TaskEffortChoice = 'fifteen' | 'thirty' | 'hour';
export const TASK_EFFORT_CHOICES: readonly TaskEffortChoice[] = ['fifteen', 'thirty', 'hour'];
export const STANDARD_EFFORT_CHOICE: TaskEffortChoice = 'fifteen';

export function effortChoiceTitle(choice: TaskEffortChoice): string {
  return { fifteen: '15 min', thirty: '30 min', hour: '1 hr' }[choice];
}

export function effortChoiceSeconds(choice: TaskEffortChoice): number {
  return { fifteen: 900, thirty: 1800, hour: 3600 }[choice];
}
