// Ports of MomentumScoreboardTests, MomentumScoreboardV3Tests, ActiveGoalSelectionTests, DailyGoalTrackerTests
// (the tracker half), MomentumWeekReviewTests, MomentumWeekChartsTests, HomeInboxPeekTests,
// HomeLifeAreasSectionTests and HomeNudgesSectionTests (the half that needs no schedule maths).
import { describe, expect, it } from 'vitest';

import type {
  Capture,
  CompletedFocusSession,
  LifeArea,
  Nudge,
  Task,
  TaskPriority,
} from '@/domain/types';

import {
  areaMomentum,
  areaRate,
  areaStatusLine,
  barFractions,
  bestNextMove,
  bestStreak,
  buildWeekReview,
  clearedToday,
  closedCaption,
  closedPerDay,
  closedThisWeek,
  createDailyGoalTracker,
  dailyGoalAnnouncement,
  dailyGoalCrossed,
  dismissedToday,
  effortLabel,
  FIRST_NUDGE_DIRECTIVE,
  focusCaption,
  focusLoggedTodayLabel,
  focusMinutesPerDay,
  inboxCountLine,
  inboxHandledLine,
  inboxOverflowLine,
  inboxPeek,
  inboxTimeLabel,
  lifeAreasCollapsedLine,
  nudgeCards,
  nudgeChipText,
  nudgeCountLine,
  nudgeDoorSubtitle,
  nudgeNextFireLine,
  nudgesUpcoming,
  nudgeOverflowLine,
  nudgeScheduledCount,
  ringProgress,
  showsArrangeControl,
  streak,
  streakLine,
  topTask,
  trailingWeekClosureFlags,
} from './index';

const now = new Date(2026, 7, 14, 9, 41);
const daysAgo = (n: number, hour = 8) => new Date(2026, 7, 14 - n, hour, 0, 0);
let seq = 0;
function doneTask(n: number, hour = 8, extra: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `D${seq}`,
    title: 'Done',
    status: 'done',
    priority: 'p3',
    completedAt: daysAgo(n, hour),
    ...extra,
  };
}
function openTask(
  title: string,
  o: { priority?: TaskPriority; due?: number; focus?: number; area?: string } = {},
): Task {
  seq += 1;
  return {
    id: `O${seq}`,
    title,
    status: 'open',
    priority: o.priority ?? 'p3',
    ...(o.due !== undefined ? { dueDate: new Date(now.getTime() + o.due * 86_400_000) } : {}),
    ...(o.focus !== undefined ? { focusDurationSeconds: o.focus } : {}),
    ...(o.area ? { lifeAreaId: o.area } : {}),
  };
}
function session(
  n: number,
  o: { planned?: number; focused?: number; taskId?: string } = {},
): CompletedFocusSession {
  seq += 1;
  const ended = new Date(now.getTime() - n * 86_400_000);
  return {
    id: `S${seq}`,
    taskTitle: 'Sprint',
    lifeAreaEmoji: '💼',
    plannedSeconds: o.planned ?? 1500,
    focusedSeconds: o.focused ?? 1500,
    checkpointsReached: 0,
    completedNaturally: true,
    startedAt: new Date(ended.getTime() - (o.focused ?? 1500) * 1000),
    endedAt: ended,
    ...(o.taskId ? { taskId: o.taskId } : {}),
  };
}
function nudge(dismissedDaysAgo: number | undefined, active = true, created = 30): Nudge {
  seq += 1;
  return {
    id: `N${seq}`,
    label: 'Water the plants',
    schedule: '0 9 * * *',
    active,
    createdAt: new Date(now.getTime() - created * 86_400_000),
    updatedAt: now,
    ...(dismissedDaysAgo !== undefined
      ? { lastFiredAt: new Date(now.getTime() - dismissedDaysAgo * 86_400_000) }
      : {}),
  };
}

