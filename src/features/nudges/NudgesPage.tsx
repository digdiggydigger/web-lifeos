/** `NudgesView`: the pushed screen behind Today's door — due cards, the rows with inline edit, the recent stamps, the New nudge sheet. */
import { Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { nudgeCountLine, nudgeNextFireLine, nudgeScheduledCount } from '@/domain/momentum';
import { DEFAULT_NUDGE_SCHEDULE, parseSchedule, scheduleSummary } from '@/domain/nudges';
import type { NudgeSchedule } from '@/domain/nudges';
import { formatAbbreviatedDate, formatShortTime } from '@/domain/time/calendar';
import type { Nudge } from '@/domain/types';
import { preferencesStore } from '@/features/settings/preferencesStore';
import { Card } from '@/shared/Card';
import { fieldClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { SectionLabel } from '@/shared/SectionLabel';
import { Sheet } from '@/shared/Sheet';

import { NudgeDueCard } from './NudgeDueCard';
import { NudgeScheduleEditor } from './NudgeScheduleEditor';
import { dueNudges, isNewNudgeValid, nudgesOf } from './nudgesStore';
import type { NudgesStore } from './nudgesStore';
import { useNudgesStore } from './useNudgesStore';

function NudgeRow({
  nudge,
  store,
  now,
}: {
  readonly nudge: Nudge;
  readonly store: NudgesStore;
  readonly now: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState('');
  const [schedule, setSchedule] = useState<NudgeSchedule>(DEFAULT_NUDGE_SCHEDULE);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const labelId = useId();
  const nextLine = nudgeNextFireLine(nudge, now);

  function beginEdit(): void {
    setLabel(nudge.label);
    setSchedule(parseSchedule(nudge.schedule) ?? DEFAULT_NUDGE_SCHEDULE);
    setExpanded(true);
  }

  return (
    <Card className={`flex flex-col gap-2 ${nudge.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-base font-medium ${nudge.active ? '' : 'line-through'}`}>
            {nudge.label}
          </p>
          <p className="text-sm text-label-secondary">
            {scheduleSummary(nudge.schedule) ?? nudge.schedule}
            {nextLine ? ` · ${nextLine}` : ''}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => (expanded ? setExpanded(false) : beginEdit())}
          className="min-h-11 px-4 text-sm font-semibold text-accent"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => void store.getState().toggleActive(nudge)}
          className="min-h-11 px-4 text-sm font-semibold text-accent"
        >
          {nudge.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {expanded ? (
        <form
          className="flex flex-col gap-4 border-t border-card-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void store
              .getState()
              .update(nudge, label, schedule)
              .then((ok) => {
                if (ok) setExpanded(false);
              });
          }}
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor={labelId}
              className="text-xs font-bold tracking-widest text-label-secondary uppercase"
            >
              Label
            </label>
            <input
              id={labelId}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={fieldClass}
            />
          </div>
          <NudgeScheduleEditor
            schedule={schedule}
            onChange={setSchedule}
            idPrefix={`edit-${nudge.id}`}
          />
          {errorMessage ? (
            <p role="alert" className="text-sm text-state-risk">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="min-h-11 px-4 text-sm font-semibold text-label-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="spring min-h-11 rounded-card bg-accent px-4 text-sm font-semibold text-on-area-work"
            >
              Save
            </button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

export function NudgesPage() {
  const store = useNudgesStore();
  const state = useStore(store, (s) => s.state);
  const newLabel = useStore(store, (s) => s.newLabel);
  const newSchedule = useStore(store, (s) => s.newSchedule);
  const isCreating = useStore(store, (s) => s.isCreating);
  const createError = useStore(store, (s) => s.createErrorMessage);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const prefs = useStore(preferencesStore, (s) => s.preferences);
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(params.has('new'));
  const nameId = useId();
  const now = new Date();
  const nudges = nudgesOf({ state });
  const due = dueNudges(nudges, now);
  const dueIds = new Set(due.map((n) => n.id));
  const scheduled = nudgeScheduledCount(nudges, due);
  const ordered = [
    ...nudges.filter((n) => dueIds.has(n.id)),
    ...nudges.filter((n) => !dueIds.has(n.id)),
  ];
  const recent = nudges
    .flatMap((n) => (n.completionDates ?? []).map((at) => ({ label: n.label, at })))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  useEffect(() => {
    if (params.has('new')) setParams({}, { replace: true });
  }, [params, setParams]);

  const saveButton = (
    <button
      type="button"
      disabled={!isNewNudgeValid({ newLabel, newSchedule }) || isCreating}
      onClick={() => {
        void store
          .getState()
          .createNudge()
          .then((ok) => {
            if (ok) setAdding(false);
          });
      }}
      className="min-h-11 text-sm font-semibold text-accent disabled:text-label-tertiary"
    >
      Save
    </button>
  );

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-label-secondary uppercase">
            {nudgeCountLine(due.length, scheduled)}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Nudges</h1>
        </div>
        <button
          type="button"
          aria-label="New nudge"
          onClick={() => setAdding(true)}
          className="spring flex size-11 items-center justify-center rounded-card bg-accent text-on-area-work"
        >
          <Plus aria-hidden="true" className="size-6" />
        </button>
      </header>
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your nudges" body={state.message} />
      ) : null}
      {state.kind === 'loaded' ? (
        <div className="flex flex-col gap-4">
          {errorMessage ? (
            <p role="alert" className="text-sm text-state-risk">
              {errorMessage}
            </p>
          ) : null}
          {nudges.length === 0 ? (
            <p role="status" className="py-6 text-center text-sm text-label-secondary">
              No nudges yet — a gentle schedule starts with one.
            </p>
          ) : null}
          {ordered.map((nudge) =>
            dueIds.has(nudge.id) ? (
              <NudgeDueCard
                key={nudge.id}
                nudge={nudge}
                showStreaks={prefs.showStreaks}
                now={now}
                onDismiss={() => void store.getState().dismiss(nudge)}
              />
            ) : (
              <NudgeRow key={nudge.id} nudge={nudge} store={store} now={now} />
            ),
          )}
          {recent.length > 0 ? (
            <section aria-labelledby="recent-heading">
              <SectionLabel id="recent-heading" className="mb-2">
                Recent
              </SectionLabel>
              <Card>
                <ul className="flex flex-col gap-2">
                  {recent.map((entry, index) => (
                    <li key={index} className="flex min-h-6 items-center gap-2 text-sm">
                      <span className="text-label-secondary tabular-nums">
                        {formatAbbreviatedDate(entry.at)} {formatShortTime(entry.at)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      <span className="rounded-card bg-card-surface-secondary px-2 text-xs font-semibold text-state-go">
                        done
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="spring flex min-h-14 w-full items-center justify-center gap-2 rounded-card border border-card-border text-base font-medium text-label-secondary"
          >
            <Plus aria-hidden="true" className="size-4" />
            New nudge — label and schedule
          </button>
        </div>
      ) : null}
      <Sheet open={adding} title="New nudge" onClose={() => setAdding(false)} trailing={saveButton}>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={nameId}
            className="text-xs font-bold tracking-widest text-label-secondary uppercase"
          >
            Nudge name
          </label>
          <input
            id={nameId}
            placeholder="Drink water"
            value={newLabel}
            onChange={(e) => store.getState().setNewLabel(e.target.value)}
            className={fieldClass}
          />
        </div>
        <NudgeScheduleEditor
          schedule={newSchedule}
          onChange={(s) => store.getState().setNewSchedule(s)}
          idPrefix="new"
        />
        {createError ? (
          <p role="alert" className="text-sm text-state-risk">
            {createError}
          </p>
        ) : null}
      </Sheet>
    </>
  );
}
