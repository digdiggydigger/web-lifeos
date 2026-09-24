/** `Areas/AreasGrid.swift`: the Areas tab's cards, the Unfiled count and the week-share bar. */
import { areaMomentum, closedThisWeek } from '@/domain/momentum/momentumScoreboard';
import type { AreaMomentum } from '@/domain/momentum/momentumScoreboard';
import type { LifeArea, Task } from '@/domain/types';

export interface AreasGridItem {
  readonly momentum: AreaMomentum;
  readonly logCount: number;
  readonly captureCount: number;
}

export function areasGridTaskCount(item: AreasGridItem): number {
  return item.momentum.open + item.momentum.closedThisWeek;
}

interface HasLifeArea {
  readonly lifeAreaId?: string;
}

export function buildAreasGrid(input: {
  readonly areas: readonly LifeArea[];
  readonly openTasks: readonly Task[];
  readonly allTasks: readonly Task[];
  readonly logs: readonly HasLifeArea[];
  readonly captures: readonly HasLifeArea[];
  readonly now: Date;
}): AreasGridItem[] {
  return areaMomentum(input.areas, input.openTasks, input.allTasks, input.now).map((momentum) => ({
    momentum,
    logCount: input.logs.filter((l) => l.lifeAreaId === momentum.area.id).length,
    captureCount: input.captures.filter((c) => c.lifeAreaId === momentum.area.id).length,
  }));
}

export function areasGridMetaLine(
  taskCount: number,
  logCount: number,
  captureCount: number,
): string {
  const parts: string[] = [];
  if (taskCount > 0) parts.push(taskCount === 1 ? '1 task' : `${taskCount} tasks`);
  if (logCount > 0) parts.push(logCount === 1 ? '1 log' : `${logCount} logs`);
  if (captureCount > 0) parts.push(captureCount === 1 ? '1 capture' : `${captureCount} captures`);
  return parts.length === 0 ? 'Nothing here yet' : parts.join(' · ');
}

export function unfiledCount(captures: readonly HasLifeArea[]): number {
  return captures.filter((c) => c.lifeAreaId === undefined).length;
}

export function unfiledLine(count: number): string {
  if (count === 0) return 'Everything waiting has an area';
  return count === 1 ? '1 capture with no area yet' : `${count} captures with no area yet`;
}

export interface WeekShareSegment {
  readonly area: LifeArea;
  readonly count: number;
  readonly fraction: number;
}

export interface WeekShare {
  readonly segments: readonly WeekShareSegment[];
  readonly caption: string;
}

export function weekShare(
  areas: readonly LifeArea[],
  allTasks: readonly Task[],
  now: Date,
): WeekShare | undefined {
  const week = closedThisWeek(allTasks, now);
  const counts = areas.map((area) => ({
    area,
    count: week.filter((t) => t.lifeAreaId === area.id).length,
  }));
  const total = counts.reduce((n, c) => n + c.count, 0);
  if (total === 0) return undefined;
  const segments = counts
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, fraction: c.count / total }));
  let caption = `${total} ${total === 1 ? 'item' : 'items'} closed: ${segments.map((s) => `${s.count} ${s.area.name}`).join(', ')}.`;
  const quiet = counts.filter((c) => c.count === 0).map((c) => c.area.name);
  if (quiet.length > 0) caption += ` Nothing in ${quiet.join(', ')}.`;
  return { segments, caption };
}
