// Ports of NudgeScheduleParsingTests, NudgeDuenessTests (local-time cases), NudgeStreakTests,
// NudgeSchedulePresetTests, NudgeValidationTests, NudgeFirstRunMarkerTests and
// NudgeNotificationSchedulingTests.
import { describe, expect, it } from 'vitest';

import type { Nudge } from '@/domain/types';

import {
  daySummary,
  DEFAULT_NUDGE_SCHEDULE,
  encodeSchedule,
  EVERY_DAY,
  hasEverHadNudges,
  isEmptyNudgeUpdate,
  isNudgeDue,
  landsOnSeven,
  markHasHadNudges,
  matchingPreset,
  nextFire,
  normalizeCreateNudgeInput,
  normalizeUpdateNudgeInput,
  NUDGE_SCHEDULE_PRESETS,
  nudgeBestRun,
  nudgeCurrentRun,
  nudgeFirstRunKey,
  nudgeStreakLine,
  nudgeWeekFlags,
  parseSchedule,
  presetTitle,
  presetWeekdays,
  scheduleSummary,
  triggerComponents,
  WEEKDAY_SYMBOLS,
} from './index';

const sched = (hour: number, minute: number, days: Iterable<number>) => ({
  hour,
  minute,
  weekdays: new Set(days),
});

describe('schedule parsing', () => {
  it('parses the presets and arbitrary combinations, normalising 7 to Sunday', () => {
    expect(parseSchedule('0 9 * * *')).toEqual(sched(9, 0, EVERY_DAY));
    expect(parseSchedule('0 9 * * 1-5')).toEqual(sched(9, 0, [1, 2, 3, 4, 5]));
    expect(parseSchedule('0 9 * * 1')).toEqual(sched(9, 0, [1]));
    expect(parseSchedule('0 8 * * 2,4')).toEqual(sched(8, 0, [2, 4]));
    expect(parseSchedule('30 18 * * *')).toEqual(sched(18, 30, EVERY_DAY));
    expect(parseSchedule('0 10 * * 6,0')).toEqual(sched(10, 0, [0, 6]));
    expect(parseSchedule('0 9 * * 7')).toEqual(sched(9, 0, [0]));
  });
  it('rejects day-of-month, month, steps, empty day lists, out-of-range and non-numeric fields', () => {
    for (const cron of [
      '0 9 1 * *',
      '0 9 * 6 *',
      '0 */2 * * *',
      '*/15 9 * * *',
      '0 9 * *',
      '0 24 * * *',
      '0 9 * * 8',
      '0 9 * * * *',
      'abc 9 * * *',
      '0 9 * * 5-1',
    ])
      expect(parseSchedule(cron), cron).toBeUndefined();
  });
  it('encodes as a sorted comma list and round-trips; the summary reads as plain English', () => {
    expect(parseSchedule(encodeSchedule(sched(8, 0, [2, 4])))).toEqual(sched(8, 0, [2, 4]));
    expect(encodeSchedule(sched(8, 0, [4, 2]))).toBe('0 8 * * 2,4');
    expect(scheduleSummary('0 21 * * *')).toBe('Daily at 21:00');
    expect(scheduleSummary('30 9 * * 1,3')).toBe('Mon, Wed at 09:30');
    expect(scheduleSummary('not-cron')).toBeUndefined();
    expect(DEFAULT_NUDGE_SCHEDULE).toEqual(sched(9, 0, EVERY_DAY));
  });
});

function nudge(o: {
  schedule?: string;
  active?: boolean;
  lastFiredAt?: Date;
  createdAt: Date;
  completionDates?: Date[];
}): Nudge {
  return {
    id: 'N',
    label: 'Morning check-in',
    schedule: o.schedule ?? '0 9 * * *',
    active: o.active ?? true,
    createdAt: o.createdAt,
    updatedAt: o.createdAt,
    ...(o.lastFiredAt ? { lastFiredAt: o.lastFiredAt } : {}),
    ...(o.completionDates ? { completionDates: o.completionDates } : {}),
  };
}
// July 2026: the 13th is a Monday, the 15th a Wednesday, the 17th a Friday.
const jul = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 6, day, hour, minute, second);

