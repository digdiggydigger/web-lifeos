/**
 * `Nudges/NudgeScheduleParsing.swift`: a bounded cron subset, `MINUTE HOUR * * DOW-LIST`, with cron's
 * weekday numbering (`0` = Sunday … `6` = Saturday). Day-of-month, month and step values are
 * unsupported and parse to nothing, i.e. never computably due.
 */
export interface NudgeSchedule {
  readonly hour: number;
  readonly minute: number;
  readonly weekdays: ReadonlySet<number>;
}

export const WEEKDAY_SYMBOLS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const EVERY_DAY: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6]);

export const DEFAULT_NUDGE_SCHEDULE: NudgeSchedule = { hour: 9, minute: 0, weekdays: EVERY_DAY };

function integer(token: string): number | undefined {
  return /^\d+$/.test(token) ? Number(token) : undefined;
}

/** Cron allows both `0` and `7` for Sunday; `7` normalises to `0`. */
function normalizedDay(token: string): number | undefined {
  const value = integer(token);
  if (value === undefined) return undefined;
  if (value === 7) return 0;
  return value >= 0 && value <= 6 ? value : undefined;
}

function parseWeekdays(field: string): Set<number> | undefined {
  if (field === '*') return new Set(EVERY_DAY);
  const result = new Set<number>();
  for (const token of field.split(',')) {
    const dash = token.indexOf('-');
    if (dash >= 0) {
      const lower = normalizedDay(token.slice(0, dash));
      const upper = normalizedDay(token.slice(dash + 1));
      if (lower === undefined || upper === undefined || lower > upper) return undefined;
      for (let day = lower; day <= upper; day += 1) result.add(day);
    } else {
      const day = normalizedDay(token);
      if (day === undefined) return undefined;
      result.add(day);
    }
  }
  return result;
}

export function parseSchedule(cron: string): NudgeSchedule | undefined {
  const fields = cron.split(' ').filter((f) => f.length > 0);
  if (fields.length !== 5) return undefined;
  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (dayOfMonth !== '*' || month !== '*') return undefined;
  const minute = integer(minuteField);
  if (minute === undefined || minute > 59) return undefined;
  const hour = integer(hourField);
  if (hour === undefined || hour > 23) return undefined;
  const weekdays = parseWeekdays(dayOfWeek);
  if (!weekdays || weekdays.size === 0) return undefined;
  return { hour, minute, weekdays };
}

/** Weekdays always encode as a sorted comma list: `1-5` round-trips as `1,2,3,4,5`, equivalent, not byte-identical. */
export function encodeSchedule(schedule: NudgeSchedule): string {
  return `${schedule.minute} ${schedule.hour} * * ${[...schedule.weekdays].sort((a, b) => a - b).join(',')}`;
}

export function sameSchedule(a: NudgeSchedule | undefined, b: NudgeSchedule | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.hour !== b.hour || a.minute !== b.minute || a.weekdays.size !== b.weekdays.size)
    return false;
  for (const day of a.weekdays) if (!b.weekdays.has(day)) return false;
  return true;
}

function clock(schedule: NudgeSchedule): string {
  return `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
}

/** "Daily at 21:00" / "Mon, Wed at 09:30"; nothing for a cron string the app cannot parse (shown raw instead, never invented). */
export function scheduleSummary(cron: string): string | undefined {
  const schedule = parseSchedule(cron);
  if (!schedule) return undefined;
  if (schedule.weekdays.size === 7) return `Daily at ${clock(schedule)}`;
  const days = [...schedule.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_SYMBOLS[d]);
  return `${days.join(', ')} at ${clock(schedule)}`;
}
