/** `Home/HomeInboxPeek.swift`, `HomeLifeAreasSection.swift`, `HomeNudgesSection.swift` (the parts that need no schedule maths). */
import { nextFire } from '@/domain/nudges';
import { daysBetween, formatShortTime, isSameDay } from '@/domain/time/calendar';
import type { Capture, Nudge } from '@/domain/types';

import type { AreaMomentum } from './momentumScoreboard';

export const INBOX_PEEK_MAX_ROWS = 3;

export function inboxPeek(captures: readonly Capture[]): Capture[] {
  return [...captures]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, INBOX_PEEK_MAX_ROWS);
}

export function inboxCountLine(count: number): string {
  return count > 0 ? `${count} waiting` : 'Inbox clear';
}

export function inboxOverflowLine(total: number): string | undefined {
  const hidden = total - INBOX_PEEK_MAX_ROWS;
  return hidden > 0 ? `and ${hidden} more` : undefined;
}

export function inboxHandledLine(count: number): string | undefined {
  return count > 0 ? `${count} handled today` : undefined;
}

export function inboxTimeLabel(
  capture: Pick<Capture, 'createdAt'>,
  now: Date,
  locale?: string,
): string {
  return isSameDay(capture.createdAt, now)
    ? formatShortTime(capture.createdAt, locale)
    : capture.createdAt.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export function lifeAreasCollapsedLine(items: readonly AreaMomentum[]): string {
  if (items.length === 0) return 'No areas yet';
  const areas = items.length === 1 ? '1 area' : `${items.length} areas`;
  const open = items.reduce((sum, i) => sum + i.open, 0);
  return open === 0 ? `${areas} · nothing open` : `${areas} · ${open} open`;
}

export function showsArrangeControl(areaCount: number, isExpanded: boolean): boolean {
  return areaCount >= 2 && isExpanded;
}

export const NUDGE_CARDS_MAX = 3;

function lastFired(nudge: Nudge): number {
  return (nudge.lastFiredAt ?? nudge.createdAt).getTime();
}

/** The longest-waiting due nudges first, at most three. */
export function nudgeCards(due: readonly Nudge[]): Nudge[] {
  return [...due].sort((a, b) => lastFired(a) - lastFired(b)).slice(0, NUDGE_CARDS_MAX);
}

export function nudgeOverflowLine(dueCount: number): string | undefined {
  const hidden = dueCount - NUDGE_CARDS_MAX;
  if (hidden <= 0) return undefined;
  return hidden === 1 ? 'and 1 more due' : `and ${hidden} more due`;
}

export function nudgeCountLine(dueCount: number, scheduledCount: number): string {
  if (dueCount <= 0)
    return scheduledCount > 0 ? `Nothing due · ${scheduledCount} scheduled` : 'No nudges yet';
  return `${dueCount} due · ${Math.max(scheduledCount, 0)} scheduled`;
}

export function nudgeScheduledCount(all: readonly Nudge[], due: readonly Nudge[]): number {
  const dueIds = new Set(due.map((n) => n.id));
  return all.filter((n) => n.active && !dueIds.has(n.id)).length;
}

export const FIRST_NUDGE_DIRECTIVE = 'Add your first nudge';

export function shouldRenderNudgesSection(hasAny: boolean, hasEverHadAny: boolean): boolean {
  return hasAny || !hasEverHadAny;
}

export function nudgeDoorSubtitle(dueCount: number, scheduledCount: number): string {
  if (dueCount > 0) return 'Waiting on you — clear them when you can.';
  return scheduledCount > 0
    ? 'Nothing due — all on time.'
    : 'Recurring reminders you set for yourself.';
}

export function nudgeChipText(dueCount: number, scheduledCount: number): string {
  if (dueCount > 0) return `${dueCount} due`;
  return scheduledCount > 0 ? `${scheduledCount} scheduled` : 'None yet';
}

export function nudgeUpcomingOverflowLine(scheduledCount: number): string | undefined {
  const hidden = scheduledCount - NUDGE_CARDS_MAX;
  if (hidden <= 0) return undefined;
  return hidden === 1 ? 'and 1 more scheduled' : `and ${hidden} more scheduled`;
}

/** "Today 18:00" / "Tomorrow 05:00" / "Mon 09:30": when this nudge next fires, measured from `now`; nothing when unparseable. */
export function nudgeNextFireLine(nudge: Nudge, now: Date, locale?: string): string | undefined {
  const next = nextFire(nudge, now);
  if (!next) return undefined;
  const clock = formatShortTime(next, locale);
  const days = daysBetween(now, next);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Tomorrow ${clock}`;
  return `${next.toLocaleDateString(locale, { weekday: 'short' })} ${clock}`;
}

/** The not-yet-due nudges that get a row, soonest first, at most three; paused and unparseable ones have no position to claim. */
export function nudgesUpcoming(all: readonly Nudge[], due: readonly Nudge[], now: Date): Nudge[] {
  const dueIds = new Set(due.map((n) => n.id));
  return all
    .filter((n) => !dueIds.has(n.id))
    .map((nudge) => ({ nudge, fires: nextFire(nudge, now) }))
    .filter((entry): entry is { nudge: Nudge; fires: Date } => entry.fires !== undefined)
    .sort((a, b) => a.fires.getTime() - b.fires.getTime())
    .slice(0, NUDGE_CARDS_MAX)
    .map((entry) => entry.nudge);
}
