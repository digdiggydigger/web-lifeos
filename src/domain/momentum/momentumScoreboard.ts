/** `Home/MomentumScoreboard.swift`: the scoreboard's maths, complete. */
import { addDays, daysBetween, isSameDay, startOfDay } from '@/domain/time/calendar';
import { TASK_PRIORITIES } from '@/domain/types';
import type {
  Capture,
  CompletedFocusSession,
  LifeArea,
  Nudge,
  Task,
  TaskPriority,
} from '@/domain/types';

import { topTask } from './activeGoalSelection';

export const DEFAULT_DAILY_GOAL = 5;

function closedDays(tasks: readonly Task[]): Set<number> {
  return new Set(
    tasks
      .filter((t) => t.status === 'done' && t.completedAt !== undefined)
      .map((t) => startOfDay(t.completedAt!).getTime()),
  );
}

/** Consecutive days with at least one stamped closure, counted back from today if today has one, else from yesterday. */
export function streak(tasks: readonly Task[], now: Date): number {
  const days = closedDays(tasks);
  let cursor = startOfDay(now);
  if (!days.has(cursor.getTime())) cursor = addDays(cursor, -1);
  let count = 0;
  while (days.has(cursor.getTime())) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** The longest run of consecutive closure days anywhere in history. */
export function bestStreak(tasks: readonly Task[]): number {
  const days = closedDays(tasks);
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

export function streakLine(streakDays: number, best: number, closedTodayCount: number): string {
  if (closedTodayCount > 0 && streakDays > 0)
    return `Streak kept. Best is ${Math.max(best, streakDays)}.`;
  return streakDays === 1
    ? 'One day closed. Keep it alive today.'
    : `${streakDays} days closed in a row.`;
}

/** Closed over goal, capped at full; a zero goal reads as full once anything is closed. */
export function ringProgress(closed: number, goal: number): number {
  if (closed <= 0) return 0;
  if (goal <= 0) return 1;
  return Math.min(closed / goal, 1);
}

function priorityRank(priority: TaskPriority): number {
  return TASK_PRIORITIES.indexOf(priority);
}

/** Due or overdue first (shortest effort, then priority, then order); otherwise the active goal. */
export function bestNextMove(tasks: readonly Task[], now: Date): Task | undefined {
  const today = startOfDay(now).getTime();
  const dueNow = tasks
    .map((task, index) => ({ task, index }))
    .filter(
      ({ task }) =>
        task.status === 'open' &&
        task.dueDate !== undefined &&
        startOfDay(task.dueDate).getTime() <= today,
    );
  if (dueNow.length === 0) return topTask(tasks);
  return dueNow.reduce((best, entry) => {
    const bestEffort = best.task.focusDurationSeconds ?? Number.MAX_SAFE_INTEGER;
    const effort = entry.task.focusDurationSeconds ?? Number.MAX_SAFE_INTEGER;
    if (effort !== bestEffort) return effort < bestEffort ? entry : best;
    const bestRank = priorityRank(best.task.priority);
    const rank = priorityRank(entry.task.priority);
    if (rank !== bestRank) return rank < bestRank ? entry : best;
    return entry.index < best.index ? entry : best;
  }).task;
}

/** Done tasks stamped within the rolling seven days ending today (start of today − 6 days). */
export function closedThisWeek(tasks: readonly Task[], now: Date): Task[] {
  const windowStart = addDays(startOfDay(now), -6);
  return tasks.filter(
    (t) => t.status === 'done' && t.completedAt !== undefined && t.completedAt >= windowStart,
  );
}

export function closedToday(tasks: readonly Task[], now: Date): Task[] {
  return tasks.filter(
    (t) => t.status === 'done' && t.completedAt !== undefined && isSameDay(t.completedAt, now),
  );
}

/** One flag per day of the trailing week, oldest first, today last. */
export function trailingWeekClosureFlags(tasks: readonly Task[], now: Date): boolean[] {
  const days = closedDays(tasks);
  const today = startOfDay(now);
  return [6, 5, 4, 3, 2, 1, 0].map((back) => days.has(addDays(today, -back).getTime()));
}

export function clearedToday(captures: readonly Pick<Capture, 'clearedAt'>[], now: Date): number {
  return captures.filter((c) => c.clearedAt !== undefined && isSameDay(c.clearedAt, now)).length;
}

/** A deactivated nudge dismissed today still counts. */
export function dismissedToday(nudges: readonly Pick<Nudge, 'lastFiredAt'>[], now: Date): number {
  return nudges.filter((n) => n.lastFiredAt !== undefined && isSameDay(n.lastFiredAt, now)).length;
}

/** `"15 min"`, rounding up and never below one minute; nothing when there is no duration. */
export function effortLabel(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

export function focusLoggedTodayLabel(
  sessions: readonly CompletedFocusSession[],
  taskId: string,
  now: Date,
): string | undefined {
  const todays = sessions.filter((s) => s.taskId === taskId && isSameDay(s.endedAt, now));
  if (todays.length === 0) return undefined;
  const sessionsPart = todays.length === 1 ? '1 session' : `${todays.length} sessions`;
  const minutes = Math.floor(todays.reduce((sum, s) => sum + s.focusedSeconds, 0) / 60);
  return minutes >= 1 ? `${sessionsPart} · ${minutes} min today` : `${sessionsPart} today`;
}

// MARK: - Per-area momentum (the Areas tab, the area detail, and Today's life-areas list)

export interface AreaMomentum {
  readonly area: LifeArea;
  readonly closedThisWeek: number;
  readonly open: number;
  readonly lastClosedAt: Date | undefined;
}

/** `undefined` when nothing is open or closed: dormant, not zero. */
export function areaRate(closedThisWeekCount: number, open: number): number | undefined {
  const total = closedThisWeekCount + open;
  return total > 0 ? closedThisWeekCount / total : undefined;
}

export function areaMomentum(
  areas: readonly LifeArea[],
  openTasks: readonly Task[],
  allTasks: readonly Task[],
  now: Date,
): AreaMomentum[] {
  const week = closedThisWeek(allTasks, now);
  return areas.map((area) => ({
    area,
    closedThisWeek: week.filter((t) => t.lifeAreaId === area.id).length,
    open: openTasks.filter((t) => t.lifeAreaId === area.id && t.status === 'open').length,
    lastClosedAt: allTasks
      .filter((t) => t.lifeAreaId === area.id && t.status === 'done' && t.completedAt)
      .reduce<Date | undefined>(
        (best, t) => (!best || t.completedAt! > best ? t.completedAt : best),
        undefined,
      ),
  }));
}

export type AreaStatusTone = 'plain' | 'clear' | 'quiet';

export interface AreaStatusLine {
  readonly text: string;
  readonly tone: AreaStatusTone;
}

export function areaStatusLine(
  closed: number,
  open: number,
  lastClosedAt: Date | undefined,
  now: Date,
): AreaStatusLine {
  const total = closed + open;
  if (total === 0) return { text: 'Nothing open or closed this week', tone: 'plain' };
  if (closed === total) return { text: `${closed} of ${total} closed — all clear`, tone: 'clear' };
  if (lastClosedAt) {
    const gap = daysBetween(lastClosedAt, now);
    if (gap >= 7) return { text: `${closed} of ${total} closed — quiet all week`, tone: 'quiet' };
    if (gap > 3) {
      const weekday = lastClosedAt.toLocaleDateString(undefined, { weekday: 'long' });
      return { text: `${closed} of ${total} closed — quiet since ${weekday}`, tone: 'quiet' };
    }
  }
  return { text: `${closed} of ${total} tasks closed`, tone: 'plain' };
}
