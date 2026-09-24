/**
 * `Journal/JournalTimeline.swift`: the day-grouped feed that interleaves written entries, closed
 * tasks, finished sprints and captures. Location events and routine rows are Phase 3 (places).
 */
import { closedThisWeek } from '@/domain/momentum/momentumScoreboard';
import { addDays, startOfDay } from '@/domain/time/calendar';
import type { Capture, CompletedFocusSession, Log, Tag, Task } from '@/domain/types';

export type TimelineEntry =
  | { readonly kind: 'log'; readonly log: Log }
  | { readonly kind: 'closedTask'; readonly task: Task }
  | { readonly kind: 'focusSprint'; readonly sprint: CompletedFocusSession }
  | { readonly kind: 'capture'; readonly capture: Capture };

export function entryId(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'log':
      return `log-${entry.log.id}`;
    case 'closedTask':
      return `task-${entry.task.id}`;
    case 'focusSprint':
      return `sprint-${entry.sprint.id}`;
    case 'capture':
      return `capture-${entry.capture.id}`;
  }
}

export function entryTimestamp(entry: TimelineEntry): Date {
  switch (entry.kind) {
    case 'log':
      return entry.log.entryDate;
    case 'closedTask':
      return entry.task.completedAt ?? new Date(0);
    case 'focusSprint':
      return entry.sprint.endedAt;
    case 'capture':
      return entry.capture.createdAt;
  }
}

export type TimelineFilter = 'everything' | 'written' | 'closed' | 'sprints' | 'captured';
export const TIMELINE_FILTERS: readonly TimelineFilter[] = [
  'everything',
  'written',
  'closed',
  'sprints',
  'captured',
];

export function timelineFilterTitle(filter: TimelineFilter): string {
  return {
    everything: 'Everything',
    written: 'Written',
    closed: 'Closed',
    sprints: 'Sprints',
    captured: 'Captured',
  }[filter];
}

export interface TimelineDay {
  readonly date: Date;
  readonly title: string;
  readonly entries: readonly TimelineEntry[];
  readonly focusedMinutes: number;
}

export function dayHeaderLine(day: TimelineDay): string {
  return day.focusedMinutes > 0 ? `${day.title} · ${day.focusedMinutes} min focused` : day.title;
}

export function dayCollapsedLine(day: TimelineDay): string {
  return day.entries.length === 1 ? '1 entry' : `${day.entries.length} entries`;
}

export const MINIMUM_VISIBLE_SPRINT_SECONDS = 60;

export function timelineDays(input: {
  readonly logs: readonly Log[];
  readonly tasks: readonly Task[];
  readonly sprints?: readonly CompletedFocusSession[];
  readonly captures?: readonly Capture[];
  readonly filter?: TimelineFilter;
  readonly lifeAreaId?: string | undefined;
  readonly now: Date;
}): TimelineDay[] {
  const filter = input.filter ?? 'everything';
  const areaId = input.lifeAreaId;
  const entries: TimelineEntry[] = [];
  if (filter === 'everything' || filter === 'written') {
    entries.push(
      ...input.logs
        .filter((l) => areaId === undefined || l.lifeAreaId === areaId)
        .map((log): TimelineEntry => ({ kind: 'log', log })),
    );
  }
  if (filter === 'everything' || filter === 'closed') {
    entries.push(
      ...input.tasks
        .filter((t) => t.status === 'done' && t.completedAt !== undefined)
        .filter((t) => areaId === undefined || t.lifeAreaId === areaId)
        .map((task): TimelineEntry => ({ kind: 'closedTask', task })),
    );
  }
  if (filter === 'everything' || filter === 'sprints') {
    entries.push(
      ...(input.sprints ?? [])
        .filter((s) => s.focusedSeconds >= MINIMUM_VISIBLE_SPRINT_SECONDS)
        .map((sprint): TimelineEntry => ({ kind: 'focusSprint', sprint })),
    );
  }
  if (filter === 'everything' || filter === 'captured') {
    entries.push(
      ...(input.captures ?? [])
        .filter((c) => areaId === undefined || c.lifeAreaId === areaId)
        .map((capture): TimelineEntry => ({ kind: 'capture', capture })),
    );
  }
  const groups = new Map<number, TimelineEntry[]>();
  for (const entry of entries) {
    const key = startOfDay(entryTimestamp(entry)).getTime();
    const members = groups.get(key);
    if (members) members.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([key, members]) => {
      const focusedSeconds = members.reduce(
        (total, e) => total + (e.kind === 'focusSprint' ? Math.max(0, e.sprint.focusedSeconds) : 0),
        0,
      );
      const date = new Date(key);
      return {
        date,
        title: dayTitle(date, input.now),
        entries: members.sort((a, b) => entryTimestamp(b).getTime() - entryTimestamp(a).getTime()),
        focusedMinutes: Math.floor(focusedSeconds / 60),
      };
    });
}

export function timelineHeaderLine(input: {
  readonly logs: readonly Log[];
  readonly tasks: readonly Task[];
  readonly sprints?: readonly CompletedFocusSession[];
  readonly now: Date;
}): string {
  const closed = closedThisWeek(input.tasks, input.now).length;
  const windowStart = addDays(startOfDay(input.now), -6);
  const written = input.logs.filter((l) => l.entryDate >= windowStart).length;
  const sprintCount = (input.sprints ?? []).filter(
    (s) => s.focusedSeconds >= MINIMUM_VISIBLE_SPRINT_SECONDS && s.endedAt >= windowStart,
  ).length;
  let line = `${closed} closed · ${written} written`;
  if (sprintCount > 0) line += ` · ${sprintCount} sprint${sprintCount === 1 ? '' : 's'}`;
  return `${line} this week`;
}

/** A log's tags in attach order; an unknown id reads as no chip, never a raw id. */
export function tagsForLog(log: Log, allTags: readonly Tag[]): Tag[] {
  if (!log.tagIds) return [];
  return log.tagIds.flatMap((id) => {
    const tag = allTags.find((t) => t.id === id);
    return tag ? [tag] : [];
  });
}

export function sprintLine(session: CompletedFocusSession): string {
  const focused = Math.max(1, Math.floor(session.focusedSeconds / 60));
  if (session.completedNaturally) return `${focused} min sprint`;
  const planned = Math.max(1, Math.floor(session.plannedSeconds / 60));
  return `${focused} of ${planned} min sprint`;
}

function dayTitle(day: Date, now: Date, locale?: string): string {
  const today = startOfDay(now);
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === addDays(today, -1).getTime()) return 'Yesterday';
  return day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export const JOURNAL_EMPTY_COPY = 'Nothing here yet — one line about today is enough to start.';
