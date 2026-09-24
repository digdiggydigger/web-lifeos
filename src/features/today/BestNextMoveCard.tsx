/** `BestNextMoveCard`: effort in motion-blue, the area in its tint, the due chip in warn, one green close. */
import { CheckCircle2, Play } from 'lucide-react';
import { Link } from 'react-router';

import { effortLabel } from '@/domain/momentum';
import type { LifeArea, Task } from '@/domain/types';
import { areaClasses } from '@/features/areas/AreaWash';
import { Card } from '@/shared/Card';
import { SectionLabel } from '@/shared/SectionLabel';
import type { Point } from '@/domain/celebrations';
import { centreOf } from '@/features/celebrations/appCelebrations';

interface BestNextMoveCardProps {
  readonly task: Task;
  readonly lifeArea: LifeArea | undefined;
  readonly isDueNow: boolean;
  readonly isClosing: boolean;
  readonly loggedTodayLabel: string | undefined;
  /** Called with the pressed button's centre, where the pop leaves from. */
  readonly onClose: (origin: Point | null) => void;
  /** Hidden while any sprint runs: this card must not offer a second one over the top. */
  readonly showsStartSession: boolean;
  readonly onStartSession: () => void;
}

const chip = 'inline-flex min-h-6 items-center rounded-card px-2 text-xs font-semibold';

export function BestNextMoveCard(props: BestNextMoveCardProps) {
  const {
    task,
    lifeArea,
    isDueNow,
    isClosing,
    loggedTodayLabel,
    onClose,
    showsStartSession,
    onStartSession,
  } = props;
  const effort = effortLabel(task.focusDurationSeconds);
  const area = lifeArea ? areaClasses(lifeArea) : undefined;
  return (
    <section aria-labelledby="best-next-move-heading">
      <SectionLabel id="best-next-move-heading" className="mb-2">
        Best next move
      </SectionLabel>
      <Card className="flex flex-col gap-2">
        {effort || lifeArea || isDueNow ? (
          <div className="flex flex-wrap gap-2">
            {effort ? (
              <span className={`${chip} bg-accent text-on-area-work`}>{effort}</span>
            ) : null}
            {lifeArea && area ? (
              <span className={`${chip} ${area.tint} ${area.text}`}>
                {lifeArea.colour} {lifeArea.name}
              </span>
            ) : null}
            {isDueNow ? (
              <span className={`${chip} bg-card-surface-secondary text-state-warn`}>due today</span>
            ) : null}
          </div>
        ) : null}
        <Link
          to={`/tasks/${task.id}`}
          className="block min-h-11 py-2 text-xl font-bold tracking-tight"
        >
          {task.title}
        </Link>
        {task.notes ? (
          <p className="line-clamp-2 text-sm text-label-secondary">{task.notes}</p>
        ) : null}
        {loggedTodayLabel ? (
          <p>
            <span
              aria-label={`Focus logged: ${loggedTodayLabel}`}
              className={`${chip} bg-card-surface-secondary text-state-go`}
            >
              ✓ {loggedTodayLabel}
            </span>
          </p>
        ) : null}
        <button
          type="button"
          disabled={isClosing}
          onClick={(event) => onClose(centreOf(event.currentTarget))}
          className="spring flex min-h-11 w-full items-center justify-center gap-2 rounded-card bg-state-go text-base font-semibold text-on-state-go disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden="true" className="size-6" />
          {isClosing ? 'Closing…' : 'Close it'}
        </button>
        {showsStartSession ? (
          <button
            type="button"
            onClick={onStartSession}
            className="spring flex min-h-11 w-full items-center justify-center gap-2 rounded-card border border-card-border text-base font-semibold text-label-secondary"
          >
            <Play aria-hidden="true" className="size-4" />
            {loggedTodayLabel ? 'Start another session' : 'Start session'}
          </button>
        ) : null}
      </Card>
    </section>
  );
}