describe('dueness (local time)', () => {
  it('inactive is never due; a never-fired daily nudge is due once its schedule elapsed since creation; a fired one waits for the next', () => {
    expect(isNudgeDue(nudge({ active: false, createdAt: new Date(2020, 0, 1) }), jul(15, 9))).toBe(
      false,
    );
    expect(isNudgeDue(nudge({ createdAt: jul(1, 9) }), jul(15, 9))).toBe(true);
    expect(
      isNudgeDue(nudge({ lastFiredAt: jul(15, 9), createdAt: new Date(2020, 0, 1) }), jul(15, 15)),
    ).toBe(false);
    expect(
      isNudgeDue(nudge({ lastFiredAt: jul(15, 9), createdAt: new Date(2020, 0, 1) }), jul(16, 9)),
    ).toBe(true);
  });
  it('is due exactly at the next fire and not a second before', () => {
    expect(isNudgeDue(nudge({ createdAt: jul(14, 9) }), jul(15, 9))).toBe(true);
    expect(isNudgeDue(nudge({ createdAt: jul(14, 9) }), jul(15, 8, 59, 59))).toBe(false);
  });
  it('honours weekday sets: weekdays skip the weekend, Monday-only waits a week, Tue/Thu and weekends', () => {
    expect(isNudgeDue(nudge({ schedule: '0 9 * * 1-5', createdAt: jul(17, 9) }), jul(18, 9))).toBe(
      false,
    );
    expect(isNudgeDue(nudge({ schedule: '0 9 * * 1-5', createdAt: jul(17, 9) }), jul(20, 9))).toBe(
      true,
    );
    expect(isNudgeDue(nudge({ schedule: '0 9 * * 1', createdAt: jul(13, 9) }), jul(16, 9))).toBe(
      false,
    );
    expect(isNudgeDue(nudge({ schedule: '0 9 * * 1', createdAt: jul(13, 9) }), jul(20, 9))).toBe(
      true,
    );
    expect(isNudgeDue(nudge({ schedule: '0 8 * * 2,4', createdAt: jul(14, 8) }), jul(15, 8))).toBe(
      false,
    );
    expect(isNudgeDue(nudge({ schedule: '0 8 * * 2,4', createdAt: jul(14, 8) }), jul(16, 8))).toBe(
      true,
    );
    expect(
      isNudgeDue(nudge({ schedule: '0 10 * * 6,0', createdAt: jul(17, 10) }), jul(17, 23, 59, 59)),
    ).toBe(false);
    expect(
      isNudgeDue(nudge({ schedule: '0 10 * * 6,0', createdAt: jul(17, 10) }), jul(18, 10)),
    ).toBe(true);
    expect(
      isNudgeDue(nudge({ schedule: '0 8 * * *', createdAt: jul(14, 8) }), jul(15, 7, 59, 59)),
    ).toBe(false);
    expect(isNudgeDue(nudge({ schedule: '0 8 * * *', createdAt: jul(14, 8) }), jul(15, 8))).toBe(
      true,
    );
  });
  it('an unsupported schedule is never due and has no next fire; paused has none either', () => {
    expect(
      isNudgeDue(nudge({ schedule: '0 9 1 * *', createdAt: new Date(2020, 0, 1) }), jul(15, 9)),
    ).toBe(false);
    expect(
      nextFire(nudge({ schedule: '0 9 1 * *', createdAt: jul(1, 9) }), jul(15, 9)),
    ).toBeUndefined();
    expect(nextFire(nudge({ active: false, createdAt: jul(1, 9) }), jul(15, 9))).toBeUndefined();
    expect(nextFire(nudge({ createdAt: jul(1, 9) }), jul(15, 9))).toEqual(jul(16, 9));
    expect(nextFire(nudge({ schedule: '30 5 * * 1', createdAt: jul(1, 9) }), jul(15, 9))).toEqual(
      jul(20, 5, 30),
    );
  });
});

const now = new Date(2026, 7, 14, 9, 41);
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('streaks', () => {
  it('week flags, current and best runs, an unfinished today, the line', () => {
    expect(nudgeWeekFlags([day(0), day(2), day(9)], now)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      true,
    ]);
    const dates = [day(0), day(1), day(2), day(10), day(11), day(12), day(13)];
    expect(nudgeCurrentRun(dates, now)).toBe(3);
    expect(nudgeBestRun(dates)).toBe(4);
    expect(nudgeCurrentRun([day(1), day(2)], now)).toBe(2);
    expect(nudgeStreakLine([day(0), day(1), day(2), day(3), day(4), day(6)], now)).toBe(
      '6 of 7 days · best 5',
    );
    expect(nudgeStreakLine([], now)).toBeUndefined();
  });
  it('lands on seven only when the run arrives at seven', () => {
    const run = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => day(from + i));
    expect(landsOnSeven(run(1, 6), [...run(1, 6), day(0)], now)).toBe(true);
    expect(landsOnSeven(run(1, 5), [...run(1, 5), day(0)], now)).toBe(false);
    expect(landsOnSeven(run(1, 7), [...run(1, 7), day(0)], now)).toBe(false);
    expect(landsOnSeven(run(0, 6), [...run(0, 6), day(0)], now)).toBe(false);
  });
});

