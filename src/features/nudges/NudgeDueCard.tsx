/** `NudgeDueCard`: the label large, the schedule line, the streak dots once stamps have accrued, and one green Done for now. */
import { nudgeStreakLine, nudgeWeekFlags, scheduleSummary } from '@/domain/nudges';
import type { Nudge } from '@/domain/types';

interface NudgeDueCardProps {
  readonly nudge: Nudge;
  readonly showStreaks: boolean;
  readonly now: Date;
  readonly onDismiss: () => void;
}

export function NudgeDueCard({ nudge, showStreaks, now, onDismiss }: NudgeDueCardProps) {
  const dates = nudge.completionDates ?? [];
  const line = showStreaks && dates.length > 0 ? nudgeStreakLine(dates, now) : undefined;
  return (
    <article
      aria-label={`${nudge.label}, due`}
      className="flex flex-col gap-2 rounded-card border border-state-warn bg-card-surface p-4 shadow-card"
    >
      <h3 className="text-xl font-bold tracking-tight">{nudge.label}</h3>
      <p className="text-sm text-label-secondary">
        {scheduleSummary(nudge.schedule) ?? nudge.schedule}
      </p>
      {line ? (
        <>
          <ol aria-hidden="true" className="flex gap-1">
            {nudgeWeekFlags(dates, now).map((hit, index) => (
              <li
                key={index}
                className={`size-2 rounded-full ${hit ? 'bg-state-go-vivid' : 'bg-track-neutral-strong'}`}
              />
            ))}
          </ol>
          <p className="text-sm text-label-secondary tabular-nums">{line}</p>
        </>
      ) : null}
      <button
        type="button"
        aria-label={`Dismiss ${nudge.label}`}
        onClick={onDismiss}
        className="spring min-h-11 w-full rounded-card bg-state-go text-base font-semibold text-on-state-go"
      >
        Done for now
      </button>
    </article>
  );
}
