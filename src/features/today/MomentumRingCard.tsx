/** `MomentumRingCard` (`Home/MomentumScoreboardViews.swift`): the ring, then the streak or the still-open counterweight. */
import { ringProgress, streakLine } from '@/domain/momentum';
import { SectionLabel } from '@/shared/SectionLabel';

const SIZE = 126;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface MomentumRingCardProps {
  readonly closedToday: number;
  readonly goal: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly openCount: number;
  readonly weekFlags: readonly boolean[];
  readonly nextEffortLabel: string | undefined;
}

export function MomentumRingCard(props: MomentumRingCardProps) {
  const { closedToday, goal, streak, bestStreak, openCount, weekFlags, nextEffortLabel } = props;
  const progress = ringProgress(closedToday, goal);
  const closedDays = weekFlags.filter(Boolean).length;
  return (
    <section aria-label="Momentum" className="flex items-center gap-6 py-2">
      <div
        role="img"
        data-momentum-ring=""
        aria-label={`${closedToday} of ${goal} closed today`}
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-track-neutral"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="spring stroke-state-go-vivid transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span
            className={`text-4xl font-bold tracking-tight tabular-nums ${closedToday > 0 ? 'text-state-go' : 'text-label-primary'}`}
          >
            {closedToday}
          </span>
          <span className="text-xs font-bold tracking-widest text-label-secondary uppercase">
            of {goal} closed
          </span>
        </div>
      </div>
      {streak > 0 ? (
        <div className="min-w-0 flex-1">
          <SectionLabel>Streak</SectionLabel>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{streak}</span>
            <span className="text-sm text-label-secondary">{streak === 1 ? 'day' : 'days'}</span>
          </p>
          <ol aria-label={`Closed on ${closedDays} of the last 7 days`} className="mt-2 flex gap-2">
            {weekFlags.map((closed, index) => (
              <li
                key={index}
                aria-hidden="true"
                className={`size-2 rounded-full ${closed ? 'bg-state-go-vivid' : 'bg-track-neutral'}`}
              />
            ))}
          </ol>
          <p className="mt-2 text-sm text-label-secondary">
            {streakLine(streak, bestStreak, closedToday)}
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <SectionLabel>Still open</SectionLabel>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{openCount}</span>
            <span className="text-sm text-label-secondary">
              {openCount === 1 ? 'item' : 'items'}
            </span>
          </p>
          <p className="mt-2 text-sm text-label-secondary">
            {nextEffortLabel
              ? `One of them is ${nextEffortLabel}.`
              : 'Close one to start a streak.'}
          </p>
        </div>
      )}
    </section>
  );
}
