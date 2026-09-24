/** `MomentumTaskContext`: the detail screen's close-button label and "Momentum here" line. */
import { closedThisWeek, streak } from '@/domain/momentum/momentumScoreboard';
import { daysBetween } from '@/domain/time/calendar';
import type { LifeArea, Task } from '@/domain/types';

export interface MomentumContext {
  readonly streak: number;
  readonly areaLine: string | undefined;
}

export const EMPTY_MOMENTUM_CONTEXT: MomentumContext = { streak: 0, areaLine: undefined };

export function closeButtonLabel(streakDays: number): string {
  return streakDays > 0 ? `Close it — keeps a ${streakDays}-day streak` : 'Close it';
}

export function buildMomentumContext(input: {
  readonly lifeAreaId: string | undefined;
  readonly tasks: readonly Task[];
  readonly lifeAreas: readonly LifeArea[];
  readonly showStreaks: boolean;
  readonly now: Date;
}): MomentumContext {
  return {
    streak: input.showStreaks ? streak(input.tasks, input.now) : 0,
    areaLine: areaLine(input.lifeAreaId, input.tasks, input.lifeAreas, input.now),
  };
}

function areaLine(
  lifeAreaId: string | undefined,
  tasks: readonly Task[],
  lifeAreas: readonly LifeArea[],
  now: Date,
): string | undefined {
  const area = lifeAreaId ? lifeAreas.find((a) => a.id === lifeAreaId) : undefined;
  if (!area) return undefined;
  const areaTasks = tasks.filter((t) => t.lifeAreaId === area.id);
  const closed = closedThisWeek(areaTasks, now);
  const open = areaTasks.filter((t) => t.status === 'open').length;
  if (closed.length === 0)
    return `${area.colour} ${area.name}: nothing closed this week yet. ${open} open.`;
  const latest = closed.reduce<Date | undefined>(
    (best, t) => (t.completedAt && (!best || t.completedAt > best) ? t.completedAt : best),
    undefined,
  );
  const last = latest ? lastClosedPhrase(latest, now) : '';
  return `${area.colour} ${area.name}: ${closed.length} of ${closed.length + open} closed this week.${last}`;
}

function lastClosedPhrase(date: Date, now: Date): string {
  const days = daysBetween(date, now);
  if (days === 0) return ' Last closed today.';
  if (days === 1) return ' Last closed yesterday.';
  return ` Last closed ${days} days ago.`;
}
