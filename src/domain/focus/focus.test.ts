// Ports of FocusCheckpointsTests, the FocusSprintConfigurationTests plan cases, FocusAnalyticsTests,
// FocusSprintPresentationTests, SprintRingGeometryTests, FocusCadenceDraftTests, FocusCadenceReplanTests,
// FocusNotificationPlanningTests, the OfflineSprintSummaryCard / FocusCompletionCard lines, the
// FocusCompletionRecordTests value cases and the persistence codec.
import { describe, expect, it } from 'vitest';

import type { CompletedFocusSession } from '@/domain/types';

import {
  activeDayCount,
  activeGoalSprintState,
  advanceSession,
  cadenceCheckpoints,
  checkpointDotState,
  checkpointPrompt,
  collapseSwipeOutcome,
  completionSummaryLine,
  confirmedRecord,
  currentFocusWeek,
  dailyAverageSeconds,
  digitalTime,
  draftFromCadence,
  draftSummary,
  durationLabel,
  elapsedSeconds,
  evenlySpacedCheckpoints,
  focusBarAccessibilityLabel,
  focusCurrentStreak,
  focusGoalProgress,
  humanSpan,
  intervalCheckpoints,
  isProvisional,
  isSessionComplete,
  newFocusSession,
  nextCheckpoint,
  offlineSummaryLine,
  parseCompletedSessions,
  parsePersistedSprint,
  pausedBadge,
  peakDay,
  persistedCadence,
  persistedSprint,
  planForTask,
  planFocusNotifications,
  replannedCheckpoints,
  replanSession,
  resolvedCadence,
  ringDotCenter,
  ringFraction,
  rollingFocusDays,
  secondsUntilNextCheckpoint,
  selectingIntervalUnit,
  serializeCompletedSessions,
  serializePersistedSprint,
  sessionFromPersisted,
  sessionProgress,
  sprintPlanSummary,
  sprintStateTitle,
  standardCadence,
  STOP_CONFIRMATION,
  stopConfirmationMessage,
  totalFocusedSeconds,
  totalSessions,
} from './index';

const session = (duration: number, checkpoints: number[]) =>
  newFocusSession({
    taskId: 'T',
    taskTitle: 'Write tests',
    lifeAreaEmoji: '💼',
    durationSeconds: duration,
    nudgeCheckpoints: checkpoints,
  });

