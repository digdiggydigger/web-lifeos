import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useStore } from 'zustand';

import { AREA_DETAIL_FILTERS, areaDetailFilterTitle, ringLine } from '@/domain/lifeAreas';
import type { AreaDetailFilter } from '@/domain/lifeAreas';
import { areaRate, closedThisWeek } from '@/domain/momentum/momentumScoreboard';
import { formatWeekdayDayMonth } from '@/domain/time/calendar';
import type { Task } from '@/domain/types';
import { TaskCreateDialog } from '@/features/tasks/TaskCreateDialog';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useTaskClients } from '@/features/tasks/useTaskClients';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { CaptureRowSummary } from '@/features/captures/CaptureBits';
import { Card } from '@/shared/Card';
import { chipClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { SectionLabel } from '@/shared/SectionLabel';

import { areaClasses } from './AreaWash';
import { createLifeAreaDetailStore } from './lifeAreaDetailStore';
import { useAreaClients } from './useAreaClients';
import { useLifeAreas } from './useLifeAreas';
import type { Point } from '@/domain/celebrations';
import { celebrations } from '@/features/celebrations/appCelebrations';

/** `LifeAreaDetailView`: wash header, Tasks / Journal / Captures / All chips, the ring line, and "Add to {area}". */
export function LifeAreaDetailPage() {
  const { id = '' } = useParams();
  const client = useAreaClients();
  const taskClients = useTaskClients();
  const areasState = useLifeAreas();
  const store = useMemo(() => createLifeAreaDetailStore(client, id), [client, id]);
  const state = useStore(store, (s) => s.state);
  const allTasks = useStore(store, (s) => s.allTasks);
  const filtered = useStore(store, (s) => s.filteredTasks);
  const logs = useStore(store, (s) => s.logs);
  const captures = useStore(store, (s) => s.captures);
  const mutationError = useStore(store, (s) => s.mutationErrorMessage);
  const [filter, setFilter] = useState<AreaDetailFilter>('tasks');
  const [creating, setCreating] = useState(false);
  const now = new Date();

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  const area = areasState.kind === 'ready' ? areasState.areas.find((a) => a.id === id) : undefined;
  const openCount = allTasks.filter((t) => t.status === 'open').length;
  const closedCount = closedThisWeek(allTasks, now).length;
  const counts: Record<AreaDetailFilter, number> = {
    tasks: openCount,
    journal: logs.length,
    captures: captures.length,
    all: openCount + logs.length + captures.length,
  };

  function close(task: Task, origin: Point | null) {
    recentActionStore.getState().record({
      kind: 'taskClosed',
      subject: task.title,
      undo: () => store.getState().reopenTask(task),
    });
    void store.getState().closeTask(task);
    // E's F6: the in-place pop from the control that closed it, at the tap as on iOS.
    celebrations.request({ kind: 'pop' }, origin);
  }

  if (areasState.kind === 'ready' && !area) {
    return (
      <EmptyState
        title="That area isn't here"
        body="It may have been archived or removed on another device."
        action={
          <Link to="/areas" className="min-h-11 font-semibold text-accent">
            Back to Areas
          </Link>
        }
      />
    );
  }

  const c = area ? areaClasses(area) : undefined;
  const showTasks = filter === 'tasks' || filter === 'all';
  const showJournal = filter === 'journal' || filter === 'all';
  const showCaptures = filter === 'captures' || filter === 'all';

  return (
    <>
      <header
        className={`mb-6 flex overflow-hidden rounded-card border border-card-border ${c?.tint ?? 'bg-card-surface'}`}
      >
        <span aria-hidden="true" className={`w-2 shrink-0 ${c?.rail ?? ''}`} />
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-xs">
              <Link to="/areas" className="text-accent">
                Areas
              </Link>
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
              <span aria-hidden="true">{area?.colour ?? ''}</span>
              <span className="truncate">{area?.name ?? 'Area'}</span>
            </h1>
            <p className="mt-1 text-sm text-label-secondary">
              {ringLine(areaRate(closedCount, openCount), area?.name ?? 'this area')}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Add to ${area?.name ?? 'area'}`}
            onClick={() => setCreating(true)}
            className="spring flex size-11 shrink-0 items-center justify-center rounded-card bg-accent text-on-area-work"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        </div>
      </header>

      <div role="group" aria-label="Show" className="mb-6 flex flex-wrap gap-2">
        {AREA_DETAIL_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={chipClass}
          >
            {areaDetailFilterTitle(option, counts[option])}
          </button>
        ))}
      </div>

      {mutationError ? (
        <p role="alert" className="mb-4 text-sm text-state-risk">
          Couldn't update the task. {mutationError}
        </p>
      ) : null}
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load this area" body={state.message} />
      ) : null}

      {state.kind === 'loaded' && showTasks ? (
        <section aria-label="Tasks" className="mb-6">
          <SectionLabel className="mb-2">Tasks</SectionLabel>
          {filtered.length === 0 ? (
            <Card>
              <p className="text-sm text-label-secondary">Nothing open here.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-card-border">
                {filtered.map((task) => (
                  <TaskRow key={task.id} task={task} lifeArea={area} now={now} onClose={close} />
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
      {state.kind === 'loaded' && showJournal ? (
        <section aria-label="Journal" className="mb-6">
          <SectionLabel className="mb-2">Journal</SectionLabel>
          {logs.length === 0 ? (
            <Card>
              <p className="text-sm text-label-secondary">No journal entries filed here yet.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-card-border">
                {logs.map((log) => (
                  <li key={log.id} className="px-4 py-2">
                    <p className="text-xs text-label-tertiary">
                      {formatWeekdayDayMonth(log.entryDate)}
                    </p>
                    <p className="line-clamp-3 text-sm whitespace-pre-line">{log.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
      {state.kind === 'loaded' && showCaptures ? (
        <section aria-label="Captures" className="mb-6">
          <SectionLabel className="mb-2">Captures</SectionLabel>
          {captures.length === 0 ? (
            <Card>
              <p className="text-sm text-label-secondary">No captures filed here.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-card-border">
                {captures.map((capture) => (
                  <li key={capture.id}>
                    <Link
                      to={`/captures/${capture.id}`}
                      className="flex min-h-14 items-center px-4 py-2"
                    >
                      <CaptureRowSummary
                        capture={capture}
                        lifeAreas={area ? [area] : []}
                        allTags={[]}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}

      <TaskCreateDialog
        open={creating}
        client={taskClients}
        lifeAreas={areasState.kind === 'ready' ? areasState.areas : []}
        {...(area ? { initialLifeAreaId: area.id } : {})}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void store.getState().load();
        }}
      />
    </>
  );
}
