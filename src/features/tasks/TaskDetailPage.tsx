import { Play } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import {
  focusSprintPlan,
  resolvedDuration,
  resolvedNudgeCount,
  sprintPlanSummary,
} from '@/domain/focus';
import {
  buildMomentumContext,
  closeButtonLabel,
  duePhrase,
  editedFieldsFrom,
  shouldAutosave,
  taskDetailDirtyState,
} from '@/domain/tasks';
import type { TaskEditedFields } from '@/domain/tasks';
import { formatAbbreviatedDate } from '@/domain/time/calendar';
import { TASK_PRIORITIES } from '@/domain/types';
import type { LifeArea, Task, TaskPriority } from '@/domain/types';
import { useFocusStore } from '@/features/focus/useFocusStore';
import { preferencesStore } from '@/features/settings/preferencesStore';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { Card } from '@/shared/Card';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

import { toDateTimeLocal } from './TaskCreateDialog';
import { createTaskDetailStore } from './taskDetailStore';
import { useTaskClients } from './useTaskClients';

const fieldClass =
  'min-h-11 w-full rounded-card border border-card-border bg-card-surface-secondary px-4 py-2 text-base';

function without<K extends keyof TaskEditedFields>(
  fields: TaskEditedFields,
  key: K,
): TaskEditedFields {
  const copy: Record<string, unknown> = { ...fields };
  delete copy[key];
  return copy as unknown as TaskEditedFields;
}

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useTaskClients();
  const store = useMemo(() => createTaskDetailStore(client, id), [client, id]);
  const state = useStore(store, (s) => s.state);
  const tags = useStore(store, (s) => s.tags);
  const allTags = useStore(store, (s) => s.allTags);
  const isSaving = useStore(store, (s) => s.isSaving);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const warningMessage = useStore(store, (s) => s.warningMessage);
  const defaultSprintSeconds = useStore(store, (s) => s.defaultSprintSeconds);
  const showStreaks = useStore(preferencesStore, (s) => s.preferences.showStreaks);
  const focus = useFocusStore();

  const [edited, setEdited] = useState<TaskEditedFields | undefined>(undefined);
  const [context, setContext] = useState<{ tasks: Task[]; lifeAreas: LifeArea[] }>({
    tasks: [],
    lifeAreas: [],
  });
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [saved, setSaved] = useState(false);
  const ids = {
    title: useId(),
    dueToggle: useId(),
    due: useId(),
    notes: useId(),
    area: useId(),
    priority: useId(),
    sprint: useId(),
    nudges: useId(),
    tag: useId(),
  };
  const latest = useRef<{ edited?: TaskEditedFields; task?: Task }>({});

  useEffect(() => {
    void store.getState().load();
    void Promise.all([client.fetchAllTasks(), client.fetchLifeAreas()]).then(([tasks, lifeAreas]) =>
      setContext({ tasks, lifeAreas }),
    );
  }, [store, client]);

  const task = state.kind === 'loaded' ? state.task : undefined;
  useEffect(() => {
    if (task && !edited) {
      const duration = resolvedDuration(task.focusDurationSeconds, defaultSprintSeconds);
      setEdited({
        ...editedFieldsFrom(task),
        focusDurationSeconds: duration,
        nudgesCount: resolvedNudgeCount(task.nudgesCount, duration),
      });
    }
  }, [task, edited, defaultSprintSeconds]);
  latest.current = { ...(edited ? { edited } : {}), ...(task ? { task } : {}) };

  // Autosave on the way out: exactly the Save button's own condition, no discard dialog.
  useEffect(() => {
    return () => {
      const { edited: fields, task: original } = latest.current;
      if (!fields || !original) return;
      const dirty = taskDetailDirtyState(original, fields, store.getState().defaultSprintSeconds);
      if (shouldAutosave(dirty.hasUnsavedChanges, fields.title, store.getState().isSaving))
        void store.getState().save(fields);
    };
  }, [store]);

  if (state.kind === 'loading' || !task || !edited) {
    return (
      <>
        <PageHeader title="Task" />
        {state.kind === 'failed' ? (
          <EmptyState title="Couldn't load this task" body={state.message} />
        ) : (
          <p role="status" className="text-sm text-label-secondary">
            Loading…
          </p>
        )}
      </>
    );
  }

  const dirty = taskDetailDirtyState(task, edited, defaultSprintSeconds);
  const canSave = shouldAutosave(dirty.hasUnsavedChanges, edited.title, isSaving);
  const now = new Date();
  const momentum = buildMomentumContext({
    lifeAreaId: task.lifeAreaId,
    tasks: context.tasks,
    lifeAreas: context.lifeAreas,
    showStreaks: showStreaks,
    now,
  });
  const area = context.lifeAreas.find((a) => a.id === edited.lifeAreaId);
  const attached = new Set(tags.map((t) => t.id));
  const update = (patch: Partial<TaskEditedFields>) =>
    setEdited((e) => (e ? { ...e, ...patch } : e));

  const planDuration = edited.focusDurationSeconds ?? defaultSprintSeconds;
  const plan = focusSprintPlan({
    taskId: task.id,
    taskTitle: edited.title.trim(),
    lifeAreaEmoji: area?.colour,
    durationSeconds: planDuration,
    nudgeCount: edited.nudgesCount ?? resolvedNudgeCount(undefined, planDuration),
  });
  const planSummary = sprintPlanSummary(plan.durationSeconds, plan.nudgeCount);

  /** `TaskDetailView.startFocusSprint`: unsaved edits land first, then the sprint starts and the detail dismisses. */
  async function startFocusSprint() {
    if (dirty.hasUnsavedChanges && !(await store.getState().save(edited!))) return;
    latest.current = {};
    focus.getState().startPlan(plan);
    void navigate('/tasks');
  }

  async function save() {
    if (await store.getState().save(edited!)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }
  function closeTask() {
    recentActionStore
      .getState()
      .record({ kind: 'taskClosed', subject: task!.title, undo: () => store.getState().reopen() });
    void store.getState().close();
  }
  async function deleteTask() {
    if (!(await store.getState().softDelete())) return;
    const taskId = task!.id;
    recentActionStore.getState().record({
      kind: 'taskDeleted',
      subject: task!.title,
      undo: async () => {
        await client.restoreTask(taskId);
        return true;
      },
    });
    latest.current = {};
    await navigate('/tasks');
  }
  async function addTag() {
    setAddingTag(true);
    await store.getState().addTag(newTag);
    setNewTag('');
    setAddingTag(false);
  }

  return (
    <>
      <PageHeader title="Task" />
      <Card className="flex flex-col gap-4">
        <div>
          <label htmlFor={ids.title} className="mb-1 block text-sm text-label-secondary">
            Title
          </label>
          <input
            id={ids.title}
            className={fieldClass}
            value={edited.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <ul aria-label="Summary" className="flex flex-wrap gap-2 text-xs font-medium">
          {area ? (
            <li className="rounded-card bg-card-surface-secondary px-2 py-1">
              {area.colour} {area.name}
            </li>
          ) : null}
          <li
            className={`rounded-card bg-card-surface-secondary px-2 py-1 ${edited.priority === 'p1' ? 'text-state-warn' : ''}`}
          >
            {edited.priority.toUpperCase()}
          </li>
          {edited.dueDate ? (
            <li className="rounded-card bg-card-surface-secondary px-2 py-1">
              {duePhrase(edited.dueDate, now)?.toLowerCase()}
            </li>
          ) : null}
          {edited.focusDurationSeconds ? (
            <li className="rounded-card bg-card-surface-secondary px-2 py-1 text-accent">
              {Math.max(1, Math.ceil(edited.focusDurationSeconds / 60))} min
            </li>
          ) : null}
        </ul>
        {task.status === 'open' ? (
          <div>
            <button
              type="button"
              onClick={closeTask}
              className="spring min-h-11 w-full rounded-card bg-state-go px-4 text-base font-semibold text-on-state-go"
            >
              {closeButtonLabel(momentum.streak)}
            </button>
            <p className="mt-1 text-xs text-label-tertiary">
              Marking this done applies immediately — no Save needed.
            </p>
          </div>
        ) : (
          <p className="inline-flex min-h-11 items-center self-start rounded-card bg-state-go/10 px-4 text-sm font-semibold text-state-go">
            Closed
          </p>
        )}
      </Card>

      {momentum.areaLine ? (
        <section aria-label="Momentum here" className="mt-6">
          <SectionLabel className="mb-2">Momentum here</SectionLabel>
          <Card>
            <p className="text-sm">{momentum.areaLine}</p>
          </Card>
        </section>
      ) : null}

      <section aria-label="Add More Info" className="mt-6">
        <SectionLabel className="mb-2">Add More Info</SectionLabel>
        <Card className="flex flex-col gap-4">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <label htmlFor={ids.dueToggle} className="text-base">
              Due Date
            </label>
            <input
              id={ids.dueToggle}
              type="checkbox"
              className="size-6"
              checked={edited.dueDate !== undefined}
              onChange={(e) => {
                if (e.target.checked) update({ dueDate: new Date() });
                else setEdited((f) => (f ? without(f, 'dueDate') : f));
              }}
            />
          </div>
          {edited.dueDate ? (
            <div>
              <label htmlFor={ids.due} className="mb-1 block text-sm text-label-secondary">
                Date
              </label>
              <input
                id={ids.due}
                type="datetime-local"
                className={fieldClass}
                value={toDateTimeLocal(edited.dueDate)}
                onChange={(e) => e.target.value && update({ dueDate: new Date(e.target.value) })}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={ids.notes} className="mb-1 block text-sm text-label-secondary">
              Notes
            </label>
            <textarea
              id={ids.notes}
              rows={3}
              className={fieldClass}
              value={edited.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={ids.area} className="mb-1 block text-sm text-label-secondary">
              Life Area
            </label>
            <select
              id={ids.area}
              className={fieldClass}
              value={edited.lifeAreaId ?? ''}
              onChange={(e) =>
                setEdited((f) => {
                  if (!f) return f;
                  const rest = without(f, 'lifeAreaId');
                  return e.target.value ? { ...rest, lifeAreaId: e.target.value } : rest;
                })
              }
            >
              <option value="">None</option>
              {context.lifeAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.colour} {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.priority} className="mb-1 block text-sm text-label-secondary">
              Priority
            </label>
            <select
              id={ids.priority}
              className={fieldClass}
              value={edited.priority}
              onChange={(e) => update({ priority: e.target.value as TaskPriority })}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          {task.status === 'open' ? (
            <button
              type="button"
              aria-label={`Start focus sprint: ${planSummary}`}
              onClick={() => void startFocusSprint()}
              className="spring flex min-h-11 w-full items-center gap-2 rounded-card border border-card-border px-4 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold tracking-widest text-accent uppercase">
                  Launch Focus Sprint
                </span>
                <span className="block text-sm text-label-secondary">{planSummary}</span>
              </span>
              <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent px-4 text-sm font-bold text-on-area-work">
                <Play aria-hidden="true" className="size-4" />
                Start
              </span>
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={ids.sprint} className="mb-1 block text-sm text-label-secondary">
                Sprint length (min)
              </label>
              <input
                id={ids.sprint}
                type="number"
                min={1}
                max={120}
                className={fieldClass}
                value={Math.round((edited.focusDurationSeconds ?? defaultSprintSeconds) / 60)}
                onChange={(e) => update({ focusDurationSeconds: Number(e.target.value) * 60 })}
              />
            </div>
            <div>
              <label htmlFor={ids.nudges} className="mb-1 block text-sm text-label-secondary">
                In-Sprint Nudges
              </label>
              <input
                id={ids.nudges}
                type="number"
                min={0}
                max={10}
                className={fieldClass}
                value={edited.nudgesCount ?? 0}
                onChange={(e) => update({ nudgesCount: Number(e.target.value) })}
              />
            </div>
          </div>
        </Card>
      </section>

      <section aria-label="Tags" className="mt-6">
        <SectionLabel className="mb-2">Tags</SectionLabel>
        <Card className="flex flex-col gap-4">
          {allTags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    aria-pressed={attached.has(tag.id)}
                    onClick={() => void store.getState().toggleTag(tag)}
                    className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-medium aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-area-work"
                  >
                    {tag.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <label htmlFor={ids.tag} className="sr-only">
              New tag
            </label>
            <input
              id={ids.tag}
              className={fieldClass}
              placeholder="New tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />
            <button
              type="button"
              disabled={newTag.trim().length === 0 || addingTag}
              onClick={() => void addTag()}
              className="min-h-11 shrink-0 rounded-card border border-card-border px-4 text-sm font-semibold text-accent disabled:text-label-tertiary"
            >
              Add
            </button>
          </div>
        </Card>
      </section>

      {warningMessage ? (
        <p role="status" className="mt-4 text-sm text-state-warn">
          {warningMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-4 text-sm font-medium text-state-risk">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="spring min-h-11 rounded-card bg-accent px-4 text-base font-semibold text-on-area-work disabled:opacity-50"
        >
          Save
        </button>
        {saved ? (
          <p role="status" className="text-center text-sm font-medium text-state-go">
            Saved
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void deleteTask()}
          className="min-h-11 rounded-card border border-card-border px-4 text-base font-semibold text-state-risk"
        >
          Delete Task
        </button>
        {task.createdAt ? (
          <p className="text-center text-xs text-label-tertiary">
            Created {formatAbbreviatedDate(task.createdAt)}
          </p>
        ) : null}
      </div>
    </>
  );
}
