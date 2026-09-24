/** `Nudges/NudgeSchedulePreset.swift`: the three repeat patterns almost every nudge wants, plus the escape hatch. */
import { EVERY_DAY, WEEKDAY_SYMBOLS } from './nudgeSchedule';

export type NudgeSchedulePreset = 'daily' | 'weekdays' | 'weekends' | 'custom';

/** Chip order; Custom last. */
export const NUDGE_SCHEDULE_PRESETS: readonly NudgeSchedulePreset[] = [
  'daily',
  'weekdays',
  'weekends',
  'custom',
];

/** Cron's Sunday is `0`, so weekdays are `1…5`, not `0…4`. Custom has no canonical set. */
export function presetWeekdays(preset: NudgeSchedulePreset): ReadonlySet<number> | undefined {
  switch (preset) {
    case 'daily':
      return EVERY_DAY;
    case 'weekdays':
      return new Set([1, 2, 3, 4, 5]);
    case 'weekends':
      return new Set([0, 6]);
    case 'custom':
      return undefined;
  }
}

export function presetTitle(preset: NudgeSchedulePreset): string {
  return { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends', custom: 'Custom' }[preset];
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** The empty set is `custom`, never `daily`: a lit Daily chip would promise a schedule the app refuses. */
export function matchingPreset(weekdays: ReadonlySet<number>): NudgeSchedulePreset {
  for (const preset of NUDGE_SCHEDULE_PRESETS) {
    if (preset === 'custom') continue;
    const days = presetWeekdays(preset);
    if (days && sameSet(days, weekdays)) return preset;
  }
  return 'custom';
}

/** The line under the chips; custom sets are listed in week order. */
export function daySummary(weekdays: ReadonlySet<number>): string {
  if (weekdays.size === 0) return 'No days selected';
  switch (matchingPreset(weekdays)) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return 'Every weekday';
    case 'weekends':
      return 'Weekends';
    case 'custom':
      return [...weekdays]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_SYMBOLS[d])
        .join(', ');
  }
}

/** The single letter each Custom chip shows; position resolves the two Ts and two Ss, Sunday first. */
export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
