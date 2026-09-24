/** `Home/MomentumWeekReview.swift`: the review's headline, bars, wins, stamina, quiet line and kickstart. */
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import type { CompletedFocusSession, LifeArea, Task } from '@/domain/types';

import { closedThisWeek, effortLabel } from './momentumScoreboard';

export interface MomentumWeekReview {
  readonly headline: string;
  readonly dayCounts: readonly number[];
  readonly dayLabels: readonly string[];
  readonly dopamineWins: readonly string[];
  readonly staminaLine: string | undefined;
  readonly quietLine: string | undefined;
  readonly kickstart: readonly string[];
}

export function buildWeekReview(input: {
  readonly tasks: readonly Task[];
  readonly lifeAreas: readonly LifeArea[];
  readonly sessions: readonly CompletedFocusSession[];
  readonly inboxCount: number;
  readonly now: Date;
  readonly locale?: string | undefined;
}): MomentumWeekReview {
  const { tasks, lifeAreas, sessions, inboxCount, now } = input;
  const today = startOfDay(now);
  const windowStart = addDays(today, -6);
  const weekClosures = closedThisWeek(tasks, now);
  const weekSessions = sessions.filter((s) => s.endedAt >= windowStart);
  const focusMinutes = Math.floor(weekSessions.reduce((sum, s) => sum + s.focusedSeconds, 0) / 60);
  const days = [6, 5, 4, 3, 2, 1, 0].map((back) => addDays(today, -back));
  const planned = weekSessions.reduce((sum, s) => sum + s.plannedSeconds, 0);
  const focused = weekSessions.reduce((sum, s) => sum + s.focusedSeconds, 0);
  const movedAreaIds = new Set(
    weekClosures.map((t) => t.lifeAreaId).filter((id): id is string => id !== undefined),
  );
  const quietAreas = [...lifeAreas]
    .filter((a) => !a.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter(
      (a) =>
        !movedAreaIds.has(a.id) && tasks.some((t) => t.lifeAreaId === a.id && t.status === 'open'),
    )
    .map((a) => a.name);
  const clauses: string[] = [];
  if (quietAreas.length > 0) clauses.push(`Nothing closed in ${quietAreas.join(' or ')} this week`);
  if (inboxCount > 0)
    clauses.push(`${inboxCount} ${inboxCount === 1 ? 'capture is' : 'captures are'} still unfiled`);
  return {
    headline: `${weekClosures.length} closed · ${focusMinutes} focus minutes`,
    dayCounts: days.map(
      (day) =>
        weekClosures.filter((t) => t.completedAt !== undefined && isSameDay(t.completedAt, day))
          .length,
    ),
    dayLabels: days.map((day) => day.toLocaleDateString(input.locale, { weekday: 'short' })),
    dopamineWins: [...weekClosures]
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
      .slice(0, 3)
      .map((t) => t.title),
    staminaLine:
      planned > 0
        ? `${Math.round((focused / planned) * 100)}% of targeted minutes actually logged`
        : undefined,
    quietLine:
      clauses.length > 0
        ? `${clauses.join(', and ')}. Neither is a failure — they are just what next week starts with.`
        : undefined,
    kickstart: tasks
      .filter((t) => t.status === 'open' && t.focusDurationSeconds !== undefined)
      .sort((a, b) => (a.focusDurationSeconds ?? 0) - (b.focusDurationSeconds ?? 0))
      .slice(0, 2)
      .map((t) => `${effortLabel(t.focusDurationSeconds)} · ${t.title}`),
  };
}
