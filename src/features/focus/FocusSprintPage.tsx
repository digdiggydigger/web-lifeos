/** `FocusSprintDetailView` + `FocusSprintTimelineCard` + `FocusCadenceEditorCard`: the full sprint view at /focus. */
import { Bell, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from 'zustand';

import {
  CADENCE_COUNT_CHOICES,
  CADENCE_INTERVAL_PRESET_SECONDS,
  cadenceModeTitle,
  checkpointPrompt,
  digitalTime,
  draftFromCadence,
  draftSummary,
  elapsedSeconds,
  humanSpan,
  intervalUnitTitle,
  nextCheckpoint,
  resolvedCadence,
  resolvedIntervalSeconds,
  secondsUntilNextCheckpoint,
  selectingIntervalUnit,
  STOP_CONFIRMATION,
  stopConfirmationMessage,
} from '@/domain/focus';
import type {
  CadenceMode,
  FocusCadenceDraft,
  FocusNudgeCadence,
  FocusSession,
  IntervalUnit,
} from '@/domain/focus';
import { formatShortTime } from '@/domain/time/calendar';
import { Card } from '@/shared/Card';
import { chipClass, fieldClass, primaryButtonClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';
import { ConfirmDialog } from '@/shared/Sheet';

import { SprintRing } from './SprintRing';
import { useFocusStore } from './useFocusStore';

function StatusPill({
  text,
  tone,
}: {
  readonly text: string;
  readonly tone: 'warn' | 'go' | 'plain';
}) {
  const toneClass = { warn: 'text-state-warn', go: 'text-state-go', plain: 'text-label-secondary' }[
    tone
  ];
  return (
    <p
      className={`rounded-card bg-card-surface-secondary px-4 py-2 text-center text-sm font-semibold ${toneClass}`}
    >
      {text}
    </p>
  );
}

function TimelineCard({ session }: { readonly session: FocusSession }) {
  const total = session.nudgeCheckpoints.length;
  const next = nextCheckpoint(session);
  const elapsed = elapsedSeconds(session);
  const firstMark = session.nudgeCheckpoints[0] ?? session.durationSeconds;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Sprint timeline</SectionLabel>
        <span className="text-xs text-label-secondary">
          {session.triggeredCheckpointIndices.size} of {total} passed
        </span>
      </div>
      <div>
        <div aria-hidden="true" className="relative h-2 w-full rounded-full bg-track-neutral">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${(elapsed / Math.max(1, session.durationSeconds)) * 100}%` }}
          />
          {session.nudgeCheckpoints.map((mark, index) => (
            <span
              key={index}
              className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card-surface ${session.triggeredCheckpointIndices.has(index) ? 'bg-state-go' : 'bg-label-tertiary'}`}
              style={{ left: `${(mark / Math.max(1, session.durationSeconds)) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-label-secondary tabular-nums">
          <span>00:00</span>
          <span>{humanSpan(session.durationSeconds)}</span>
        </div>
        <ul className="sr-only">
          {session.nudgeCheckpoints.map((mark, index) => (
            <li key={index}>
              Checkpoint {index + 1} at {humanSpan(mark)}
            </li>
          ))}
        </ul>
      </div>
      {next ? (
        <p className="text-sm">
          <span className="font-semibold text-state-warn">
            Up next · checkpoint {next.index + 1}
          </span>
          <span className="block text-label-secondary">{checkpointPrompt(next.index, total)}</span>
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-label-secondary">
          No checkpoints scheduled — set a cadence below to get nudged.
        </p>
      ) : (
        <p className="text-sm font-semibold text-state-go">
          Every checkpoint crossed. Finish strong.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          {
            title: 'Deep entry',
            value: `00:00 → ${humanSpan(firstMark)}`,
            caption: elapsed >= firstMark ? 'Completed' : 'In progress',
          },
          {
            title: 'Cadence',
            value: total === 1 ? '1 checkpoint' : `${total} checkpoints`,
            caption: total === 0 ? 'None scheduled' : 'Banner + notification',
          },
          {
            title: 'Sprint target',
            value: humanSpan(session.durationSeconds),
            caption: 'Logged on finish',
          },
        ].map((phase) => (
          <div key={phase.title} className="rounded-card bg-page-background p-2">
            <dt className="text-xs font-bold tracking-widest text-label-secondary uppercase">
              {phase.title}
            </dt>
            <dd className="text-sm font-bold">{phase.value}</dd>
            <dd className="text-xs text-label-secondary">{phase.caption}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function CadenceEditor({
  session,
  cadence,
  onApply,
}: {
  readonly session: FocusSession;
  readonly cadence: FocusNudgeCadence;
  readonly onApply: (cadence: FocusNudgeCadence) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FocusCadenceDraft>(() => draftFromCadence(cadence));
  const current = draftFromCadence(cadence);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionLabel>Nudge cadence</SectionLabel>
          <p className="text-sm text-label-secondary">
            {draftSummary(current, session.durationSeconds)}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => {
            setDraft(draftFromCadence(cadence));
            setEditing((e) => !e);
          }}
          className="min-h-11 px-4 text-sm font-semibold text-accent"
        >
          {editing ? 'Hide cadence options' : 'Change cadence'}
        </button>
      </div>
      {editing ? (
        <div className="flex flex-col gap-4">
          <div role="group" aria-label="Cadence mode" className="grid grid-cols-2 gap-2">
            {(['count', 'interval'] as CadenceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                onClick={() => setDraft({ ...draft, mode })}
                className={chipClass}
              >
                {cadenceModeTitle(mode)}
              </button>
            ))}
          </div>
          {draft.mode === 'count' ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Total nudges this sprint</p>
              <div role="group" aria-label="Total nudges" className="flex flex-wrap gap-2">
                {CADENCE_COUNT_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-label={choice === 1 ? '1 nudge' : `${choice} nudges`}
                    aria-pressed={draft.count === choice}
                    onClick={() => setDraft({ ...draft, count: choice })}
                    className={`${chipClass} min-w-11`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Nudge me every…</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  aria-label="Interval"
                  min={1}
                  value={draft.intervalValue}
                  onChange={(e) => setDraft({ ...draft, intervalValue: Number(e.target.value) })}
                  className={`${fieldClass} w-24`}
                />
                <div role="group" aria-label="Interval unit" className="flex gap-2">
                  {(['seconds', 'minutes'] as IntervalUnit[]).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      aria-pressed={draft.intervalUnit === unit}
                      onClick={() => setDraft(selectingIntervalUnit(draft, unit))}
                      className={chipClass}
                    >
                      {intervalUnitTitle(unit)}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-label-secondary">
                  {humanSpan(resolvedIntervalSeconds(draft))}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CADENCE_INTERVAL_PRESET_SECONDS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Every ${preset} seconds`}
                    onClick={() =>
                      setDraft({ ...draft, intervalUnit: 'seconds', intervalValue: preset })
                    }
                    className={chipClass}
                  >
                    {preset}s
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm font-semibold">{draftSummary(draft, session.durationSeconds)}</p>
          <p className="text-xs text-label-secondary">
            Checkpoints you&apos;ve already passed stay put — only the ones still ahead move.
          </p>
          <button
            type="button"
            onClick={() => {
              onApply(resolvedCadence(draft));
              setEditing(false);
            }}
            className={primaryButtonClass}
          >
            Apply to sprint
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export function FocusSprintPage() {
  const store = useFocusStore();
  const navigate = useNavigate();
  const session = useStore(store, (s) => s.session);
  const banner = useStore(store, (s) => s.checkpointBanner);
  const startedAt = useStore(store, (s) => s.startedAt);
  const cadence = useStore(store, (s) => s.cadence);
  const [confirmingStop, setConfirmingStop] = useState(false);

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span aria-hidden="true" className="text-4xl text-state-go">
          ✓
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Sprint finished</h1>
        <p className="text-sm text-label-secondary">Your focus time has been logged.</p>
        <button
          type="button"
          onClick={() => void navigate('/today')}
          className={`${primaryButtonClass} w-full max-w-xs`}
        >
          Done
        </button>
      </div>
    );
  }

  const until = secondsUntilNextCheckpoint(session);
  const next = nextCheckpoint(session);
  const identity = `${session.lifeAreaEmoji}${session.isPaused ? ' · paused' : ''}${startedAt ? ` · started ${formatShortTime(startedAt)}` : ''}`;
  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-label-secondary uppercase">
            {session.isPaused ? 'Session paused' : 'Active focus sprint'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Focus sprint</h1>
        </div>
        <button
          type="button"
          onClick={() => void navigate('/today')}
          className="min-h-11 px-4 text-sm font-semibold text-accent"
        >
          Done
        </button>
      </header>
      <div className="flex flex-col gap-6">
        {banner ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-card border border-card-border bg-card-surface p-4 text-sm font-semibold text-state-warn shadow-card"
          >
            <Bell aria-hidden="true" className="mt-px size-4 shrink-0" />
            {banner}
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-4">
          <SprintRing
            session={session}
            size={236}
            lineWidth={12}
            label={`${Math.floor(Math.max(0, session.remainingSeconds) / 60)} minutes ${Math.max(0, session.remainingSeconds) % 60} seconds remaining`}
          >
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tight tabular-nums">
                {digitalTime(session.remainingSeconds)}
              </span>
              <span className="text-xs font-bold tracking-widest text-label-secondary uppercase">
                {Math.floor(elapsedSeconds(session) / 60)} of{' '}
                {Math.floor(session.durationSeconds / 60)} min logged
              </span>
            </div>
          </SprintRing>
          {next && until !== undefined ? (
            <StatusPill
              text={`Next nudge in ${digitalTime(until)} · at ${humanSpan(next.atSeconds)}`}
              tone="warn"
            />
          ) : session.nudgeCheckpoints.length === 0 ? (
            <StatusPill text="No nudges scheduled this sprint" tone="plain" />
          ) : (
            <StatusPill
              text={`All ${session.nudgeCheckpoints.length} checkpoints reached`}
              tone="go"
            />
          )}
          <div className="text-center">
            <p className="text-xl font-bold tracking-tight">{session.taskTitle}</p>
            <p className="text-sm text-label-secondary">{identity}</p>
          </div>
        </div>
        <TimelineCard session={session} />
        <CadenceEditor
          session={session}
          cadence={cadence}
          onApply={(c) => store.getState().updateCadence(c)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {[60, 300, 600].map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => store.getState().addSeconds(seconds)}
                className={`${chipClass} flex-1`}
              >
                +{seconds / 60} min
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => store.getState().togglePause()}
              className="spring flex min-h-14 flex-1 items-center justify-center gap-2 rounded-card border border-card-border text-base font-semibold"
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
              onClick={() => setConfirmingStop(true)}
              className="spring flex min-h-14 flex-1 items-center justify-center gap-2 rounded-card bg-state-go text-base font-semibold text-on-state-go"
            >
              ✓ Close it
            </button>
          </div>
          <p className="text-center text-sm text-label-secondary">
            Stopping early still logs the minutes you did.
          </p>
        </div>
      </div>
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
    </>
  );
}
