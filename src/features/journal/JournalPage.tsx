import { Check, ChevronDown, ChevronRight, Inbox, PenSquare, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { capturePrimaryText } from '@/domain/captures';
import {
  dayCollapsedLine,
  dayHeaderLine,
  entryId,
  JOURNAL_EMPTY_COPY,
  sprintLine,
  tagsForLog,
  TIMELINE_FILTERS,
  timelineDays,
  timelineFilterTitle,
  timelineHeaderLine,
} from '@/domain/journal';
import type { TimelineDay, TimelineEntry, TimelineFilter } from '@/domain/journal';
import { formatShortTime } from '@/domain/time/calendar';
import { useCaptureStores } from '@/features/captures/useCaptureStores';
import type { Log } from '@/domain/types';
import { Card } from '@/shared/Card';
import { chipClass, fieldClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

import { EnergyMoodBadge } from './EnergyMoodPicker';
import { LogComposerDialog } from './LogComposerDialog';
import { useJournalStore } from './useJournalStore';

/** `JournalView`: the header line, the filter chips, the day-grouped timeline, and the pencil door. */
export function JournalPage() {
  const store = useJournalStore();
  const { client: captureClient } = useCaptureStores();
  const navigate = useNavigate();
  const state = useStore(store, (s) => s.state);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const tasks = useStore(store, (s) => s.tasks);
  const sprints = useStore(store, (s) => s.focusSessions);
  const captures = useStore(store, (s) => s.captures);
  const allTags = useStore(store, (s) => s.availableTags);
  const selectedLifeAreaId = useStore(store, (s) => s.selectedLifeAreaId);
  const [filter, setFilter] = useState<TimelineFilter>('everything');
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());
  const [composing, setComposing] = useState(false);
  const now = new Date();
  const logs = state.kind === 'loaded' ? state.logs : [];
  const areaById = new Map(lifeAreas.map((a) => [a.id, a]));
  const selectedArea = selectedLifeAreaId ? areaById.get(selectedLifeAreaId) : undefined;
  const filteredTasks = selectedLifeAreaId
    ? tasks.filter((t) => t.lifeAreaId === selectedLifeAreaId)
    : tasks;
  const filteredSprints = selectedArea
    ? sprints.filter((s) => s.lifeAreaEmoji === selectedArea.colour)
    : sprints;
  const days =
    state.kind === 'loaded'
      ? timelineDays({
          logs,
          tasks: filteredTasks,
          sprints: filteredSprints,
          captures,
          filter,
          lifeAreaId: selectedLifeAreaId,
          now,
        })
      : [];

  function toggleDay(day: TimelineDay) {
    const key = day.date.getTime();
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  }

  function areaEmoji(id: string | undefined): string {
    const area = id ? areaById.get(id) : undefined;
    return area ? ` · ${area.colour}` : '';
  }

  function logKindLine(log: Log): string {
    const area = log.lifeAreaId ? areaById.get(log.lifeAreaId) : undefined;
    const kind = log.type === 'journal' ? 'Journal' : 'Log';
    return area && !area.archived ? `${kind} · ${area.colour} ${area.name}` : kind;
  }

  function row(entry: TimelineEntry) {
    const time = (date: Date) => (
      <span className="w-14 shrink-0 text-xs text-label-secondary tabular-nums">
        {formatShortTime(date)}
      </span>
    );
    switch (entry.kind) {
      case 'log': {
        const tags = tagsForLog(entry.log, allTags);
        return (
          <li key={entryId(entry)} className="flex gap-2">
            <span className="pt-4">{time(entry.log.entryDate)}</span>
            <Card className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-xs text-label-secondary">{logKindLine(entry.log)}</p>
              <EnergyMoodBadge
                energyLevel={entry.log.energyLevel}
                moodEmoji={entry.log.moodEmoji}
              />
              <p className="text-sm whitespace-pre-line">{entry.log.body}</p>
              {tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {tags.map((tag) => (
                    <li
                      key={tag.id}
                      className="rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-semibold text-label-secondary"
                    >
                      {tag.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        );
      }
      case 'closedTask':
        return (
          <li key={entryId(entry)}>
            <Link
              to={`/tasks/${entry.task.id}`}
              aria-label={`${entry.task.title}, closed. Opens this task`}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              {time(entry.task.completedAt ?? now)}
              <Check aria-hidden="true" className="size-4 shrink-0 text-state-go-vivid" />
              <span className="line-clamp-2 min-w-0">{entry.task.title}</span>
              <span className="shrink-0 text-label-secondary">
                task{areaEmoji(entry.task.lifeAreaId)}
              </span>
            </Link>
          </li>
        );
      case 'focusSprint': {
        const inner = (
          <>
            {time(entry.sprint.endedAt)}
            <Timer aria-hidden="true" className="size-4 shrink-0 text-accent" />
            <span className="line-clamp-2 min-w-0">{entry.sprint.taskTitle}</span>
            <span className="shrink-0 text-label-secondary">
              {sprintLine(entry.sprint)} · {entry.sprint.lifeAreaEmoji}
            </span>
          </>
        );
        return (
          <li key={entryId(entry)}>
            {entry.sprint.taskId ? (
              <Link
                to={`/tasks/${entry.sprint.taskId}`}
                aria-label={`${entry.sprint.taskTitle}, ${sprintLine(entry.sprint)}. Opens the task this sprint ran on`}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                {inner}
              </Link>
            ) : (
              <p className="flex min-h-11 items-center gap-2 text-sm">{inner}</p>
            )}
          </li>
        );
      }
      case 'capture':
        return (
          <li key={entryId(entry)} className="flex min-h-11 items-center gap-2 text-sm">
            {time(entry.capture.createdAt)}
            <Inbox aria-hidden="true" className="size-4 shrink-0 text-capture-deep" />
            <span className="line-clamp-2 min-w-0">{capturePrimaryText(entry.capture)}</span>
            <span className="shrink-0 text-label-secondary">
              captured{areaEmoji(entry.capture.lifeAreaId)}
            </span>
          </li>
        );
    }
  }

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle={
          state.kind === 'loaded' ? timelineHeaderLine({ logs, tasks, sprints, now }) : undefined
        }
        trailing={
          <button
            type="button"
            aria-label="Write an entry"
            onClick={() => setComposing(true)}
            className="spring flex size-11 items-center justify-center rounded-full bg-journal-paper text-on-area-work shadow-card"
          >
            <PenSquare aria-hidden="true" className="size-6" />
          </button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {TIMELINE_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={chipClass}
            >
              {timelineFilterTitle(option)}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="journal-area" className="sr-only">
            Life Area
          </label>
          <select
            id="journal-area"
            className={`${fieldClass} w-auto`}
            value={selectedLifeAreaId ?? ''}
            onChange={(e) => store.getState().setSelectedLifeAreaId(e.target.value || undefined)}
          >
            <option value="">All areas</option>
            {lifeAreas
              .filter((a) => !a.archived)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.colour} {a.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your journal" body={state.message} />
      ) : null}
      {state.kind === 'loaded' && days.length === 0 ? (
        <p role="status" className="py-6 text-center text-sm text-label-secondary">
          {JOURNAL_EMPTY_COPY}
        </p>
      ) : null}
      {days.map((day) => {
        const key = day.date.getTime();
        const expanded = !collapsed.has(key);
        const headingId = `journal-day-${key}`;
        return (
          <section key={key} aria-labelledby={headingId} className="mb-6">
            <h2 id={headingId} className="mb-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleDay(day)}
                className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-xs font-bold tracking-widest text-label-secondary uppercase">
                  {dayHeaderLine(day)}
                </span>
                <span className="flex items-center gap-1 text-xs text-label-tertiary">
                  {expanded ? null : dayCollapsedLine(day)}
                  {expanded ? (
                    <ChevronDown aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  )}
                </span>
              </button>
            </h2>
            {expanded ? <ul className="flex flex-col gap-2">{day.entries.map(row)}</ul> : null}
          </section>
        );
      })}

      <LogComposerDialog
        open={composing}
        store={store}
        onClose={() => setComposing(false)}
        onCreated={() => setComposing(false)}
        captureClient={captureClient}
        onOpenCapture={(id) => void navigate(`/captures/${id}`)}
      />
    </>
  );
}
