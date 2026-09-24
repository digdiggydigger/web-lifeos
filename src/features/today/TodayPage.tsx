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
import { hasCelebratedToday, markCelebratedToday } from '@/domain/celebrations';
import type { Point } from '@/domain/celebrations';
import { planForTask } from '@/domain/focus';
import { startOfDay } from '@/domain/time/calendar';
import type { Task } from '@/domain/types';
import { celebrations, centreOf } from '@/features/celebrations/appCelebrations';
import { FocusAnalyticsSection } from '@/features/focus/FocusAnalyticsSection';
import { useFocusStore } from '@/features/focus/useFocusStore';
import { nudgesOf } from '@/features/nudges/nudgesStore';
import { useNudgesStore, useUid } from '@/features/nudges/useNudgesStore';
import { preferencesStore } from '@/features/settings/preferencesStore';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { EmptyState } from '@/shared/EmptyState';

import { BestNextMoveCard } from './BestNextMoveCard';
import { activeAreas } from './homeStore';
import { LifeAreasSection } from './LifeAreasSection';
import { MomentumRingCard } from './MomentumRingCard';
import { NudgesSection } from './NudgesSection';
import {
  ClosedTodayCard,
  DueNowSection,
  InboxPeekCard,
  WeekBarStrip,
  WeekReviewRow,
} from './TodayCards';
import { useHomeStore } from './useHomeStore';

function localStorageOrNothing(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

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
  const nudgesStore = useNudgesStore();
  const nudgesState = useStore(nudgesStore, (s) => s.state);
  const nudges = nudgesOf({ state: nudgesState });
  const focusSessions = useStore(store, (s) => s.focusSessions);
  const closingTaskId = useStore(store, (s) => s.closingTaskId);
  const mutationError = useStore(store, (s) => s.mutationErrorMessage);
  const reorderError = useStore(store, (s) => s.reorderErrorMessage);
  const prefs = useStore(preferencesStore, (s) => s.preferences);
  const focus = useFocusStore();
  const activeSprint = useStore(focus, (s) => s.session);
  const completedSprintCount = useStore(focus, (s) => s.completedSprintCount);
  const seenSprintCount = useRef(completedSprintCount);
  const tracker = useRef(createDailyGoalTracker());
  const [announcement, setAnnouncement] = useState('');
  const uid = useUid();
  const now = new Date();

  const active = activeAreas(lifeAreas);
  const areaById = new Map(active.map((a) => [a.id, a]));
  const closedTodayTasks = closedToday(allTasks, now);
  const ringCount =
    closedTodayTasks.length +
    (prefs.countClearedCaptures ? inboxHandledToday : 0) +
    (prefs.countNudges ? dismissedToday(nudges, now) : 0);
  const settled =
    state.kind === 'loaded' && nudgesState.kind === 'loaded' && hasLoadedClearedCaptures;
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
    // `HomeView+DailyGoal.observeDailyGoal`: once per day per account (F7), the day marked BEFORE
    // the request so an undo-and-recross never replays it. No uid, nothing to key on: nothing fires.
    if (
      !crossed ||
      uid === '' ||
      hasCelebratedToday('dailyGoal', uid, new Date(), localStorageOrNothing())
    )
      return;
    markCelebratedToday('dailyGoal', uid, new Date(), localStorageOrNothing());
    celebrations.request(
      { kind: 'milestone', milestone: 'dailyGoal' },
      centreOf(document.querySelector('[data-momentum-ring]')),
    );
    // The one milestone that announces itself; posted after the request, as on iOS.
    setAnnouncement(dailyGoalAnnouncement(ringCount, prefs.dailyGoal));
  }, [ringCount, settled, prefs.dailyGoal, prefs.countClearedCaptures, prefs.countNudges, uid]);

  // Every finished sprint refetches the history the charts and the logged-today chip read.
  useEffect(() => {
    if (seenSprintCount.current === completedSprintCount) return;
    seenSprintCount.current = completedSprintCount;
    void store.getState().load();
  }, [completedSprintCount, store]);

  async function closeTask(task: Task, origin: Point | null): Promise<void> {
    // E's F6: the pop leaves from the pressed control at the tap, as on iOS, so it always precedes
    // the daily-goal milestone the same close may cross.
    celebrations.request({ kind: 'pop' }, origin);
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
                onClose={(origin) => void closeTask(headline, origin)}
                showsStartSession={activeSprint === undefined}
                onStartSession={() =>
                  focus
                    .getState()
                    .startPlan(
                      planForTask(
                        headline,
                        headline.lifeAreaId ? areaById.get(headline.lifeAreaId) : undefined,
                        prefs.defaultSprintMinutes * 60,
                      ),
                    )
                }
              />
            ) : null}
            <LifeAreasSection
              items={areaMomentum(active, openTasks, allTasks, now)}
              now={now}
              onMove={(id, direction) => void store.getState().moveActiveArea(id, direction)}
            />
            <DueNowSection tasks={dueNow} areaById={areaById} />
            <NudgesSection now={now} />
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
            <FocusAnalyticsSection
              sessions={focusSessions}
              dailyGoalMinutes={prefs.focusDailyGoalMinutes}
              now={now}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