describe('streaks', () => {
  it('current streak: consecutive days, once per day, alive from yesterday, broken by a gap, ignores stampless', () => {
    expect(streak([], now)).toBe(0);
    expect(streak([doneTask(0), doneTask(1), doneTask(2)], now)).toBe(3);
    expect(streak([doneTask(0), doneTask(0, 6), doneTask(1)], now)).toBe(2);
    expect(streak([doneTask(1), doneTask(2)], now)).toBe(2);
    expect(streak([doneTask(0), doneTask(2), doneTask(3)], now)).toBe(1);
    expect(streak([doneTask(2), doneTask(3)], now)).toBe(0);
    expect(streak([{ id: 'x', title: 'x', status: 'done', priority: 'p3' }], now)).toBe(0);
  });
  it('best streak finds the longest run anywhere, counting days not items; the streak line', () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak([doneTask(10), doneTask(9), doneTask(8), doneTask(0), doneTask(4)])).toBe(3);
    expect(bestStreak([doneTask(0), doneTask(0, 6), doneTask(0, 7)])).toBe(1);
    expect(bestStreak([doneTask(0), doneTask(1), doneTask(2)])).toBe(3);
    expect(streakLine(3, 5, 1)).toBe('Streak kept. Best is 5.');
    expect(streakLine(6, 5, 1)).toBe('Streak kept. Best is 6.');
    expect(streakLine(1, 1, 0)).toBe('One day closed. Keep it alive today.');
    expect(streakLine(4, 4, 0)).toBe('4 days closed in a row.');
  });
});

describe('ring and best next move', () => {
  it('ring progress is closed over goal, capped, tolerant of absurd goals', () => {
    expect(ringProgress(2, 5)).toBeCloseTo(0.4, 3);
    expect(ringProgress(9, 5)).toBe(1);
    expect(ringProgress(0, 5)).toBe(0);
    expect(ringProgress(1, 0)).toBe(1);
    expect(ringProgress(0, 0)).toBe(0);
  });
  it('prefers the shortest effort among due today, counts overdue as due now, ranks unknown effort last, falls back to the active goal', () => {
    const quick = openTask('Quick', { priority: 'p2', due: 0, focus: 900 });
    const deep = openTask('Deep', { priority: 'p1', due: 0, focus: 1500 });
    const tomorrow = openTask('Tomorrow', { priority: 'p1', due: 1, focus: 300 });
    expect(bestNextMove([deep, tomorrow, quick], now)?.title).toBe('Quick');
    const overdue = openTask('Overdue', { due: -1, focus: 600 });
    const someday = openTask('Someday', { priority: 'p1', focus: 300 });
    expect(bestNextMove([someday, overdue], now)?.title).toBe('Overdue');
    const unknown = openTask('Unknown', { priority: 'p1', due: 0 });
    const estimated = openTask('Estimated', { priority: 'p4', due: 0, focus: 1800 });
    expect(bestNextMove([unknown, estimated], now)?.title).toBe('Estimated');
    const urgent = openTask('Urgent', { priority: 'p1', due: 3 });
    const ambient = openTask('Ambient', { priority: 'p4' });
    expect(bestNextMove([ambient, urgent], now)?.title).toBe('Urgent');
    expect(bestNextMove([], now)).toBeUndefined();
  });
  it('active goal: empty and done-only are nothing; highest band wins; earliest due within a band, undated last; ties keep input order', () => {
    expect(topTask([])).toBeUndefined();
    expect(
      topTask([{ id: 'x', title: 'Done thing', status: 'done', priority: 'p1' }]),
    ).toBeUndefined();
    expect(
      topTask([
        openTask('Routine'),
        openTask('Urgent', { priority: 'p1' }),
        openTask('Soonish', { priority: 'p2' }),
      ])?.title,
    ).toBe('Urgent');
    expect(
      topTask([
        openTask('Undated', { priority: 'p1' }),
        openTask('Later', { priority: 'p1', due: 2 }),
        openTask('Soonest', { priority: 'p1', due: 0 }),
      ])?.title,
    ).toBe('Soonest');
    expect(
      topTask([openTask('First in', { priority: 'p2' }), openTask('Second in', { priority: 'p2' })])
        ?.title,
    ).toBe('First in');
  });
});

