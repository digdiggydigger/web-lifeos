/** `Nudges/NudgeStreak.swift`: per-nudge streaks over the `completion_dates` stamps; days, not events; never a miss. */
import { addDays, startOfDay } from '@/domain/time/calendar';

function daySet(dates: readonly Date[]): Set<number> {
  return new Set(dates.map((d) => startOfDay(d).getTime()));
}

/** Which of the trailing seven days carry a completion, oldest first. */
export function nudgeWeekFlags(dates: readonly Date[], now: Date): boolean[] {
  const days = daySet(dates);
  const today = startOfDay(now);
  return [6, 5, 4, 3, 2, 1, 0].map((back) => days.has(addDays(today, -back).getTime()));
}

/** Consecutive completion days ending today, or yesterday while today is still open. */
export function nudgeCurrentRun(dates: readonly Date[], now: Date): number {
  const days = daySet(dates);
  const today = startOfDay(now);
  let cursor = days.has(today.getTime()) ? today : addDays(today, -1);
  let run = 0;
  while (days.has(cursor.getTime())) {
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}

export function nudgeBestRun(dates: readonly Date[]): number {
  const days = daySet(dates);
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(new Date(day), -1).getTime())) continue;
    let run = 1;
    let cursor = new Date(day);
    while (days.has(addDays(cursor, 1).getTime())) {
      run += 1;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/** "6 of 7 days · best 12"; nothing before the first completion. */
export function nudgeStreakLine(dates: readonly Date[], now: Date): string | undefined {
  if (dates.length === 0) return undefined;
  const week = nudgeWeekFlags(dates, now).filter(Boolean).length;
  const current = nudgeCurrentRun(dates, now);
  return `${week} of 7 days · best ${Math.max(nudgeBestRun(dates), current)}`;
}

/** Exactly seven: whether 14 and 21 also fire is E's call, parked. */
export const NUDGE_MILESTONE_RUN = 7;

/** A crossing, so both sides are needed: a second Done for now on day seven leaves the run at seven. */
export function landsOnSeven(before: readonly Date[], after: readonly Date[], now: Date): boolean {
  return (
    nudgeCurrentRun(before, now) < NUDGE_MILESTONE_RUN &&
    nudgeCurrentRun(after, now) === NUDGE_MILESTONE_RUN
  );
}
