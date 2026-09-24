/** `FocusTimerBar` + `FocusCompletionCardStack` + `OfflineSprintSummaryCard`: the bottom furniture while a sprint runs or a completion waits. */
import { Bell, ChevronDown, ChevronUp, Pause, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  completionSummaryLine,
  digitalTime,
  focusBarAccessibilityLabel,
  offlineSummaryLine,
  pausedBadge,
  secondsUntilNextCheckpoint,
  STOP_CONFIRMATION,
  stopConfirmationMessage,
} from '@/domain/focus';
import type { FocusSession } from '@/domain/focus';
import { ConfirmDialog } from '@/shared/Sheet';

import { SprintRing } from './SprintRing';
import { useFocusStore } from './useFocusStore';

const controlClass =
  'spring flex min-h-11 items-center gap-1 rounded-card px-2 text-sm font-semibold text-accent';

function checkpointLine(session: FocusSession): { text: string; className: string } {
  const until = secondsUntilNextCheckpoint(session);
  if (until !== undefined)
    return { text: `🔔 Next checkpoint in ${digitalTime(until)}`, className: 'text-state-warn' };
  if (session.nudgeCheckpoints.length === 0)
    return { text: 'No checkpoints this sprint', className: 'text-label-secondary' };
  return {
    text: `✓ All ${session.nudgeCheckpoints.length} checkpoints reached`,
    className: 'text-state-go',
  };
}

