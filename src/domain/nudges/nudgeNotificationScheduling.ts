/**
 * `Nudges/NudgeNotificationScheduling.swift`: the pure half of notification scheduling. One trigger
 * per weekday, in `DateComponents` numbering (`1` = Sunday … `7` = Saturday) so the two clients
 * describe the same moments; the browser notifier walks these with `nextFireTime`.
 */
import type { NudgeSchedule } from './nudgeSchedule';

export interface NudgeTrigger {
  readonly hour: number;
  readonly minute: number;
  /** `1` (Sunday) … `7` (Saturday): cron's weekday plus one. */
  readonly weekday: number;
}

export function triggerComponents(schedule: NudgeSchedule): NudgeTrigger[] {
  return [...schedule.weekdays]
    .sort((a, b) => a - b)
    .map((cronWeekday) => ({
      hour: schedule.hour,
      minute: schedule.minute,
      weekday: cronWeekday + 1,
    }));
}
