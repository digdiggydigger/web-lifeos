/** `Capture/CaptureInboxSummary.swift` and `CaptureInboxService.Filter`: the inbox's headlines and health. */
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import { CAPTURE_KINDS } from '@/domain/types';
import type { Capture, CaptureKind } from '@/domain/types';

export type InboxFilter = 'unprocessed' | 'seen' | 'promoted';
export const INBOX_FILTERS: readonly InboxFilter[] = ['unprocessed', 'seen', 'promoted'];

export function inboxFilterTitle(filter: InboxFilter): string {
  return { unprocessed: 'To triage', seen: 'Sorted', promoted: 'Promoted' }[filter];
}

export function inboxEmptyMessage(filter: InboxFilter): string {
  return {
    unprocessed:
      "Nothing waiting to be triaged. Anything you capture lands here first, so your head doesn't have to hold it.",
    seen: 'Captures you sort move here — filed under a life area, kept, not deleted.',
    promoted: 'Captures you turn into tasks or journal entries show up here.',
  }[filter];
}

export function inboxHeadline(count: number, filter: InboxFilter): string {
  switch (filter) {
    case 'unprocessed':
      return count <= 0 ? 'Inbox clear' : `${count} to triage`;
    case 'seen':
      return count <= 0 ? 'Nothing sorted yet' : `${count} sorted`;
    case 'promoted':
      return count <= 0 ? 'Nothing promoted yet' : `${count} promoted`;
  }
}

export function oldestLine(
  captures: readonly Pick<Capture, 'createdAt'>[],
  now: Date,
): string | undefined {
  if (captures.length === 0) return undefined;
  const oldest = Math.min(...captures.map((c) => c.createdAt.getTime()));
  const hours = Math.floor((now.getTime() - oldest) / 3_600_000);
  if (hours < 1) return 'oldest is under an hour old';
  if (hours === 1) return 'oldest is 1 hour old';
  if (hours < 48) return `oldest is ${hours} hours old`;
  return `oldest is ${Math.floor(hours / 24)} days old`;
}

function weekWindowStart(now: Date): Date {
  return addDays(startOfDay(now), -6);
}

export function weeklyCounterweight(
  captures: readonly Pick<Capture, 'createdAt' | 'clearedAt'>[],
  now: Date,
): string | undefined {
  const start = weekWindowStart(now);
  const captured = captures.filter((c) => c.createdAt >= start).length;
  const cleared = captures.filter((c) => c.clearedAt !== undefined && c.clearedAt >= start).length;
  if (captured === 0 && cleared === 0) return undefined;
  return `${captured} captured · ${cleared} cleared this week`;
}

function kindNoun(kind: CaptureKind, count: number): string {
  const singular = {
    note: 'note',
    task: 'task',
    link: 'link',
    voice: 'voice memo',
    photo: 'photo',
  }[kind];
  return count === 1 ? singular : `${singular}s`;
}

/** Stable kind order whatever the arrival order; empty when nothing is waiting. */
export function inboxBreakdown(captures: readonly Pick<Capture, 'kind'>[]): string {
  return CAPTURE_KINDS.flatMap((kind) => {
    const count = captures.filter((c) => c.kind === kind).length;
    return count > 0 ? [`${count} ${kindNoun(kind, count)}`] : [];
  }).join(' · ');
}

export interface WeekHealth {
  readonly captured: number;
  readonly cleared: number;
  /** Oldest day first, today last. */
  readonly capturedPerDay: readonly number[];
}

export function weekHealth(
  captures: readonly Pick<Capture, 'createdAt' | 'clearedAt'>[],
  now: Date,
): WeekHealth | undefined {
  const today = startOfDay(now);
  const start = addDays(today, -6);
  const capturedThisWeek = captures.filter((c) => c.createdAt >= start);
  const cleared = captures.filter((c) => c.clearedAt !== undefined && c.clearedAt >= start).length;
  if (capturedThisWeek.length === 0 && cleared === 0) return undefined;
  const capturedPerDay = [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const day = addDays(today, -back);
    return capturedThisWeek.filter((c) => isSameDay(c.createdAt, day)).length;
  });
  return { captured: capturedThisWeek.length, cleared, capturedPerDay };
}

export function progressFraction(captured: number, cleared: number): number | undefined {
  if (captured <= 0) return undefined;
  return Math.min(1, cleared / captured);
}

export function sittingLine(count: number): string | undefined {
  if (count <= 0) return undefined;
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const spoken = words[count] ?? String(count);
  return count === 1
    ? `${spoken} is still sitting here — decide or bin it.`
    : `${spoken} are still sitting here — decide or bin them.`;
}

export function doorLine(count: number | undefined): string | undefined {
  if (count === undefined) return undefined;
  if (count <= 0) return 'Inbox clear';
  return `${count} waiting to triage`;
}
