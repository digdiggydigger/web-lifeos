import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  dueChoiceFor,
  effortChoiceTitle,
  resolvedDueDate,
  STANDARD_EFFORT_CHOICE,
  TASK_DUE_CHOICES,
  TASK_EFFORT_CHOICES,
  taskDueChoiceTitle,
} from '@/domain/tasks';
import type { TaskDueChoice, TaskEffortChoice } from '@/domain/tasks';
import type { LifeArea, Task } from '@/domain/types';
import { SectionLabel } from '@/shared/SectionLabel';

import { createTaskFlow, isTitleValid, offeredAreas } from './taskCreateService';
import type { TaskCreateClient } from './tasksClient';

interface TaskCreateDialogProps {
  readonly open: boolean;
  readonly client: TaskCreateClient;
  readonly lifeAreas: readonly LifeArea[];
  readonly initialLifeAreaId?: string;
  readonly onClose: () => void;
  readonly onCreated: (task: Task, warning: string | undefined) => void;
}

export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const fieldClass =
  'min-h-11 w-full rounded-card border border-card-border bg-card-surface-secondary px-4 py-2 text-base';
const chipClass =
  'spring min-h-11 rounded-card border border-card-border px-4 text-sm font-medium text-label-secondary aria-pressed:border-accent aria-pressed:bg-card-surface-secondary aria-pressed:text-label-primary';

/** `TaskCreateView`: "New task". A native dialog, bottom-sheet on phones, centred on desktop. */
export function TaskCreateDialog({
  open,
  client,
  lifeAreas,
  initialLifeAreaId,
  onClose,
  onCreated,
}: TaskCreateDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), due: useId(), area: useId(), time: useId() };
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [lifeAreaId, setLifeAreaId] = useState<string | undefined>(initialLifeAreaId);
  const [effort, setEffort] = useState<TaskEffortChoice>(STANDARD_EFFORT_CHOICE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const now = new Date();
  const dueChoice = dueChoiceFor(dueDate, now);
  const areas = offeredAreas(lifeAreas, lifeAreaId);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setTitle('');
      setDueDate(undefined);
      setLifeAreaId(initialLifeAreaId);
      setEffort(STANDARD_EFFORT_CHOICE);
      setError(undefined);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, initialLifeAreaId]);

  function choose(choice: TaskDueChoice) {
    setDueDate(resolvedDueDate(choice, dueDate, new Date()));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isTitleValid(title) || submitting) return;
    setSubmitting(true);
    setError(undefined);
    const outcome = await createTaskFlow(client, {
      title,
      effort,
      ...(lifeAreaId ? { lifeAreaId } : {}),
      ...(dueDate ? { dueDate } : {}),
    });
    setSubmitting(false);
    if (outcome.ok) onCreated(outcome.task, outcome.warning);
    else setError(outcome.error);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="new-task-title"
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 m-0 w-full max-w-none rounded-t-card bg-card-surface p-0 text-label-primary backdrop:bg-scrim md:inset-0 md:m-auto md:max-w-md md:rounded-card"
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-sm font-medium text-accent"
          >
            Close
          </button>
          <h2 id="new-task-title" className="text-base font-bold">
            New task
          </h2>
          <span aria-hidden="true" className="w-11" />
        </div>
        <p className="text-sm text-label-secondary">
          One clear next action — every detail below is optional.
        </p>
        <div>
          <label htmlFor={ids.title} className="sr-only">
            Title
          </label>
          <input
            id={ids.title}
            className={fieldClass}
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="mb-2">
            <SectionLabel>When is it due?</SectionLabel>
          </legend>
          <div className="flex flex-wrap gap-2">
            {TASK_DUE_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={dueChoice === choice}
                onClick={() => choose(choice)}
                className={chipClass}
              >
                {taskDueChoiceTitle(choice)}
              </button>
            ))}
          </div>
          {dueChoice === 'custom' && dueDate ? (
            <div className="mt-2">
              <label htmlFor={ids.due} className="mb-1 block text-sm text-label-secondary">
                Due
              </label>
              <input
                id={ids.due}
                type="datetime-local"
                className={fieldClass}
                value={toDateTimeLocal(dueDate)}
                onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>
          ) : null}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">
            <SectionLabel>Area and time</SectionLabel>
          </legend>
          {areas.length > 0 ? (
            <div>
              <label htmlFor={ids.area} className="mb-1 block text-sm text-label-secondary">
                Area
              </label>
              <select
                id={ids.area}
                className={fieldClass}
                value={lifeAreaId ?? ''}
                onChange={(e) => setLifeAreaId(e.target.value || undefined)}
              >
                <option value="">None</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.colour} {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor={ids.time} className="mb-1 block text-sm text-label-secondary">
              Time
            </label>
            <select
              id={ids.time}
              className={fieldClass}
              value={effort}
              onChange={(e) => setEffort(e.target.value as TaskEffortChoice)}
            >
              {TASK_EFFORT_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {effortChoiceTitle(c)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm font-medium text-state-risk">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-label-tertiary">
          Lands in your list — nothing else happens until you decide it does.
        </p>
        <button
          type="submit"
          disabled={!isTitleValid(title) || submitting}
          className="spring min-h-11 rounded-card bg-accent px-4 text-base font-semibold text-on-area-work disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add the task'}
        </button>
      </form>
    </dialog>
  );
}
