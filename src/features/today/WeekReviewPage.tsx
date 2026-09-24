/** `WeekReviewView`: the rolling seven days, read from the same home store Today loaded. */
import { Check } from 'lucide-react';
import { useStore } from 'zustand';

import { buildWeekReview } from '@/domain/momentum';
import { addDays, startOfDay } from '@/domain/time/calendar';
import { DailySummarySection } from '@/features/dailySummary/DailySummarySection';
import { dueNudges, nudgesOf } from '@/features/nudges/nudgesStore';
import { useNudgesStore } from '@/features/nudges/useNudgesStore';
import { Card } from '@/shared/Card';
import { EmptyState } from '@/shared/EmptyState';
import { SectionLabel } from '@/shared/SectionLabel';

import { activeAreas } from './homeStore';
import { WeekBars } from './TodayCards';
import { useHomeStore } from './useHomeStore';

/** `8–14 Aug`, or `28 Jul – 3 Aug` across a month boundary. */
export function windowLine(now: Date, locale?: string): string {
  const end = startOfDay(now);
  const start = addDays(end, -6);
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

function LabelledCard({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <section aria-label={title}>
      <SectionLabel className="mb-2">{title}</SectionLabel>
      <Card>
        <p className="text-sm">{body}</p>
      </Card>
    </section>
  );
}

export function WeekReviewPage() {
  const store = useHomeStore();
  const state = useStore(store, (s) => s.state);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const allTasks = useStore(store, (s) => s.allTasks);
  const inbox = useStore(store, (s) => s.inbox);
  const focusSessions = useStore(store, (s) => s.focusSessions);
  const openTasks = useStore(store, (s) => s.openTasks);
  const nudgesStore = useNudgesStore();
  const nudgesState = useStore(nudgesStore, (s) => s.state);
  const now = new Date();
  const review = buildWeekReview({
    tasks: allTasks,
    lifeAreas,
    sessions: focusSessions,
    inboxCount: inbox.length,
    now,
  });

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-widest text-label-secondary uppercase">
          {now.toLocaleDateString(undefined, { weekday: 'long' })} · {windowLine(now)}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Week review</h1>
      </header>
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your week" body={state.message} />
      ) : null}
      {state.kind === 'loaded' ? (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-xl font-bold tracking-tight">{review.headline}</p>
            <div className="mt-4">
              <WeekBars
                counts={review.dayCounts}
                labels={review.dayLabels}
                ariaLabel="Items closed per day"
              />
            </div>
          </Card>
          {review.dopamineWins.length > 0 ? (
            <section aria-label="Dopamine wins">
              <SectionLabel className="mb-2">Dopamine wins</SectionLabel>
              <ul className="divide-y divide-card-border rounded-card border border-card-border bg-card-surface">
                {review.dopamineWins.map((title) => (
                  <li key={title} className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm">
                    <Check aria-hidden="true" className="size-4 shrink-0 text-state-go" />
                    <span className="min-w-0 flex-1">{title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {review.staminaLine ? (
            <LabelledCard title="Focus stamina" body={review.staminaLine} />
          ) : null}
          {review.quietLine ? (
            <LabelledCard title="Quiet this week" body={review.quietLine} />
          ) : null}
          {review.kickstart.length > 0 ? (
            <section aria-label="Gentle kickstart">
              <SectionLabel className="mb-2">Gentle kickstart</SectionLabel>
              <ul className="divide-y divide-card-border rounded-card border border-card-border bg-card-surface">
                {review.kickstart.map((line) => (
                  <li key={line} className="flex min-h-11 items-center px-4 py-2 text-sm">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <DailySummarySection
            counts={{
              openTasks: openTasks.length,
              lifeAreas: activeAreas(lifeAreas).length,
              inbox: inbox.length,
              dueNudges: dueNudges(nudgesOf({ state: nudgesState }), now).length,
            }}
          />
        </div>
      ) : null}
    </>
  );
}
