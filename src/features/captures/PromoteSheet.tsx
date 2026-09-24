import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { capturePrimaryText } from '@/domain/captures';
import { effortLabel } from '@/domain/momentum/momentumScoreboard';
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import { TASK_PRIORITIES } from '@/domain/types';
import type { Capture, TaskPriority } from '@/domain/types';
import { celebrations } from '@/features/celebrations/appCelebrations';
import { toDateTimeLocal } from '@/features/tasks/TaskCreateDialog';
import { Card } from '@/shared/Card';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';
import { Sheet } from '@/shared/Sheet';

import type { CaptureInboxState } from './captureInboxStore';

interface PromoteSheetProps {
  readonly capture: Capture | undefined;
  readonly lifeAreaId: string | undefined;
  readonly store: StoreApi<CaptureInboxState>;
  readonly onClose: () => void;
  readonly onPromoted: () => void;
}

const EFFORTS = [600, 900, 1800];
const chip = (selected: boolean) =>
  `spring min-h-11 flex-1 rounded-card px-2 text-sm font-semibold ${selected ? 'bg-accent text-on-area-work' : 'bg-card-surface-secondary text-label-secondary'}`;

/** `CapturePromoteSheet`: "Make a task" with effort, when, priority and an exact due date. */
export function PromoteSheet({
  capture,
  lifeAreaId,
  store,
  onClose,
  onPromoted,
}: PromoteSheetProps) {
  const warning = useStore(store, (s) => s.warningMessage);
  const error = useStore(store, (s) => s.errorMessage);
  const [priority, setPriority] = useState<TaskPriority>('p4');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [effort, setEffort] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const now = new Date();
  const dueIs = (days: number) => dueDate !== undefined && isSameDay(dueDate, addDays(now, days));
  const open = capture !== undefined;

  // The sheet closes ITSELF after a promote, so an inbox-zero celebration earned here is held by the
  // centre until it has gone (`CelebrationSurface.promoteSheet`). If the `<dialog>` is still open at
  // the instant this cleanup runs, the centre's hold watch releases the burst once it has closed.
  useEffect(() => {
    if (!open) return;
    celebrations.surfacePresented('promoteSheet');
    return () => celebrations.surfaceDismissed('promoteSheet');
  }, [open]);

  async function promote() {
    if (!capture || busy) return;
    setBusy(true);
    const ok = await store.getState().promoteToTask(capture, lifeAreaId, priority, dueDate, effort);
    setBusy(false);
    if (ok) {
      setPromoted(true);
      onPromoted();
    }
  }

  return (
    <Sheet open={open} title="Make a task" onClose={onClose}>
      {capture ? (
        <div className="flex flex-col gap-6">
          <div>
            <SectionLabel>New task</SectionLabel>
            <p className="mt-1 text-lg font-bold tracking-tight">{capturePrimaryText(capture)}</p>
          </div>
          <Card className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2">
                <SectionLabel>Effort</SectionLabel>
              </legend>
              <div className="flex gap-2">
                {EFFORTS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    aria-pressed={effort === seconds}
                    onClick={() => setEffort(effort === seconds ? undefined : seconds)}
                    className={chip(effort === seconds)}
                  >
                    {effortLabel(seconds)}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={effort === undefined}
                  onClick={() => setEffort(undefined)}
                  className={chip(effort === undefined)}
                >
                  Unsure
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2">
                <SectionLabel>When</SectionLabel>
              </legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={dueIs(0)}
                  onClick={() => setDueDate(addDays(now, 0))}
                  className={chip(dueIs(0))}
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-pressed={dueIs(1)}
                  onClick={() => setDueDate(addDays(now, 1))}
                  className={chip(dueIs(1))}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  aria-pressed={dueDate === undefined}
                  onClick={() => setDueDate(undefined)}
                  className={chip(dueDate === undefined)}
                >
                  Someday
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2">
                <SectionLabel>Priority</SectionLabel>
              </legend>
              <div className="flex gap-2">
                {TASK_PRIORITIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={priority === option}
                    onClick={() => setPriority(option)}
                    className={chip(priority === option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2">
                <SectionLabel>Due date</SectionLabel>
              </legend>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dueDate !== undefined}
                  onChange={(e) =>
                    setDueDate(e.target.checked ? (dueDate ?? startOfDay(now)) : undefined)
                  }
                  className="size-4"
                />
                Exact day
              </label>
              {dueDate ? (
                <div className="mt-2">
                  <label htmlFor="promote-date" className="mb-1 block text-sm text-label-secondary">
                    Date
                  </label>
                  <input
                    id="promote-date"
                    type="datetime-local"
                    className={fieldClass}
                    value={toDateTimeLocal(dueDate)}
                    onChange={(e) =>
                      setDueDate(e.target.value ? new Date(e.target.value) : undefined)
                    }
                  />
                </div>
              ) : null}
            </fieldset>
          </Card>
          {warning ? (
            <p role="status" className="text-sm text-state-warn">
              ⚠️ {warning}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-state-risk">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || promoted}
            onClick={() => void promote()}
            className={primaryButtonClass}
          >
            {busy ? 'Creating Task…' : 'Create Task'}
          </button>
          <p className="text-center text-xs text-label-secondary">
            The new task inherits this capture's life area, tags and notes.
          </p>
        </div>
      ) : null}
    </Sheet>
  );
}