describe('presets', () => {
  it('the sets each preset stands for, recognition, summaries and titles', () => {
    expect(presetWeekdays('daily')).toEqual(EVERY_DAY);
    expect(presetWeekdays('weekdays')).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(presetWeekdays('weekends')).toEqual(new Set([0, 6]));
    expect(presetWeekdays('custom')).toBeUndefined();
    expect(matchingPreset(EVERY_DAY)).toBe('daily');
    expect(matchingPreset(new Set([1, 2, 3, 4, 5]))).toBe('weekdays');
    expect(matchingPreset(new Set([0, 6]))).toBe('weekends');
    expect(matchingPreset(new Set([1, 3, 5]))).toBe('custom');
    expect(matchingPreset(new Set([2]))).toBe('custom');
    expect(matchingPreset(new Set())).toBe('custom');
    for (const preset of NUDGE_SCHEDULE_PRESETS)
      if (preset !== 'custom') expect(matchingPreset(presetWeekdays(preset)!)).toBe(preset);
    expect(daySummary(EVERY_DAY)).toBe('Every day');
    expect(daySummary(new Set([1, 2, 3, 4, 5]))).toBe('Every weekday');
    expect(daySummary(new Set([0, 6]))).toBe('Weekends');
    expect(daySummary(new Set([5, 1, 3]))).toBe('Mon, Wed, Fri');
    expect(daySummary(new Set([4, 0]))).toBe('Sun, Thu');
    expect(daySummary(new Set())).toBe('No days selected');
    expect(NUDGE_SCHEDULE_PRESETS.map(presetTitle)).toEqual([
      'Daily',
      'Weekdays',
      'Weekends',
      'Custom',
    ]);
    expect(WEEKDAY_SYMBOLS).toHaveLength(7);
  });
});

describe('validation', () => {
  const dailyAt9 = sched(9, 0, EVERY_DAY);
  const original = nudge({ createdAt: now });
  it('create trims, rejects an empty label or no days, accepts arbitrary schedules', () => {
    expect(normalizeCreateNudgeInput('  Drink water  ', dailyAt9)).toEqual({
      ok: true,
      value: { label: 'Drink water', schedule: dailyAt9 },
    });
    expect(normalizeCreateNudgeInput('   ', dailyAt9)).toEqual({ ok: false, error: 'emptyLabel' });
    expect(normalizeCreateNudgeInput('Drink water', sched(9, 0, []))).toEqual({
      ok: false,
      error: 'invalidSchedule',
    });
    expect(normalizeCreateNudgeInput('Drink water', sched(8, 0, [2, 4]))).toEqual({
      ok: true,
      value: { label: 'Drink water', schedule: sched(8, 0, [2, 4]) },
    });
  });
  it('update carries only changed fields; a re-encoded equivalent schedule is not a change; an unparseable original makes any edit a change', () => {
    expect(
      normalizeUpdateNudgeInput({ ...original, label: 'Original' }, 'Updated', dailyAt9),
    ).toEqual({ ok: true, value: { label: 'Updated' } });
    const same = normalizeUpdateNudgeInput({ ...original, label: 'Same' }, 'Same', dailyAt9);
    expect(same.ok && isEmptyNudgeUpdate(same.value)).toBe(true);
    expect(
      normalizeUpdateNudgeInput(
        { label: 'Same', schedule: '0 9 * * 1-5' },
        'Same',
        sched(9, 0, [1, 2, 3, 4, 5]),
      ),
    ).toEqual({ ok: true, value: {} });
    expect(normalizeUpdateNudgeInput(original, '   ', dailyAt9)).toEqual({
      ok: false,
      error: 'emptyLabel',
    });
    expect(normalizeUpdateNudgeInput(original, original.label, sched(9, 0, []))).toEqual({
      ok: false,
      error: 'invalidSchedule',
    });
    expect(
      normalizeUpdateNudgeInput({ ...original, label: 'Original' }, 'Updated', sched(9, 0, [1])),
    ).toEqual({ ok: true, value: { label: 'Updated', schedule: sched(9, 0, [1]) } });
    expect(
      normalizeUpdateNudgeInput({ label: 'Original', schedule: '0 9 1 * *' }, 'Original', dailyAt9),
    ).toEqual({ ok: true, value: { schedule: dailyAt9 } });
  });
});

describe('first-run marker and notification triggers', () => {
  it('is keyed per account, latches idempotently, and tolerates no storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(hasEverHadNudges('alice', storage)).toBe(false);
    markHasHadNudges('alice', storage);
    markHasHadNudges('alice', storage);
    expect(hasEverHadNudges('alice', storage)).toBe(true);
    expect(hasEverHadNudges('bob', storage)).toBe(false);
    expect(nudgeFirstRunKey('alice')).toBe('nudges.hasEverHadAny.alice');
    expect(hasEverHadNudges('alice', undefined)).toBe(false);
  });
  it('one trigger per weekday in 1…7 numbering', () => {
    expect(triggerComponents(sched(9, 0, [1]))).toEqual([{ hour: 9, minute: 0, weekday: 2 }]);
    expect(triggerComponents(sched(18, 30, [1, 2, 3, 4, 5])).map((t) => t.weekday)).toEqual([
      2, 3, 4, 5, 6,
    ]);
    expect(triggerComponents(sched(9, 0, EVERY_DAY)).map((t) => t.weekday)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(triggerComponents(sched(9, 0, [0])).map((t) => t.weekday)).toEqual([1]);
    expect(triggerComponents(sched(9, 0, [6])).map((t) => t.weekday)).toEqual([7]);
  });
});