describe('checkpoints and cadence', () => {
  it('spaces evenly, never on the boundaries, dedupes, and respects the minimums', () => {
    expect(evenlySpacedCheckpoints(30, 1)).toEqual([15]);
    expect(evenlySpacedCheckpoints(60, 2)).toEqual([20, 40]);
    expect(evenlySpacedCheckpoints(900, 3)).toEqual([225, 450, 675]);
    expect(evenlySpacedCheckpoints(900, 0)).toEqual([]);
    expect(evenlySpacedCheckpoints(900, -3)).toEqual([]);
    expect(evenlySpacedCheckpoints(9, 2)).toEqual([]);
    const five = evenlySpacedCheckpoints(100, 5);
    expect(five).not.toContain(0);
    expect(five).not.toContain(100);
    const dense = evenlySpacedCheckpoints(12, 11);
    expect(new Set(dense).size).toBe(dense.length);
    expect(intervalCheckpoints(300, 60)).toEqual([60, 120, 180, 240]);
    expect(intervalCheckpoints(120, 10)).toEqual([30, 60, 90]);
    expect(intervalCheckpoints(60, 300)).toEqual([]);
    expect(standardCadence(60)).toEqual({ kind: 'count', count: 1 });
    expect(standardCadence(61)).toEqual({ kind: 'count', count: 2 });
    expect(cadenceCheckpoints({ kind: 'interval', seconds: 120 }, 900)).toEqual([
      120, 240, 360, 480, 600, 720, 840,
    ]);
  });
  it('the session: progress, crossing each checkpoint once, next checkpoint, clamping, prompts', () => {
    let s = session(100, []);
    expect(sessionProgress(s)).toBe(0);
    s = advanceSession(s, 25).session;
    expect(elapsedSeconds(s)).toBe(75);
    expect(sessionProgress(s)).toBeCloseTo(0.75, 4);

    let m = session(100, [25, 50, 75]);
    let step = advanceSession(m, 74);
    expect(step.crossed).toEqual([0]);
    m = step.session;
    step = advanceSession(m, 74);
    expect(step.crossed).toEqual([]);
    step = advanceSession(step.session, 20);
    expect(step.crossed).toEqual([1, 2]);
    expect([...step.session.triggeredCheckpointIndices].sort()).toEqual([0, 1, 2]);

    let n = session(100, [25, 50]);
    expect(nextCheckpoint(n)?.index).toBe(0);
    expect(secondsUntilNextCheckpoint(n)).toBe(25);
    n = advanceSession(n, 70).session;
    expect(nextCheckpoint(n)?.index).toBe(1);
    expect(secondsUntilNextCheckpoint(n)).toBe(20);
    n = advanceSession(n, 10).session;
    expect(nextCheckpoint(n)).toBeUndefined();

    let c = session(60, []);
    c = advanceSession(c, -20).session;
    expect(c.remainingSeconds).toBe(0);
    expect(isSessionComplete(c)).toBe(true);
    c = advanceSession(c, 999).session;
    expect(c.remainingSeconds).toBe(60);

    expect(checkpointPrompt(0, 1)).toContain('Midpoint');
    expect(checkpointPrompt(0, 3)).toContain('Flow calibration');
    expect(checkpointPrompt(2, 3)).toContain('Final cadence');
    expect(checkpointPrompt(1, 3)).toContain('Checkpoint 2');
  });
  it('replanning keeps the marks already heard and re-spaces only what is ahead', () => {
    const r = (existing: number[], triggered: number[], proposed: number[], elapsed: number) => {
      const out = replannedCheckpoints(existing, new Set(triggered), proposed, elapsed);
      return { checkpoints: out.checkpoints, triggered: [...out.triggeredIndices].sort() };
    };
    expect(r([25, 50, 75], [0], [20, 40, 60, 80], 30)).toEqual({
      checkpoints: [25, 40, 60, 80],
      triggered: [0],
    });
    expect(r([], [], [10, 20, 30, 40], 25)).toEqual({ checkpoints: [30, 40], triggered: [] });
    expect(r([25, 50, 75], [], [60], 0)).toEqual({ checkpoints: [60], triggered: [] });
    expect(r([450], [], evenlySpacedCheckpoints(900, 3), 0).checkpoints).toEqual([225, 450, 675]);
    expect(r([25, 50, 75], [0, 1], [], 60)).toEqual({ checkpoints: [25, 50], triggered: [0, 1] });
    expect(r([10, 20, 30], [0, 1], [5, 26, 50, 70], 25)).toEqual({
      checkpoints: [10, 20, 26, 50, 70],
      triggered: [0, 1],
    });
    expect(r([30, 60, 90], [0, 1], [30, 60, 90, 120], 65).checkpoints).toEqual([30, 60, 90, 120]);

    let s = advanceSession(session(900, [225, 450, 675]), 600).session;
    s = replanSession(s, { kind: 'interval', seconds: 120 });
    expect(s.nudgeCheckpoints).toEqual([225, 360, 480, 600, 720, 840]);
    expect([...s.triggeredCheckpointIndices]).toEqual([0]);
    expect(nextCheckpoint(s)?.atSeconds).toBe(360);

    let t = advanceSession(session(600, [200, 400]), 350).session;
    t = replanSession(t, { kind: 'count', count: 4 });
    expect(advanceSession(t, 350).crossed).toEqual([]);
    expect(t.triggeredCheckpointIndices.size).toBe(1);

    let u = advanceSession(session(600, [150, 300, 450]), 280).session;
    u = replanSession(u, { kind: 'count', count: 1 });
    expect(u.triggeredCheckpointIndices.size).toBe(2);
    expect(u.nudgeCheckpoints).toEqual([150, 300]);
  });
  it('formats time three ways and resolves plans from tasks', () => {
    expect([0, 9, 75, 900, -5].map(digitalTime)).toEqual([
      '00:00',
      '00:09',
      '01:15',
      '15:00',
      '00:00',
    ]);
    expect([30, 59, 60, 450, 900, -5].map(humanSpan)).toEqual([
      '30s',
      '59s',
      '1m',
      '7m 30s',
      '15m',
      '0s',
    ]);
    expect([0, 59, 45 * 60, 3600, 85 * 60, -30].map(durationLabel)).toEqual([
      '0m',
      '0m',
      '45m',
      '1h',
      '1h 25m',
      '0m',
    ]);
    const plan = planForTask(
      { id: 'T', title: 'Write the report', focusDurationSeconds: 300, nudgesCount: 3 },
      { colour: '💼' },
    );
    expect(plan).toEqual({
      taskId: 'T',
      taskTitle: 'Write the report',
      lifeAreaEmoji: '💼',
      durationSeconds: 300,
      nudgeCount: 3,
    });
    expect(planForTask({ id: 'U', title: 'Untuned task' }, undefined)).toEqual({
      taskId: 'U',
      taskTitle: 'Untuned task',
      lifeAreaEmoji: '🎯',
      durationSeconds: 900,
      nudgeCount: 2,
    });
    expect(
      planForTask({ id: 'U', title: 'Untuned task' }, undefined, 25 * 60).durationSeconds,
    ).toBe(1500);
    expect(sprintPlanSummary(900, 2)).toBe('15m sprint · 2 nudges');
    expect(sprintPlanSummary(60, 1)).toBe('1m sprint · 1 nudge');
  });
});