export function FocusBar() {
  const store = useFocusStore();
  const session = useStore(store, (s) => s.session);
  const banner = useStore(store, (s) => s.checkpointBanner);
  const collapsed = useStore(store, (s) => s.isCardCollapsed);
  const offline = useStore(store, (s) => s.offlineCompletionSummary);
  const unconfirmed = useStore(store, (s) => s.unconfirmedCompletions);
  const logError = useStore(store, (s) => s.logErrorMessage);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const front = unconfirmed[0];

  if (!session && !offline && !front && !logError) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-40 flex flex-col gap-2 md:inset-x-auto md:bottom-4 md:left-64 md:w-[24rem]">
      {logError ? (
        <div
          role="alert"
          className="pointer-events-auto flex items-center gap-2 rounded-card border border-card-border bg-card-surface p-4 text-sm shadow-card"
        >
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Couldn&apos;t log the sprint</span>
            <span className="text-label-secondary"> · {logError}</span>
          </span>
          <button
            type="button"
            onClick={() => store.getState().clearLogError()}
            className="min-h-11 px-4 font-semibold text-accent"
          >
            OK
          </button>
        </div>
      ) : null}
      {offline ? (
        <section
          aria-label="Sprint finished while you were away"
          className="pointer-events-auto flex flex-col items-center gap-2 rounded-card border border-state-go bg-card-surface p-4 text-center shadow-card"
        >
          <p className="text-xs font-bold tracking-widest text-label-secondary uppercase">
            Sprint finished while you were away
          </p>
          <p className="text-base font-semibold">
            {offline.lifeAreaEmoji} {offline.taskTitle}
          </p>
          <p className="text-sm text-label-secondary tabular-nums">{offlineSummaryLine(offline)}</p>
          <button
            type="button"
            onClick={() => store.getState().acknowledgeOfflineCompletion()}
            className="spring min-h-11 w-full rounded-card bg-state-go text-base font-semibold text-on-state-go"
          >
            Got it
          </button>
        </section>
      ) : null}
      {front ? (
        <section
          aria-label="Finished sprint"
          className="pointer-events-auto flex items-center gap-2 rounded-card border border-state-go bg-card-surface px-4 py-2 shadow-card"
        >
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-4 border-state-go text-state-go"
          >
            ✓
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {front.lifeAreaEmoji} {front.taskTitle}
            </span>
            <span className="block truncate text-xs text-label-secondary tabular-nums">
              {completionSummaryLine(front)}
            </span>
            {unconfirmed.length > 1 ? (
              <span className="block text-xs text-label-tertiary">
                {unconfirmed.length - 1} more waiting
              </span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="Confirm this finished sprint"
            onClick={() => void store.getState().confirmCompletion(front)}
            className="spring min-h-11 rounded-full bg-state-go px-4 text-sm font-bold text-on-state-go"
          >
            Confirm
          </button>
        </section>
      ) : null}
      {session ? (
        <section
          aria-label="Focus sprint"
          className="pointer-events-auto rounded-card border border-card-border bg-card-surface shadow-card"
        >
          {collapsed ? (
            <div className="flex items-center gap-2 px-4 py-2">
              <SprintRing
                session={session}
                size={44}
                lineWidth={4}
                label={focusBarAccessibilityLabel(session)}
              >
                <span className="text-[10px] font-bold tabular-nums">
                  {digitalTime(session.remainingSeconds)}
                </span>
              </SprintRing>
              <span aria-hidden="true" className="text-xs">
                {session.lifeAreaEmoji}
              </span>
              <Link to="/focus" className="min-w-0 flex-1 truncate text-sm font-bold">
                {session.taskTitle}
              </Link>
              <button
                type="button"
                aria-label={session.isPaused ? 'Resume sprint' : 'Pause sprint'}
                onClick={() => store.getState().togglePause()}
                className="flex size-11 items-center justify-center text-accent"
              >
                {session.isPaused ? (
                  <Play aria-hidden="true" className="size-6" />
                ) : (
                  <Pause aria-hidden="true" className="size-6" />
                )}
              </button>
              <button
                type="button"
                aria-label="Expand the sprint card"
                onClick={() => store.getState().setCardCollapsed(false)}
                className="flex size-11 items-center justify-center text-label-secondary"
              >
                <ChevronUp aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {banner ? (
                <p
                  role="status"
                  className="flex items-start gap-1 text-xs font-semibold text-state-warn"
                >
                  <Bell aria-hidden="true" className="mt-px size-4 shrink-0" />
                  {banner}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <SprintRing
                  session={session}
                  size={64}
                  lineWidth={6}
                  label={focusBarAccessibilityLabel(session)}
                >
                  <span className="text-xs font-bold tabular-nums">
                    {digitalTime(session.remainingSeconds)}
                  </span>
                </SprintRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-sm">
                      {session.lifeAreaEmoji}
                    </span>
                    <Link to="/focus" className="min-w-0 flex-1 truncate text-sm font-bold">
                      {session.taskTitle}
                    </Link>
                    {pausedBadge(session) ? (
                      <span className="text-xs font-bold tracking-widest text-label-secondary uppercase">
                        {pausedBadge(session)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Collapse the sprint card"
                      onClick={() => store.getState().setCardCollapsed(true)}
                      className="flex size-11 items-center justify-center text-label-secondary"
                    >
                      <ChevronDown aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <p className={`text-xs tabular-nums ${checkpointLine(session).className}`}>
                    {checkpointLine(session).text}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => store.getState().togglePause()}
                  className={controlClass}
                >
                  {session.isPaused ? (
                    <Play aria-hidden="true" className="size-4" />
                  ) : (
                    <Pause aria-hidden="true" className="size-4" />
                  )}
                  {session.isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={() => store.getState().addSeconds(30)}
                  className={controlClass}
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={() => store.getState().addSeconds(300)}
                  className={controlClass}
                >
                  +5m
                </button>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => setConfirmingStop(true)}
                  className={`${controlClass} text-state-risk`}
                >
                  <Square aria-hidden="true" className="size-4" />
                  Stop
                </button>
              </div>
            </div>
          )}
          <ConfirmDialog
            open={confirmingStop}
            title={STOP_CONFIRMATION.title}
            message={stopConfirmationMessage(session)}
            confirmLabel={STOP_CONFIRMATION.confirm}
            cancelLabel={STOP_CONFIRMATION.cancel}
            destructive
            onConfirm={() => {
              setConfirmingStop(false);
              void store.getState().stop();
            }}
            onCancel={() => setConfirmingStop(false)}
          />
        </section>
      ) : null}
    </div>
  );
}
