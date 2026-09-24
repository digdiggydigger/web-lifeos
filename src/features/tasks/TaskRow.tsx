import { Check, Circle, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Link } from 'react-router';

import { effortLabel } from '@/domain/momentum/momentumScoreboard';
import { rubberBanded, swipeCloses, taskAccessibilityLabel, taskMetaLine } from '@/domain/tasks';
import type { LifeArea, Task } from '@/domain/types';

interface TaskRowProps {
  readonly task: Task;
  readonly lifeArea: LifeArea | undefined;
  readonly now: Date;
  readonly onClose: (task: Task) => void;
  /** The row's sprint launch (`taskStartFocus-…`); absent where a sprint cannot start from here. */
  readonly onStartFocus?: ((task: Task) => void) | undefined;
}

const SWIPE_START_PX = 12;

/** One task row: effort chip, title, meta line, and the 44 px close control. Touch users can also swipe right. */
export function TaskRow({ task, lifeArea, now, onClose, onStartFocus }: TaskRowProps) {
  const done = task.status === 'done';
  const effort = effortLabel(task.focusDurationSeconds);
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);

  function pointerDown(event: PointerEvent<HTMLLIElement>) {
    if (done || event.pointerType !== 'touch') return;
    start.current = { x: event.clientX, y: event.clientY, active: false };
  }
  function pointerMove(event: PointerEvent<HTMLLIElement>) {
    const s = start.current;
    if (!s) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (!s.active) {
      if (Math.abs(dx) < SWIPE_START_PX || Math.abs(dy) > Math.abs(dx)) return;
      s.active = true;
    }
    setOffset(rubberBanded(dx));
  }
  function pointerEnd(event: PointerEvent<HTMLLIElement>) {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    const dx = event.clientX - s.x;
    setOffset(0);
    if (swipeCloses(dx)) onClose(task);
  }

  return (
    <li
      className="relative overflow-hidden"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
    >
      {offset > 0 ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 flex items-center bg-state-go pl-4 text-xs font-bold tracking-widest text-on-state-go"
          style={{ width: offset }}
        >
          {offset > 60 ? '✓ CLOSE' : ''}
        </div>
      ) : null}
      <div
        className={`flex min-h-14 items-center gap-2 bg-card-surface py-2 pl-4 ${done ? 'opacity-60' : ''}`}
        style={offset > 0 ? { transform: `translateX(${offset}px)` } : undefined}
      >
        {effort ? (
          <span className="shrink-0 rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-medium text-label-secondary">
            {effort}
          </span>
        ) : null}
        <Link
          to={`/tasks/${task.id}`}
          aria-label={`${task.title}. ${taskAccessibilityLabel(task, lifeArea, now)}. Open details`}
          className="min-w-0 flex-1 py-1"
        >
          <p
            className={`line-clamp-2 text-base font-medium ${done ? 'text-label-secondary line-through' : ''}`}
          >
            {task.title}
          </p>
          <p className="truncate text-xs text-label-secondary">
            {taskMetaLine(task, lifeArea, now)}
          </p>
        </Link>
        {done ? (
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center text-state-go"
          >
            <Check className="size-6" />
          </span>
        ) : (
          <>
            {onStartFocus ? (
              <button
                type="button"
                aria-label="Start focus sprint"
                onClick={() => onStartFocus(task)}
                className="flex size-11 shrink-0 items-center justify-center text-accent"
              >
                <Play aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close task"
              onClick={() => onClose(task)}
              className="spring flex size-11 shrink-0 items-center justify-center text-label-tertiary hover:text-state-go"
            >
              <Circle aria-hidden="true" className="size-6" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