// 19 Aug 2026 is a Wednesday.
const now = new Date(2026, 7, 19, 12);
function record(o: {
  daysAgo: number;
  minutes: number;
  completed?: boolean;
}): CompletedFocusSession {
  const endedAt = new Date(now.getTime() - o.daysAgo * 86_400_000);
  return {
    id: `S${o.daysAgo}-${o.minutes}`,
    taskId: 'T',
    taskTitle: 'Sprint',
    lifeAreaEmoji: '💼',
    plannedSeconds: o.minutes * 60,
    focusedSeconds: o.minutes * 60,
    checkpointsReached: 1,
    completedNaturally: o.completed ?? true,
    startedAt: new Date(endedAt.getTime() - o.minutes * 60_000),
    endedAt,
  };
}
const week = (perDay: Record<number, number>) =>
  rollingFocusDays(
    Object.entries(perDay).map(([d, m]) => record({ daysAgo: Number(d), minutes: m })),
    7,
    now,
  );

describe('analytics', () => {
  it('the current week runs Monday to Sunday and buckets by day; the rolling window ends today', () => {
    const empty = currentFocusWeek([], now);
    expect(empty).toHaveLength(7);
    expect(empty[0]!.date.getDay()).toBe(1);
    expect(empty[6]!.date.getDay()).toBe(0);
    const b = currentFocusWeek(
      [
        record({ daysAgo: 0, minutes: 25 }),
        record({ daysAgo: 0, minutes: 35 }),
        record({ daysAgo: 2, minutes: 40 }),
      ],
      now,
    );
    expect(b[0]!.focusedSeconds).toBe(40 * 60);
    expect(b[2]!.focusedSeconds).toBe(60 * 60);
    expect(b[2]!.sessionCount).toBe(2);
    expect(b[1]!.focusedSeconds).toBe(0);
    expect(totalFocusedSeconds(currentFocusWeek([record({ daysAgo: 10, minutes: 90 })], now))).toBe(
      0,
    );
    const rolling = rollingFocusDays([], 7, now);
    expect(rolling).toHaveLength(7);
    expect(rolling[6]!.date).toEqual(new Date(2026, 7, 19));
    expect(rolling[0]!.date).toEqual(new Date(2026, 7, 13));
    expect(
      totalFocusedSeconds(
        rollingFocusDays(
          [record({ daysAgo: 6, minutes: 20 }), record({ daysAgo: 7, minutes: 99 })],
          7,
          now,
        ),
      ),
    ).toBe(20 * 60);
    expect(rollingFocusDays([], 0, now)).toEqual([]);
    expect(rollingFocusDays([], -3, now)).toEqual([]);
  });
  it('totals, averages, peak, streak and goal progress', () => {
    const b = week({ 0: 30, 1: 45, 3: 15 });
    expect(totalFocusedSeconds(b)).toBe(90 * 60);
    expect(totalSessions(b)).toBe(3);
    expect(activeDayCount(b)).toBe(3);
    expect(dailyAverageSeconds(week({ 0: 70, 1: 70 }))).toBe(20 * 60);
    expect(dailyAverageSeconds([])).toBe(0);
    expect(peakDay(week({ 0: 30, 2: 95, 4: 60 }))?.focusedSeconds).toBe(95 * 60);
    expect(peakDay(week({}))).toBeUndefined();
    expect(focusCurrentStreak(week({ 0: 10, 1: 10, 2: 10 }))).toBe(3);
    expect(focusCurrentStreak(week({ 0: 10, 1: 10, 3: 10 }))).toBe(2);
    expect(focusCurrentStreak(week({ 1: 10, 2: 10 }))).toBe(2);
    expect(focusCurrentStreak(week({}))).toBe(0);
    expect(focusCurrentStreak([])).toBe(0);
    expect(focusGoalProgress(week({ 0: 105 }), 30)).toBeCloseTo(0.5, 3);
    expect(focusGoalProgress(week({ 0: 210 }), 30)).toBeCloseTo(1, 3);
    expect(focusGoalProgress(week({ 0: 1000 }), 30)).toBeCloseTo(1, 3);
    expect(focusGoalProgress(week({ 0: 60 }), 0)).toBe(0);
    expect(focusGoalProgress([], 30)).toBe(0);
    const provisional = record({ daysAgo: 0, minutes: 10 });
    const confirmed = confirmedRecord(record({ daysAgo: 0, minutes: 15 }), now);
    expect(isProvisional(provisional)).toBe(true);
    expect(isProvisional(confirmed)).toBe(false);
    expect(confirmed.id).toBe(record({ daysAgo: 0, minutes: 15 }).id);
    expect(totalFocusedSeconds(rollingFocusDays([provisional, confirmed], 7, now))).toBe(1500);
  });
});

