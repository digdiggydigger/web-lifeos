/**
 * `Nudges/NudgeDueness.swift`: next-fire in the device's LOCAL time, never UTC (the old web client's
 * bug the phone refused to port). Every supported schedule repeats within seven days.
 */
import { addDays, startOfDay } from '@/domain/time/calendar';
import type { Nudge } from '@/domain/types';

import { parseSchedule } from './nudgeSchedule';
import type { NudgeSchedule } from './nudgeSchedule';

/** The first local occurrence strictly after `after` on an allowed weekday, or nothing within the week. */
export function nextFireTime(schedule: NudgeSchedule, after: Date): Date | undefined {
  let day = startOfDay(after);
  for (let i = 0; i < 8; i += 1) {
    const candidate = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      schedule.hour,
      schedule.minute,
    );
    if (candidate > after && schedule.weekdays.has(day.getDay())) return candidate;
    day = addDays(day, 1);
  }
  return undefined;
}

/** Active, parseable, and the next fire after `lastFiredAt ?? createdAt` has already elapsed. */
export function isNudgeDue(nudge: Nudge, now: Date): boolean {
  if (!nudge.active) return false;
  const schedule = parseSchedule(nudge.schedule);
  if (!schedule) return false;
  const next = nextFireTime(schedule, nudge.lastFiredAt ?? nudge.createdAt);
  return next !== undefined && next <= now;
}

/** When this nudge next fires after `reference`; nothing when paused or unparseable. */
export function nextFire(nudge: Nudge, reference: Date): Date | undefined {
  if (!nudge.active) return undefined;
  const schedule = parseSchedule(nudge.schedule);
  return schedule ? nextFireTime(schedule, reference) : undefined;
}