describe('week, areas, counts', () => {
  it('closed this week is the trailing seven days; flags mark each day; area momentum groups and carries the last close', () => {
    expect(closedThisWeek([doneTask(6), doneTask(7), doneTask(0)], now)).toHaveLength(2);
    expect(trailingWeekClosureFlags([doneTask(0), doneTask(2), doneTask(6)], now)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      true,
    ]);
    const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
    const health: LifeArea = {
      id: 'H',
      name: 'Health',
      colour: '🏋',
      sortOrder: 1,
      archived: false,
    };
    const items = areaMomentum(
      [work, health],
      [openTask('Open work', { area: 'W' })],
      [doneTask(1, 8, { lifeAreaId: 'W' })],
      now,
    );
    expect(items).toHaveLength(2);
    expect([items[0]!.closedThisWeek, items[0]!.open]).toEqual([1, 1]);
    expect(areaRate(items[0]!.closedThisWeek, items[0]!.open)).toBeCloseTo(0.5, 3);
    expect(areaRate(items[1]!.closedThisWeek, items[1]!.open)).toBeUndefined();
    expect(items[0]!.lastClosedAt).toEqual(daysAgo(1));
    expect(items[1]!.lastClosedAt).toBeUndefined();
    expect(areaRate(2, 1)).toBeCloseTo(2 / 3, 3);
    expect(areaRate(3, 0)).toBe(1);
  });
  it('area status lines', () => {
    expect(areaStatusLine(3, 0, daysAgo(1), now)).toEqual({
      text: '3 of 3 closed — all clear',
      tone: 'clear',
    });
    expect(areaStatusLine(2, 1, daysAgo(1), now)).toEqual({
      text: '2 of 3 tasks closed',
      tone: 'plain',
    });
    const sunday = new Date(2026, 7, 9, 8);
    expect(areaStatusLine(1, 1, sunday, now)).toEqual({
      text: `1 of 2 closed — quiet since ${sunday.toLocaleDateString(undefined, { weekday: 'long' })}`,
      tone: 'quiet',
    });
    expect(areaStatusLine(0, 2, daysAgo(9), now)).toEqual({
      text: '0 of 2 closed — quiet all week',
      tone: 'quiet',
    });
    expect(areaStatusLine(0, 2, undefined, now)).toEqual({
      text: '0 of 2 tasks closed',
      tone: 'plain',
    });
    expect(areaStatusLine(0, 0, undefined, now)).toEqual({
      text: 'Nothing open or closed this week',
      tone: 'plain',
    });
  });
  it('cleared today, dismissed today (deactivated still counts), effort labels, focus logged today', () => {
    const cleared = (n: number | undefined): Capture => ({
      id: `C${n}`,
      content: 'x',
      kind: 'note',
      processed: true,
      createdAt: now,
      ...(n !== undefined ? { clearedAt: new Date(now.getTime() - n * 86_400_000) } : {}),
    });
    expect(clearedToday([cleared(0), cleared(0), cleared(1), cleared(undefined)], now)).toBe(2);
    expect(dismissedToday([nudge(0), nudge(0), nudge(1), nudge(undefined)], now)).toBe(2);
    expect(dismissedToday([nudge(0, false)], now)).toBe(1);
    expect(effortLabel(900)).toBe('15 min');
    expect(effortLabel(1500)).toBe('25 min');
    expect(effortLabel(30)).toBe('1 min');
    expect(effortLabel(undefined)).toBeUndefined();
    expect(
      focusLoggedTodayLabel(
        [session(0, { taskId: 'T', focused: 900 }), session(0, { taskId: 'T', focused: 600 })],
        'T',
        now,
      ),
    ).toBe('2 sessions · 25 min today');
    expect(focusLoggedTodayLabel([session(0, { taskId: 'T', focused: 30 })], 'T', now)).toBe(
      '1 session today',
    );
    expect(focusLoggedTodayLabel([session(1, { taskId: 'T' })], 'T', now)).toBeUndefined();
  });
});

