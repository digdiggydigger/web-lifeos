/** `FocusAnalyticsSection`: `WeeklyFocusSummaryWidget` and `ProductivityTrendChart`, hidden until there is any history. */
import { useState } from 'react';

import {
  activeDayCount,
  bucketFocusedMinutes,
  currentFocusWeek,
  dailyAverageSeconds,
  durationLabel,
  focusCurrentStreak,
  focusGoalProgress,
  peakDay,
  rollingFocusDays,
  totalFocusedSeconds,
  totalSessions,
} from '@/domain/focus';
import type { FocusDayBucket } from '@/domain/focus';
import type { CompletedFocusSession } from '@/domain/types';
import { Card } from '@/shared/Card';
import { chipClass } from '@/shared/Chips';

function Bars({
  buckets,
  value,
  goal,
  label,
}: {
  readonly buckets: readonly FocusDayBucket[];
  readonly value: (b: FocusDayBucket) => number;
  readonly goal?: number;
  readonly label: string;
}) {
  const peak = Math.max(goal ?? 0, ...buckets.map(value), 1);
  return (
    <div className="relative">
      {goal !== undefined && goal > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-label-tertiary"
          style={{ bottom: `calc(${(goal / peak) * 100}% * 0.75 + 1.25rem)` }}
        />
      ) : null}
      <ol aria-label={label} className="flex h-24 items-end gap-2">
        {buckets.map((bucket) => (
          <li
            key={bucket.date.getTime()}
            aria-label={`${bucket.date.toLocaleDateString(undefined, { weekday: 'short' })}, ${value(bucket)}`}
            className="flex h-full flex-1 flex-col justify-end gap-1"
          >
            <span
              aria-hidden="true"
              className={`block w-full rounded-card ${value(bucket) > 0 ? 'bg-accent' : 'bg-track-neutral'}`}
              style={{ height: `${Math.max((value(bucket) / peak) * 75, 4)}%` }}
            />
            <span aria-hidden="true" className="block text-center text-xs text-label-tertiary">
              {bucket.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FocusAnalyticsSection({
  sessions,
  dailyGoalMinutes,
  now,
}: {
  readonly sessions: readonly CompletedFocusSession[];
  readonly dailyGoalMinutes: number;
  readonly now: Date;
}) {
  const [metric, setMetric] = useState<'focus' | 'sessions'>('focus');
  if (sessions.length === 0) return null;
  const week = currentFocusWeek(sessions, now);
  const rolling = rollingFocusDays(sessions, 7, now);
  const progress = focusGoalProgress(week, dailyGoalMinutes);
  const peak = peakDay(rolling);
  return (
    <>
      <section aria-label="This Week's Focus">
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-accent uppercase">
              This Week&apos;s Focus
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {durationLabel(totalFocusedSeconds(week))}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              {
                value: `${activeDayCount(week)}/${Math.max(1, week.length)}`,
                label: 'Active Days',
              },
              { value: durationLabel(dailyAverageSeconds(week)), label: 'Daily Avg' },
              { value: String(focusCurrentStreak(week)), label: 'Day Streak' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-card bg-card-surface-secondary p-2">
                <dd className="text-base font-bold">{stat.value}</dd>
                <dt className="text-xs text-label-secondary">{stat.label}</dt>
              </div>
            ))}
          </dl>
          <Bars
            buckets={week}
            value={bucketFocusedMinutes}
            goal={dailyGoalMinutes}
            label="Focus time per day this week"
          />
          <div>
            <div className="flex justify-between text-xs">
              <span className="text-label-secondary">Weekly goal · {dailyGoalMinutes}m/day</span>
              <span
                className={`font-bold ${progress >= 1 ? 'text-state-go' : 'text-label-secondary'}`}
              >
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="mt-1 h-2 overflow-hidden rounded-full bg-track-neutral"
            >
              <div
                className={`h-full ${progress >= 1 ? 'bg-state-go' : 'bg-accent'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </section>
      <section aria-label="7-Day Trend">
        <Card className="flex flex-col gap-4">
          <p className="text-xs font-bold tracking-widest text-accent uppercase">7-Day Trend</p>
          <div role="group" aria-label="Metric" className="grid grid-cols-2 gap-2">
            {(['focus', 'sessions'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
                className={chipClass}
              >
                {option === 'focus' ? 'Focus' : 'Sessions'}
              </button>
            ))}
          </div>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold">
              {metric === 'focus'
                ? durationLabel(totalFocusedSeconds(rolling))
                : `${totalSessions(rolling)} sessions`}
            </span>
            {peak ? (
              <span className="text-xs text-label-secondary">
                · peak {durationLabel(peak.focusedSeconds)} on{' '}
                {peak.date.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
            ) : null}
          </p>
          <Bars
            buckets={rolling}
            value={(b) => (metric === 'focus' ? bucketFocusedMinutes(b) : b.sessionCount)}
            label={`${metric === 'focus' ? 'Focus' : 'Sessions'} over the last 7 days`}
          />
        </Card>
      </section>
    </>
  );
}