describe('presentation', () => {
  it('the hero action, the dots, the badge, the accessibility label, the stop confirmation, the ring geometry', () => {
    expect(sprintStateTitle(activeGoalSprintState('T', undefined))).toBe('Start Session');
    expect(sprintStateTitle(activeGoalSprintState('T', { taskId: 'T', isPaused: false }))).toBe(
      'Session Active',
    );
    expect(sprintStateTitle(activeGoalSprintState('T', { taskId: 'T', isPaused: true }))).toBe(
      'Session Paused',
    );
    expect(activeGoalSprintState('T', { taskId: 'U', isPaused: false })).toBe('idle');
    expect(activeGoalSprintState(undefined, { taskId: undefined, isPaused: false })).toBe('idle');

    const mid = advanceSession(session(900, [225, 450, 675]), 600).session;
    expect([0, 1, 2].map((i) => checkpointDotState(i, mid))).toEqual([
      'reached',
      'next',
      'pending',
    ]);
    expect([0, 1].map((i) => checkpointDotState(i, session(900, [225, 450])))).toEqual([
      'next',
      'pending',
    ]);
    const done = advanceSession(session(900, [225, 450]), 100).session;
    expect([0, 1].map((i) => checkpointDotState(i, done))).toEqual(['reached', 'reached']);

    const running = advanceSession(session(900, []), 600).session;
    expect(pausedBadge(running)).toBeUndefined();
    const paused = { ...running, isPaused: true };
    expect(pausedBadge(paused)).toBe('Paused');
    expect(focusBarAccessibilityLabel(paused)).toBe('Paused, 10:00 remaining');
    expect(focusBarAccessibilityLabel(running)).toBe('10:00 remaining');

    expect(stopConfirmationMessage(running)).toContain('5m');
    expect(stopConfirmationMessage(session(900, []))).toBe(
      'This sprint will end and nothing will be logged.',
    );
    expect(STOP_CONFIRMATION).toEqual({
      title: 'Stop this sprint?',
      confirm: 'Stop sprint',
      cancel: 'Keep going',
    });

    expect(ringFraction(375, 1500)).toBeCloseTo(0.25, 4);
    expect(ringFraction(2000, 1500)).toBe(1);
    expect(ringFraction(-30, 1500)).toBe(0);
    expect(ringFraction(300, 0)).toBe(0);
    const at = (c: number) => ringDotCenter(c, 1500, 56);
    expect(at(0).x).toBeCloseTo(28, 4);
    expect(at(0).y).toBeCloseTo(0, 4);
    expect(at(375).x).toBeCloseTo(56, 4);
    expect(at(750).y).toBeCloseTo(56, 4);
    expect(at(1125).x).toBeCloseTo(0, 4);
    expect(ringDotCenter(300, 0, 56)).toEqual({
      x: expect.closeTo(28, 4) as number,
      y: expect.closeTo(0, 4) as number,
    });

    expect(collapseSwipeOutcome(30, false)).toBe('collapse');
    expect(collapseSwipeOutcome(30, true)).toBe('none');
    expect(collapseSwipeOutcome(-30, true)).toBe('expand');
    expect(collapseSwipeOutcome(-30, false)).toBe('none');
    expect(collapseSwipeOutcome(10, false)).toBe('none');
  });
  it('the completion and offline summary lines', () => {
    const r = (focused: number, planned: number, checkpoints: number): CompletedFocusSession => ({
      ...record({ daysAgo: 0, minutes: 1 }),
      focusedSeconds: focused,
      plannedSeconds: planned,
      checkpointsReached: checkpoints,
    });
    expect(completionSummaryLine(r(1530, 1500, 2))).toBe('25m 30s focused · 2 checkpoints');
    expect(completionSummaryLine(r(45, 1500, 0))).toBe('45s focused');
    expect(completionSummaryLine(r(600, 600, 1))).toBe('10m focused · 1 checkpoint');
    expect(offlineSummaryLine(r(1500, 1500, 2))).toBe('25 of 25 minutes logged · 2 checkpoints');
    expect(offlineSummaryLine(r(900, 900, 0))).toBe('15 of 15 minutes logged');
  });
  it('the cadence draft seeds, resolves, lifts sub-floor seconds, and summarises', () => {
    expect(draftFromCadence({ kind: 'count', count: 3 })).toMatchObject({
      mode: 'count',
      count: 3,
    });
    expect(resolvedCadence(draftFromCadence({ kind: 'count', count: 3 }))).toEqual({
      kind: 'count',
      count: 3,
    });
    const secs = draftFromCadence({ kind: 'interval', seconds: 45 });
    expect(secs).toMatchObject({ mode: 'interval', intervalUnit: 'seconds', intervalValue: 45 });
    const mins = draftFromCadence({ kind: 'interval', seconds: 300 });
    expect(mins).toMatchObject({ intervalUnit: 'minutes', intervalValue: 5 });
    expect(resolvedCadence(mins)).toEqual({ kind: 'interval', seconds: 300 });
    expect(
      resolvedCadence({ ...draftFromCadence({ kind: 'count', count: 4 }), mode: 'interval' }),
    ).toEqual({ kind: 'interval', seconds: 30 });
    expect(
      resolvedCadence({ ...draftFromCadence({ kind: 'interval', seconds: 60 }), mode: 'count' }),
    ).toEqual({ kind: 'count', count: 1 });
    expect(
      resolvedCadence({
        ...draftFromCadence({ kind: 'interval', seconds: 30 }),
        intervalUnit: 'minutes',
        intervalValue: 2,
      }),
    ).toEqual({ kind: 'interval', seconds: 120 });
    expect(
      resolvedCadence({ ...draftFromCadence({ kind: 'interval', seconds: 30 }), intervalValue: 5 }),
    ).toEqual({ kind: 'interval', seconds: 30 });
    expect(
      resolvedCadence({ ...draftFromCadence({ kind: 'count', count: 2 }), count: -3 }),
    ).toEqual({ kind: 'count', count: 0 });
    expect(
      resolvedCadence({ ...draftFromCadence({ kind: 'count', count: 2 }), count: 25 }),
    ).toEqual({ kind: 'count', count: 10 });
    expect(draftFromCadence({ kind: 'count', count: 10 }).count).toBe(10);
    expect(
      selectingIntervalUnit(draftFromCadence({ kind: 'interval', seconds: 120 }), 'seconds'),
    ).toMatchObject({ intervalUnit: 'seconds', intervalValue: 30 });
    expect(
      selectingIntervalUnit(draftFromCadence({ kind: 'interval', seconds: 45 }), 'seconds')
        .intervalValue,
    ).toBe(45);
    const toMinutes = selectingIntervalUnit(
      draftFromCadence({ kind: 'interval', seconds: 45 }),
      'minutes',
    );
    expect(toMinutes).toMatchObject({ intervalUnit: 'minutes', intervalValue: 45 });
    expect(resolvedCadence(toMinutes)).toEqual({ kind: 'interval', seconds: 2700 });
    expect(draftSummary(draftFromCadence({ kind: 'count', count: 3 }), 900)).toBe('3 nudges');
    expect(draftSummary(draftFromCadence({ kind: 'count', count: 1 }), 900)).toBe('1 nudge');
    expect(draftSummary(draftFromCadence({ kind: 'interval', seconds: 300 }), 900)).toBe(
      '2 nudges — every 5m',
    );
    expect(draftSummary(draftFromCadence({ kind: 'count', count: 0 }), 900)).toBe('No nudges');
  });
  it('plans a notification per checkpoint still ahead plus the completion; nothing while paused, undated or finished', () => {
    const base = newFocusSession({
      taskId: 'T',
      taskTitle: 'Take a 10-minute walk',
      lifeAreaEmoji: '🫀',
      durationSeconds: 900,
      nudgeCheckpoints: [225, 450, 675],
    });
    const t0 = new Date(1_800_000_000_000);
    const at = (s: number) => new Date(t0.getTime() + s * 1000);
    const full = planFocusNotifications(base, at(900), t0);
    expect(full.filter((n) => n.kind.kind === 'checkpoint').map((n) => n.fireDate)).toEqual([
      at(225),
      at(450),
      at(675),
    ]);
    expect(full[0]!.body).toBe(checkpointPrompt(0, 3));
    expect(full[0]!.title).toContain('1 of 3');
    expect(full[0]!.title).toContain('Take a 10-minute walk');
    const last = full[full.length - 1]!;
    expect(last.kind).toEqual({ kind: 'sprintComplete' });
    expect(last.fireDate).toEqual(at(900));
    expect(last.body).toContain('Tap');
    expect(last.body).toContain('Lock Screen');
    const ids = full.map((n) => n.identifier);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('focusSprint.'))).toBe(true);

    const mid = advanceSession(base, 600).session;
    const ahead = planFocusNotifications(mid, at(600), t0).filter(
      (n) => n.kind.kind === 'checkpoint',
    );
    expect(ahead.map((n) => n.kind)).toEqual([
      { kind: 'checkpoint', index: 1 },
      { kind: 'checkpoint', index: 2 },
    ]);
    expect(ahead.map((n) => n.fireDate)).toEqual([at(150), at(375)]);
    expect(
      planFocusNotifications({ ...base, nudgeCheckpoints: [] }, at(900), t0).map((n) => n.kind),
    ).toEqual([{ kind: 'sprintComplete' }]);
    expect(planFocusNotifications({ ...base, isPaused: true }, undefined, t0)).toEqual([]);
    expect(planFocusNotifications(base, undefined, t0)).toEqual([]);
    expect(planFocusNotifications(advanceSession(base, 0).session, t0, t0)).toEqual([]);
    const stale = newFocusSession({
      taskTitle: 'x',
      lifeAreaEmoji: '🎯',
      durationSeconds: 900,
      remainingSeconds: 600,
      nudgeCheckpoints: [225, 450, 675],
    });
    expect(
      planFocusNotifications(stale, at(600), t0).some(
        (n) => n.kind.kind === 'checkpoint' && n.kind.index === 0,
      ),
    ).toBe(false);
  });
  it('persistence round-trips the sprint (paused or running) and the completion records', () => {
    const started = new Date(1_800_000_000_000);
    const running = persistedSprint(
      advanceSession(session(600, [60, 300]), 500).session,
      started,
      new Date(started.getTime() + 500_000),
      { kind: 'count', count: 2 },
    );
    expect(running.deadline).toEqual(new Date(started.getTime() + 500_000));
    expect(running.pausedRemainingSeconds).toBeUndefined();
    expect(running.triggeredCheckpointIndices).toEqual([0]);
    expect(persistedCadence(running)).toEqual({ kind: 'count', count: 2 });
    expect(parsePersistedSprint(serializePersistedSprint(running))).toEqual(running);
    const paused = persistedSprint(
      { ...advanceSession(session(600, [60, 300]), 240).session, isPaused: true },
      started,
      undefined,
      { kind: 'interval', seconds: 90 },
    );
    expect(paused.deadline).toBeUndefined();
    expect(paused.pausedRemainingSeconds).toBe(240);
    expect(persistedCadence(paused)).toEqual({ kind: 'interval', seconds: 90 });
    const restored = sessionFromPersisted(parsePersistedSprint(serializePersistedSprint(paused))!);
    expect(restored.isPaused).toBe(true);
    expect(restored.remainingSeconds).toBe(240);
    expect(parsePersistedSprint(undefined)).toBeUndefined();
    expect(parsePersistedSprint('not json')).toBeUndefined();
    const records = [
      record({ daysAgo: 0, minutes: 10 }),
      confirmedRecord(record({ daysAgo: 1, minutes: 5 }), now),
    ];
    expect(parseCompletedSessions(serializeCompletedSessions(records))).toEqual(records);
    expect(parseCompletedSessions('[]')).toEqual([]);
    expect(parseCompletedSessions('garbage')).toEqual([]);
  });
});