describe('daily goal tracker', () => {
  const rules = (goal: number, captures = true, nudges = true) => ({
    goal,
    countsClearedCaptures: captures,
    countsNudges: nudges,
  });
  it('crossing is true only when the count arrives at the goal', () => {
    expect(dailyGoalCrossed(4, 5, 5)).toBe(true);
    expect(dailyGoalCrossed(3, 7, 5)).toBe(true);
    expect(dailyGoalCrossed(3, 4, 5)).toBe(false);
    expect(dailyGoalCrossed(5, 6, 5)).toBe(false);
    expect(dailyGoalCrossed(0, 0, 0)).toBe(false);
  });
  it('the first observation never counts; a rise counts once; unsettled neither counts nor moves the baseline; rule changes never count', () => {
    let t = createDailyGoalTracker();
    expect(t.observe(6, rules(5), true)).toBe(false);
    t = createDailyGoalTracker();
    t.observe(3, rules(5), true);
    expect(t.observe(5, rules(5), true)).toBe(true);
    expect(t.observe(6, rules(5), true)).toBe(false);
    t = createDailyGoalTracker();
    t.observe(6, rules(5), true);
    expect(t.observe(3, rules(5), false)).toBe(false);
    expect(t.observe(6, rules(5), true)).toBe(false);
    t = createDailyGoalTracker();
    t.observe(4, rules(8), true);
    expect(t.observe(4, rules(3), true)).toBe(false);
    t = createDailyGoalTracker();
    t.observe(3, rules(5, false), true);
    expect(t.observe(8, rules(5, true), true)).toBe(false);
    t = createDailyGoalTracker();
    t.observe(3, rules(5, false), true);
    t.observe(3, rules(5, true), true);
    expect(t.observe(5, rules(5, true), true)).toBe(true);
    expect(dailyGoalAnnouncement(5, 5)).toBe('Daily goal reached — 5 of 5 closed today');
    expect(dailyGoalAnnouncement(7, 5)).toBe('Daily goal reached — 7 of 5 closed today');
  });
});

