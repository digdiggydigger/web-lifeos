/** The smaller Today cards: due-now rows, the inbox peek, closed today, the week strip, the week-review door. */
import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { captureDetailHeadline } from '@/domain/captures';
import {
  barFractions,
  effortLabel,
  inboxCountLine,
  inboxHandledLine,
  inboxOverflowLine,
  inboxPeek,
  inboxTimeLabel,
} from '@/domain/momentum';
import { formatShortTime } from '@/domain/time/calendar';
import type { Capture, LifeArea, Task } from '@/domain/types';
import { Card } from '@/shared/Card';
import { SectionLabel } from '@/shared/SectionLabel';

export function DueNowSection({
  tasks,
  areaById,
}: {
  readonly tasks: readonly Task[];
  readonly areaById: ReadonlyMap<string, LifeArea>;
}) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="due-now-heading">
      <SectionLabel id="due-now-heading" className="mb-2">
        Due now
      </SectionLabel>
      <ul className="divide-y divide-card-border rounded-card border border-card-border bg-card-surface">
        {tasks.map((task) => {
          const effort = effortLabel(task.focusDurationSeconds);
          const area = task.lifeAreaId ? areaById.get(task.lifeAreaId) : undefined;
          return (
            <li key={task.id}>
              <Link
                to={`/tasks/${task.id}`}
                className="spring flex min-h-14 items-center gap-2 px-4 py-2"
              >
                {effort ? (
                  <span className="inline-flex min-h-6 items-center rounded-card bg-card-surface-secondary px-2 text-xs font-semibold text-label-secondary">
                    {effort}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm">{task.title}</span>
                  {area ? (
                    <span className="block text-xs text-label-secondary">
                      {area.colour} {area.name}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function InboxPeekCard({
  inbox,
  handledToday,
  now,
}: {
  readonly inbox: readonly Capture[];
  readonly handledToday: number;
  readonly now: Date;
}) {
  const count = inbox.length;
  const countLine = inboxCountLine(count);
  const overflow = inboxOverflowLine(count);
  const handled = inboxHandledLine(handledToday);
  return (
    <Card className="flex flex-col gap-2 p-0">
      <Link
        to="/captures"
        aria-label={`Capture inbox, ${countLine}`}
        className="spring flex min-h-11 items-center gap-2 p-4"
      >
        <span aria-hidden="true" className="text-xl">
          📥
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Capture inbox</span>
          <span className="block text-sm text-label-secondary">
            {count > 0
              ? 'Waiting for a decision — one at a time.'
              : 'Anything you capture lands here first.'}
          </span>
        </span>
        <span
          className={`inline-flex min-h-6 items-center rounded-card px-2 text-xs font-semibold ${count > 0 ? 'bg-state-warn/16 text-state-warn' : 'bg-card-surface-secondary text-label-secondary'}`}
        >
          {countLine}
        </span>
      </Link>
      {count > 0 ? (
        <ul className="divide-y divide-card-border border-t border-card-border">
          {inboxPeek(inbox).map((capture) => (
            <li key={capture.id}>
              <Link
                to={`/captures/${capture.id}`}
                className="spring flex min-h-11 items-center gap-2 px-4 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {captureDetailHeadline(capture)}
                </span>
                <span className="shrink-0 text-xs text-label-tertiary tabular-nums">
                  {inboxTimeLabel(capture, now)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {overflow || handled || count > 0 ? (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {overflow ? <p className="text-xs text-label-tertiary">{overflow}</p> : null}
          {handled ? <p className="text-sm font-semibold text-state-go-vivid">{handled}</p> : null}
          {count > 0 ? (
            <Link
              to="/captures"
              className="spring flex min-h-11 items-center justify-center rounded-card bg-accent text-base font-semibold text-on-area-work"
            >
              Clear the deck
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function ClosedTodayCard({ tasks }: { readonly tasks: readonly Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="closed-today-heading">
      <SectionLabel id="closed-today-heading" className="mb-2">
        Closed today
      </SectionLabel>
      <ul className="divide-y divide-card-border rounded-card border border-card-border bg-card-surface">
        {tasks.map((task) => (
          <li key={task.id} className="flex min-h-11 items-center gap-2 px-4 py-2">
            <Check aria-hidden="true" className="size-4 shrink-0 text-state-go-vivid" />
            <span className="line-clamp-2 min-w-0 flex-1 text-sm">{task.title}</span>
            {task.completedAt ? (
              <span className="shrink-0 text-sm text-label-secondary tabular-nums">
                {formatShortTime(task.completedAt)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WeekBars({
  counts,
  labels,
  ariaLabel,
}: {
  readonly counts: readonly number[];
  readonly labels: readonly string[];
  readonly ariaLabel: string;
}) {
  const fractions = barFractions(counts);
  return (
    <ol aria-label={ariaLabel} className="flex h-16 items-end gap-2">
      {counts.map((count, index) => (
        <li
          key={index}
          aria-label={`${labels[index] ?? ''}, ${count} closed`}
          className="flex h-full flex-1 flex-col justify-end gap-1"
        >
          <span
            aria-hidden="true"
            className={`block w-full rounded-card ${count > 0 ? 'bg-state-go-vivid' : 'bg-track-neutral'}`}
            style={{ height: `${Math.max(fractions[index] ?? 0, 0.08) * 100}%` }}
          />
          <span aria-hidden="true" className="block text-center text-xs text-label-tertiary">
            {labels[index]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function WeekBarStrip({
  counts,
  labels,
  caption,
}: {
  readonly counts: readonly number[];
  readonly labels: readonly string[];
  readonly caption: string;
}) {
  const total = counts.reduce((sum, c) => sum + c, 0);
  return (
    <section aria-labelledby="closed-week-heading">
      <SectionLabel id="closed-week-heading" className="mb-2">
        Closed this week · {total}
      </SectionLabel>
      <Card>
        <WeekBars counts={counts} labels={labels} ariaLabel="Items closed per day this week" />
        <p className="mt-2 text-xs text-label-tertiary">{caption}</p>
      </Card>
    </section>
  );
}

export function WeekReviewRow({ headline }: { readonly headline: string }) {
  return (
    <Link
      to="/today/week-review"
      className="spring flex min-h-11 items-center gap-2 rounded-card border border-card-border bg-card-surface p-4 shadow-card"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">Week review</span>
        <span className="block text-sm text-label-secondary">{headline}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
    </Link>
  );
}
