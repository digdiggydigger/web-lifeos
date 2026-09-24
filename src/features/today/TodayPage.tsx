/** `HomeView` (Today): the scoreboard and everything under it, in the phone's order. */
import { Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  areaMomentum,
  bestNextMove,
  bestStreak,
  buildWeekReview,
  closedCaption,
  closedPerDay,
  closedToday,
  createDailyGoalTracker,
  dailyGoalAnnouncement,
  dismissedToday,
  effortLabel,
  focusLoggedTodayLabel,
  streak,
  trailingWeekClosureFlags,
} from '@/domain/momentum';
import { startOfDay } from '@/domain/time/calendar';
import type { Task } from '@/domain/types';
import { preferencesStore } from '@/features/settings/preferencesStore';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { EmptyState } from '@/shared/EmptyState';

import { BestNextMoveCard } from './BestNextMoveCard';
import { activeAreas } from './homeStore';
import { LifeAreasSection } from './LifeAreasSection';
import { MomentumRingCard } from './MomentumRingCard';
import {
  ClosedTodayCard,
  DueNowSection,
  InboxPeekCard,
  WeekBarStrip,
  WeekReviewRow,
} from './TodayCards';
import { useHomeStore } from './useHomeStore';

function Notice({
  title,
  message,
  onDismiss,
}: {
  readonly title: string;
  readonly message: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-card border border-card-border bg-card-surface p-4 shadow-card"
    >
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-label-secondary"> · {message}</span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-11 px-4 text-sm font-semibold text-accent"
      >
        OK
      </button>
    </div>
  );
}

export function TodayPage() {
  const store = useHomeStore();
  const state = useStore(store, (s) => s.state);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const openTasks = useStore(store, (s) => s.openTasks);
  const allTasks = useStore(store, (s) => s.allTasks);
  const inbox = useStore(store, (s) => s.inbox);
  const inboxHandledToday = useStore(store, (s) => s.inboxHandledToday);
  const hasLoadedClearedCaptures = useStore(store, (s) => s.hasLoadedClearedCaptures);
  const nudges = useStore(store, (s) => s.nudges);
  const nudgesState = useStore(store, (s) => s.nudgesState);
  const focusSessions = useStore(store, (s) => s.focusSessions);
  const closingTaskId = useStore(store, (s) => s.closingTaskId);
  const mutationError = useStore(store, (s) => s.mutationErrorMessage);
  const reorderError = useStore(store, (s) => s.reorderErrorMessage);
  const prefs = useStore(preferencesStore, (s) => s.preferences);
  const tracker = useRef(createDailyGoalTracker());
  const [announcement, setAnnouncement] = useState('');
  const now = new Date();

  const active = activeAreas(lifeAreas);
  const areaById = new Map(active.map((a) => [a.id, a]));
  const closedTodayTasks = closedToday(allTasks, now);
  const ringCount =
    closedTodayTasks.length +
    (prefs.countClearedCaptures ? inboxHandledToday : 0) +
    (prefs.countNudges ? dismissedToday(nudges, now) : 0);
  const settled = state.kind === 'loaded' && nudgesState === 'loaded' && hasLoadedClearedCaptures;
  const headline = bestNextMove(openTasks, now);
  const today = startOfDay(now).getTime();
  const dueNow = openTasks.filter(
    (t) =>
      t.id !== headline?.id && t.dueDate !== undefined && startOfDay(t.dueDate).getTime() <= today,
  );
  const dayCounts = closedPerDay(allTasks, now);
  const review = buildWeekReview({
    tasks: allTasks,
    lifeAreas,
    sessions: focusSessions,
    inboxCount: inbox.length,
    now,
  });

  useEffect(() => {
    const crossed = tracker.current.observe(
      ringCount,
      {
        goal: prefs.dailyGoal,
        countsClearedCaptures: prefs.countClearedCaptures,
        countsNudges: prefs.countNudges,
      },
      settled,
    );
    if (crossed) setAnnouncement(dailyGoalAnnouncement(ringCount, prefs.dailyGoal));
  }, [ringCount, settled, prefs.dailyGoal, prefs.countClearedCaptures, prefs.countNudges]);

  async function closeTask(task: Task): Promise<void> {
    if (!(await store.getState().close(task))) return;
    recentActionStore.getState().record({
      kind: 'taskClosed',
      subject: task.title,
      undo: () => store.getState().reopen(task),
    });
  }

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-label-secondary uppercase">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="spring flex size-11 items-center justify-center rounded-full border border-card-border bg-card-surface text-label-secondary md:hidden"
        >
          <Settings aria-hidden="true" className="size-6" />
        </Link>
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-col gap-4">
        {mutationError ? (
          <Notice
            title="Couldn't update the task"
            message={mutationError}
            onDismiss={() => store.getState().clearMutationError()}
          />
        ) : null}
        {reorderError ? (
          <Notice
            title="Couldn't save the new order"
            message={reorderError}
            onDismiss={() => store.getState().clearReorderError()}
          />
        ) : null}
        {state.kind === 'loading' ? (
          <p role="status" className="text-sm text-label-secondary">
            Loading…
          </p>
        ) : null}
        {state.kind === 'failed' ? (
          <EmptyState title="Couldn't load your life areas" body={state.message} />
        ) : null}
        {state.kind === 'loaded' ? (
          <>
            <MomentumRingCard
              closedToday={ringCount}
              goal={prefs.dailyGoal}
              streak={prefs.showStreaks ? streak(allTasks, now) : 0}
              bestStreak={prefs.showStreaks ? bestStreak(allTasks) : 0}
              openCount={openTasks.length}
              weekFlags={trailingWeekClosureFlags(allTasks, now)}
              nextEffortLabel={effortLabel(headline?.focusDurationSeconds)}
            />
            {headline ? (
              <BestNextMoveCard
                task={headline}
                lifeArea={headline.lifeAreaId ? areaById.get(headline.lifeAreaId) : undefined}
                isDueNow={
                  headline.dueDate !== undefined && startOfDay(headline.dueDate).getTime() <= today
                }
                isClosing={closingTaskId === headline.id}
                loggedTodayLabel={focusLoggedTodayLabel(focusSessions, headline.id, now)}
                onClose={() => void closeTask(headline)}
              />
            ) : null}
            <LifeAreasSection
              items={areaMomentum(active, openTasks, allTasks, now)}
              now={now}
              onMove={(id, direction) => void store.getState().moveActiveArea(id, direction)}
            />
            <DueNowSection tasks={dueNow} areaById={areaById} />
            <InboxPeekCard inbox={inbox} handledToday={inboxHandledToday} now={now} />
            <ClosedTodayCard tasks={closedTodayTasks} />
            {prefs.showCharts ? (
              <WeekBarStrip
                counts={dayCounts}
                labels={review.dayLabels}
                caption={closedCaption(focusSessions, now)}
              />
            ) : null}
            <WeekReviewRow headline={review.headline} />
          </>
        ) : null}
      </div>
    </>
  );
}