describe('week charts and review', () => {
  it('buckets closures and focus minutes by day, normalises bars, and captions the window', () => {
    expect(closedPerDay([doneTask(0), doneTask(0), doneTask(6), doneTask(8)], now)).toEqual([
      1, 0, 0, 0, 0, 0, 2,
    ]);
    expect(closedPerDay([openTask('Open')], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(
      focusMinutesPerDay(
        [
          session(0, { focused: 600 }),
          session(0, { focused: 900 }),
          session(6, { focused: 1500 }),
          session(7, { focused: 3000 }),
        ],
        now,
      ),
    ).toEqual([25, 0, 0, 0, 0, 0, 25]);
    expect(barFractions([1, 0, 4, 2])).toEqual([0.25, 0, 1, 0.5]);
    expect(barFractions([0, 0, 0])).toEqual([0, 0, 0]);
    expect(
      closedCaption([session(0, { focused: 1500 }), session(8, { focused: 6000 })], now, 'en-US'),
    ).toBe('Sat–Fri, items closed. 25 focus minutes logged.');
    expect(closedCaption([], now, 'en-US')).toBe('Sat–Fri, items closed. 0 focus minutes logged.');
    expect(
      focusCaption(
        [
          session(1, { focused: 900, planned: 1500 }),
          session(2, { focused: 600, planned: 1500 }),
          session(8, { focused: 6000, planned: 6000 }),
        ],
        now,
      ),
    ).toBe('25 minutes logged against 50 targeted.');
    expect(focusCaption([], now)).toBeUndefined();
  });
  it('the week review: headline, bars, wins, stamina, quiet line, kickstart', () => {
    const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
    const hobbies: LifeArea = {
      id: 'H',
      name: 'Hobbies',
      colour: '🎨',
      sortOrder: 1,
      archived: false,
    };
    const base = { lifeAreas: [], sessions: [], inboxCount: 0, now, locale: 'en-US' } as const;
    expect(
      buildWeekReview({
        ...base,
        tasks: [
          doneTask(0, 9, { title: 'A' }),
          doneTask(6, 9, { title: 'B' }),
          doneTask(8, 9, { title: 'Old' }),
        ],
        sessions: [session(1, { planned: 1500, focused: 1200 })],
      }).headline,
    ).toBe('2 closed · 20 focus minutes');
    const bars = buildWeekReview({ ...base, tasks: [doneTask(0), doneTask(0), doneTask(2)] });
    expect(bars.dayCounts).toEqual([0, 0, 0, 0, 1, 0, 2]);
    expect(bars.dayLabels).toHaveLength(7);
    expect(bars.dayLabels[6]).toBe('Fri');
    expect(
      buildWeekReview({
        ...base,
        tasks: [
          doneTask(4, 8, { title: 'Oldest' }),
          doneTask(1, 8, { title: 'Newer' }),
          doneTask(0, 8, { title: 'Newest' }),
          doneTask(2, 8, { title: 'Mid' }),
        ],
      }).dopamineWins,
    ).toEqual(['Newest', 'Newer', 'Mid']);
    expect(
      buildWeekReview({
        ...base,
        tasks: [],
        sessions: [
          session(0, { planned: 1200, focused: 600 }),
          session(2, { planned: 600, focused: 900 }),
        ],
      }).staminaLine,
    ).toBe('83% of targeted minutes actually logged');
    expect(buildWeekReview({ ...base, tasks: [] }).staminaLine).toBeUndefined();
    expect(
      buildWeekReview({
        ...base,
        tasks: [doneTask(0, 8, { lifeAreaId: 'W' }), openTask('B', { area: 'H' })],
        lifeAreas: [work, hobbies],
        inboxCount: 4,
      }).quietLine,
    ).toBe(
      'Nothing closed in Hobbies this week, and 4 captures are still unfiled. Neither is a failure — they are just what next week starts with.',
    );
    expect(
      buildWeekReview({ ...base, tasks: [doneTask(0, 8, { lifeAreaId: 'W' })], lifeAreas: [work] })
        .quietLine,
    ).toBeUndefined();
    expect(
      buildWeekReview({
        ...base,
        tasks: [
          openTask('Slow', { focus: 1800 }),
          openTask('Quick', { focus: 300 }),
          openTask('Mid', { focus: 900 }),
          openTask('Unknown'),
        ],
      }).kickstart,
    ).toEqual(['5 min · Quick', '15 min · Mid']);
  });
});

describe('home sections', () => {
  it('inbox peek: newest three, count, overflow, handled, time label', () => {
    const cap = (content: string, minutesAgo: number): Capture => ({
      id: content,
      content,
      kind: 'note',
      processed: false,
      createdAt: new Date(now.getTime() - minutesAgo * 60_000),
    });
    expect(
      inboxPeek([cap('fourth', 40), cap('second', 20), cap('first', 10), cap('third', 30)]).map(
        (c) => c.content,
      ),
    ).toEqual(['first', 'second', 'third']);
    expect(inboxCountLine(0)).toBe('Inbox clear');
    expect(inboxCountLine(1)).toBe('1 waiting');
    expect(inboxCountLine(4)).toBe('4 waiting');
    expect(inboxOverflowLine(3)).toBeUndefined();
    expect(inboxOverflowLine(4)).toBe('and 1 more');
    expect(inboxOverflowLine(6)).toBe('and 3 more');
    expect(inboxHandledLine(0)).toBeUndefined();
    expect(inboxHandledLine(1)).toBe('1 handled today');
    expect(inboxHandledLine(3)).toBe('3 handled today');
    expect(inboxTimeLabel(cap('x', 5), now, 'en-GB')).toMatch(/\d{1,2}:36/);
    expect(inboxTimeLabel({ createdAt: daysAgo(3) }, now, 'en-GB')).toContain('Aug');
  });
  it('life areas collapsed line and the arrange control', () => {
    const item = (open: number): ReturnType<typeof areaMomentum>[number] => ({
      area: { id: `A${open}`, name: 'A', colour: '🏠', sortOrder: 0, archived: false },
      closedThisWeek: 0,
      open,
      lastClosedAt: undefined,
    });
    expect(lifeAreasCollapsedLine([item(2), item(3)])).toBe('2 areas · 5 open');
    expect(lifeAreasCollapsedLine([item(1)])).toBe('1 area · 1 open');
    expect(lifeAreasCollapsedLine([item(0), item(0)])).toBe('2 areas · nothing open');
    expect(lifeAreasCollapsedLine([])).toBe('No areas yet');
    expect(showsArrangeControl(8, false)).toBe(false);
    expect(showsArrangeControl(2, true)).toBe(true);
    expect(showsArrangeControl(1, true)).toBe(false);
    expect(showsArrangeControl(0, true)).toBe(false);
  });
  it('nudge cards cap at three longest-waiting first; overflow, count and door copy; scheduled excludes inactive', () => {
    const due = [nudge(1), nudge(3), nudge(0), nudge(2)];
    expect(nudgeCards(due)).toHaveLength(3);
    expect(nudgeCards(due).map((n) => n.lastFiredAt)).toEqual([
      due[1]!.lastFiredAt,
      due[3]!.lastFiredAt,
      due[0]!.lastFiredAt,
    ]);
    const never = nudge(undefined, true, 10);
    expect(nudgeCards([nudge(2), never])[0]).toBe(never);
    expect(nudgeOverflowLine(3)).toBeUndefined();
    expect(nudgeOverflowLine(4)).toBe('and 1 more due');
    expect(nudgeOverflowLine(7)).toBe('and 4 more due');
    expect(nudgeOverflowLine(0)).toBeUndefined();
    expect(nudgeCountLine(2, 3)).toBe('2 due · 3 scheduled');
    expect(nudgeCountLine(0, 3)).toBe('Nothing due · 3 scheduled');
    expect(nudgeCountLine(0, 0)).toBe('No nudges yet');
    const d = nudge(0);
    expect(nudgeScheduledCount([d, nudge(undefined)], [d])).toBe(1);
    expect(nudgeScheduledCount([d, nudge(undefined, false)], [d])).toBe(0);
    expect(nudgeDoorSubtitle(1, 0)).toBe('Waiting on you — clear them when you can.');
    expect(nudgeDoorSubtitle(0, 2)).toBe('Nothing due — all on time.');
    expect(nudgeDoorSubtitle(0, 0)).toBe('Recurring reminders you set for yourself.');
    expect(nudgeChipText(2, 1)).toBe('2 due');
    expect(nudgeChipText(0, 4)).toBe('4 scheduled');
    expect(nudgeChipText(0, 0)).toBe('None yet');
    expect(FIRST_NUDGE_DIRECTIVE).toBe('Add your first nudge');
  });
  it('next-fire line names today, tomorrow, then the weekday; upcoming is soonest first, excluding due, paused and unparseable', () => {
    // 14 Aug 2026 is a Friday.
    const at = (schedule: string, active = true): Nudge => ({
      ...nudge(undefined, active, 30),
      schedule,
    });
    expect(nudgeNextFireLine(at('0 18 * * *'), now, 'en-GB')).toMatch(/^Today 18:00$/);
    expect(nudgeNextFireLine(at('0 5 * * *'), now, 'en-GB')).toMatch(/^Tomorrow 0?5:00$/);
    expect(nudgeNextFireLine(at('30 9 * * 1'), now, 'en-GB')).toMatch(/^Mon 0?9:30$/);
    expect(nudgeNextFireLine(at('0 9 1 * *'), now, 'en-GB')).toBeUndefined();
    expect(nudgeNextFireLine(at('0 18 * * *', false), now, 'en-GB')).toBeUndefined();
    const monday = at('30 9 * * 1');
    const tonight = at('0 18 * * *');
    const dawn = at('0 5 * * *');
    const paused = at('0 13 * * *', false);
    const broken = at('0 9 1 * *');
    const dueOne = { ...at('0 9 * * *'), lastFiredAt: new Date(now.getTime() - 5 * 86_400_000) };
    expect(
      nudgesUpcoming([monday, tonight, dueOne, paused, broken, dawn], [dueOne], now).map(
        (n) => n.id,
      ),
    ).toEqual([tonight.id, dawn.id, monday.id]);
    const four = [at('0 10 * * *'), at('0 11 * * *'), at('0 12 * * *'), at('0 13 * * *')];
    expect(nudgesUpcoming(four, [], now)).toHaveLength(3);
  });
});
