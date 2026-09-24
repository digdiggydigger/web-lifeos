import { Plus, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import {
  headerLine,
  headerTone,
  searchResultCount,
  TASK_STATUS_FILTER_OPTIONS,
  taskGroupId,
  taskStatusFilterLabel,
} from '@/domain/tasks';
import type { HeaderTone } from '@/domain/tasks';
import type { Task } from '@/domain/types';
import { planForTask } from '@/domain/focus';
import { useFocusStore } from '@/features/focus/useFocusStore';
import { preferencesStore } from '@/features/settings/preferencesStore';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { Card } from '@/shared/Card';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

import { TaskCreateDialog } from './TaskCreateDialog';
import { TaskRow } from './TaskRow';
import { createTasksStore } from './tasksStore';
import { useTaskClients } from './useTaskClients';

const toneClass: Record<HeaderTone, string> = {
  'state-warn': 'text-state-warn',
  accent: 'text-accent',
  'state-go': 'text-state-go',
};

const chipClass =
  'spring min-h-11 rounded-card border border-card-border px-4 text-sm font-medium text-label-secondary aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-area-work';

export function TasksPage() {
  const client = useTaskClients();
  const store = useMemo(() => createTasksStore(client), [client]);
  const state = useStore(store, (s) => s.state);
  const statusFilter = useStore(store, (s) => s.statusFilter);
  const searchText = useStore(store, (s) => s.searchText);
  const tasks = useStore(store, (s) => s.tasks);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const mutationError = useStore(store, (s) => s.mutationErrorMessage);
  const [creating, setCreating] = useState(false);
  const focus = useFocusStore();
  const defaultSprintMinutes = useStore(
    preferencesStore,
    (s) => s.preferences.defaultSprintMinutes,
  );
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const searchId = useId();
  const now = new Date();

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  function close(task: Task) {
    recentActionStore.getState().record({
      kind: 'taskClosed',
      subject: task.title,
      undo: () => store.getState().reopen(task),
    });
    void store.getState().close(task);
  }

  const areaById = new Map(lifeAreas.map((a) => [a.id, a]));
  const startFocus = (task: Task) =>
    focus
      .getState()
      .startPlan(
        planForTask(
          task,
          task.lifeAreaId ? areaById.get(task.lifeAreaId) : undefined,
          defaultSprintMinutes * 60,
        ),
      );
  const searching = searchText.trim().length > 0;
  const matchCount =
    state.kind === 'loaded' ? state.groups.reduce((n, g) => n + g.tasks.length, 0) : 0;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={headerLine(tasks, now)}
        trailing={
          <button
            type="button"
            aria-label="New task"
            onClick={() => setCreating(true)}
            className="spring flex size-11 items-center justify-center rounded-card bg-accent text-on-area-work"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        }
      />

      <div role="group" aria-label="Show" className="mb-4 flex flex-wrap gap-2">
        {TASK_STATUS_FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={statusFilter === option}
            onClick={() => store.getState().setStatusFilter(option)}
            className={chipClass}
          >
            {taskStatusFilterLabel(option)}
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-label-tertiary"
        />
        <label htmlFor={searchId} className="sr-only">
          Search tasks
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="Search tasks"
          value={searchText}
          onChange={(e) => store.getState().setSearchText(e.target.value)}
          className="min-h-11 w-full rounded-card border border-card-border bg-card-surface py-2 pr-12 pl-11 text-base"
        />
        {searching ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => store.getState().setSearchText('')}
            className="absolute top-0 right-0 flex size-11 items-center justify-center text-label-secondary"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="mb-4 text-sm text-state-warn">
          {notice}
        </p>
      ) : null}
      {mutationError ? (
        <div role="alert" className="mb-4 rounded-card border border-state-risk px-4 py-2 text-sm">
          <p className="font-semibold">Couldn't update the task</p>
          <p className="text-label-secondary">{mutationError}</p>
          <button
            type="button"
            onClick={() => store.getState().clearMutationError()}
            className="min-h-11 font-semibold text-accent"
          >
            OK
          </button>
        </div>
      ) : null}

      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your tasks" body={state.message} />
      ) : null}
      {state.kind === 'loaded' && searching ? (
        <p
          role="status"
          className="mb-2 text-xs font-semibold tracking-widest text-label-secondary uppercase"
        >
          {searchResultCount(matchCount)}
        </p>
      ) : null}
      {state.kind === 'loaded' && state.groups.length === 0 ? (
        <EmptyState
          title={
            searching
              ? `Nothing matches “${searchText.trim()}”`
              : statusFilter === 'momentum'
                ? 'Nothing due today or tomorrow — the rest lives under Open'
                : 'No tasks match this filter'
          }
          {...(searching ? { body: 'Try a shorter word, or part of one.' } : {})}
        />
      ) : null}
      {state.kind === 'loaded'
        ? state.groups.map((group) => {
            const tone = headerTone(group.customId);
            return (
              <section key={taskGroupId(group)} aria-label={group.lifeAreaName} className="mb-6">
                <h2
                  className={`mb-2 text-xs font-bold tracking-widest uppercase ${tone ? toneClass[tone] : 'text-label-secondary'}`}
                >
                  {group.lifeAreaName}
                </h2>
                <Card className="p-0">
                  <ul className="divide-y divide-card-border">
                    {group.tasks.map((task) => (
                      <TaskRow
                        onStartFocus={startFocus}
                        key={task.id}
                        task={task}
                        lifeArea={task.lifeAreaId ? areaById.get(task.lifeAreaId) : undefined}
                        now={now}
                        onClose={close}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })
        : null}

      <TaskCreateDialog
        open={creating}
        client={client}
        lifeAreas={lifeAreas}
        onClose={() => setCreating(false)}
        onCreated={(_task, warning) => {
          setCreating(false);
          setNotice(warning);
          void store.getState().load();
        }}
      />
    </>
  );
}
