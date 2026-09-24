/** The three `MomentumScoreboard` helpers the Tasks logic needs now; the full scoreboard is Phase 2. */
import { addDays, daysBetween, isSameDay, startOfDay } from '@/domain/time/calendar';
import type { LifeArea, Task } from '@/domain/types';

/** Consecutive days with at least one stamped closure, counted back from today if today has one, else from yesterday. */
export function streak(tasks: readonly Task[], now: Date): number {
  const days = new Set(
    tasks
      .filter((t) => t.status === 'done' && t.completedAt !== undefined)
      .map((t) => startOfDay(t.completedAt!).getTime()),
  );
  let cursor = startOfDay(now);
  if (!days.has(cursor.getTime())) cursor = addDays(cursor, -1);
  let count = 0;
  while (days.has(cursor.getTime())) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
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

/** `"15 min"`, rounding up and never below one minute; nothing when there is no duration. */
export function effortLabel(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

// MARK: - Per-area momentum (the Areas tab and the area detail)

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
