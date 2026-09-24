/**
 * `FocusSessionService` (`Focus/FocusSessionService.swift` + Completions + Persistence): the one
 * running sprint, driven by the wall clock; the completion stack; the offline summary; collapse.
 * No location stamp (Places is Phase 3) and no Live Activity (the phone's).
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { newId } from '@/data/codec/ids';
import {
  advanceSession,
  cadenceCheckpoints,
  checkpointPrompt,
  confirmedRecord,
  elapsedSeconds,
  FALLBACK_SPRINT_EMOJI,
  isSessionComplete,
  MINIMUM_CHECKPOINT_INTERVAL_SECONDS,
  newFocusSession,
  persistedCadence,
  persistedSprint,
  planFocusNotifications,
  replanSession,
  sessionFromPersisted,
} from '@/domain/focus';
import type { FocusNudgeCadence, FocusSession, FocusSprintPlan } from '@/domain/focus';
import type { CompletedFocusSession } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { FocusLogger, FocusNotifier, FocusSprintStore } from './focusClient';

export interface FocusConfirmableCompletion {
  readonly ordinal: number;
  readonly recordId: string;
}

export interface FocusConfirmation {
  readonly ordinal: number;
  readonly clearedStack: boolean;
}

export interface StartSprintInput {
  readonly taskId?: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly durationSeconds: number;
  readonly cadence?: FocusNudgeCadence;
}

export interface FocusSessionState {
  readonly session: FocusSession | undefined;
  readonly startedAt: Date | undefined;
  readonly deadline: Date | undefined;
  readonly cadence: FocusNudgeCadence;
  readonly checkpointBanner: string | undefined;
  readonly logErrorMessage: string | undefined;
  readonly completedSprintCount: number;
  readonly offlineCompletionSummary: CompletedFocusSession | undefined;
  /** Newest in front. Only a NATURAL completion produces a card. */
  readonly unconfirmedCompletions: readonly CompletedFocusSession[];
  readonly latestConfirmableCompletion: FocusConfirmableCompletion | undefined;
  readonly latestConfirmation: FocusConfirmation | undefined;
  readonly isCardCollapsed: boolean;
  readonly start: (input: StartSprintInput) => void;
  readonly startPlan: (plan: FocusSprintPlan) => void;
  readonly togglePause: () => void;
  readonly addSeconds: (seconds: number) => void;
  readonly updateCadence: (cadence: FocusNudgeCadence) => void;
  readonly stop: (completedNaturally?: boolean) => Promise<void>;
  readonly tick: () => Promise<void>;
  /** Catches the countdown up after the tab was hidden; a countdown that ran out completes. */
  readonly syncNow: () => void;
  readonly restorePersistedSprint: () => Promise<void>;
  readonly acknowledgeOfflineCompletion: () => void;
  readonly confirmCompletion: (record: CompletedFocusSession) => Promise<void>;
  readonly setCardCollapsed: (collapsed: boolean) => void;
  readonly clearLogError: () => void;
}

export type FocusSessionStore = StoreApi<FocusSessionState>;

export interface FocusSessionStoreOptions {
  readonly logger?: FocusLogger;
  readonly sprintStore?: FocusSprintStore;
  readonly notifier?: FocusNotifier;
  readonly now?: () => Date;
  /** 0 disables the automatic ticker (tests drive `tick()` themselves). */
  readonly tickIntervalMs?: number;
}

export function isSprintActive(state: Pick<FocusSessionState, 'session'>): boolean {
  return state.session !== undefined;
}

export function createFocusSessionStore(options: FocusSessionStoreOptions = {}): FocusSessionStore {
  const now = options.now ?? (() => new Date());
  const { logger, sprintStore, notifier } = options;
  const tickMs = options.tickIntervalMs ?? 500;
  let ticker: ReturnType<typeof setInterval> | undefined;

  return createStore<FocusSessionState>((set, get) => {
    function stopTicking(): void {
      if (ticker !== undefined) clearInterval(ticker);
      ticker = undefined;
    }

    function startTicking(): void {
      stopTicking();
      if (tickMs <= 0) return;
      ticker = setInterval(() => void get().tick(), tickMs);
    }

    function persist(): void {
      if (!sprintStore) return;
      const { session, startedAt, deadline, cadence } = get();
      if (!session || !startedAt) {
        sprintStore.clear();
        return;
      }
      sprintStore.write(persistedSprint(session, startedAt, deadline, cadence));
    }

    function reschedule(requestingAuthorization = false): void {
      if (!notifier) return;
      const plan = () => planFocusNotifications(get().session, get().deadline, now());
      if (!requestingAuthorization) {
        notifier.replaceScheduled(plan());
        return;
      }
      void notifier
        .requestAuthorizationIfNeeded()
        .then((granted) => notifier.replaceScheduled(granted ? plan() : []));
    }

    /** Derives the remaining time from the deadline, never from tick counts; returns the checkpoints crossed. */
    function syncToWallClock(): number[] {
      const { session, deadline } = get();
      if (!session || session.isPaused || !deadline) return [];
      const remaining = Math.ceil((deadline.getTime() - now().getTime()) / 1000);
      const advanced = advanceSession(session, remaining);
      set({ session: advanced.session });
      return advanced.crossed;
    }

    function finishCurrentSprint(completedNaturally: boolean): CompletedFocusSession | undefined {
      stopTicking();
      set({ deadline: undefined });
      const { session, startedAt } = get();
      if (!session || !startedAt) return undefined;
      set({
        session: undefined,
        startedAt: undefined,
        checkpointBanner: undefined,
        completedSprintCount: get().completedSprintCount + 1,
      });
      reschedule();
      sprintStore?.clear();
      return {
        id: newId(),
        taskTitle: session.taskTitle,
        lifeAreaEmoji: session.lifeAreaEmoji,
        plannedSeconds: session.durationSeconds,
        focusedSeconds: elapsedSeconds(session),
        checkpointsReached: session.triggeredCheckpointIndices.size,
        completedNaturally,
        startedAt,
        endedAt: now(),
        ...(session.taskId ? { taskId: session.taskId } : {}),
      };
    }

    async function log(record: CompletedFocusSession): Promise<void> {
      if (!logger) return;
      try {
        await logger.logCompletedSession(record);
      } catch (error) {
        set({ logErrorMessage: errorText(error) });
      }
    }

    /** Synchronous, and before any await: the card must exist while the history write is in flight. */
    function pushUnconfirmedCompletion(record: CompletedFocusSession): void {
      const next = [record, ...get().unconfirmedCompletions];
      set({
        unconfirmedCompletions: next,
        latestConfirmableCompletion: {
          ordinal: (get().latestConfirmableCompletion?.ordinal ?? 0) + 1,
          recordId: record.id,
        },
      });
      sprintStore?.writeUnconfirmedCompletions(next);
    }

    function applyCrossed(crossed: number[]): void {
      const { session } = get();
      if (!session || crossed.length === 0) return;
      set({
        checkpointBanner: checkpointPrompt(
          crossed[crossed.length - 1]!,
          session.nudgeCheckpoints.length,
        ),
      });
    }

    return {
      session: undefined,
      startedAt: undefined,
      deadline: undefined,
      cadence: { kind: 'count', count: 1 },
      checkpointBanner: undefined,
      logErrorMessage: undefined,
      completedSprintCount: 0,
      offlineCompletionSummary: undefined,
      unconfirmedCompletions: [],
      latestConfirmableCompletion: undefined,
      latestConfirmation: undefined,
      isCardCollapsed: false,
      start: (input) => {
        syncToWallClock();
        const replaced = finishCurrentSprint(false);
        if (replaced) void log(replaced);
        const duration = Math.max(MINIMUM_CHECKPOINT_INTERVAL_SECONDS, input.durationSeconds);
        const cadence = input.cadence ?? { kind: 'count', count: 1 };
        const startedAt = now();
        set({
          session: newFocusSession({
            taskId: input.taskId,
            taskTitle: input.taskTitle,
            lifeAreaEmoji:
              input.lifeAreaEmoji.length > 0 ? input.lifeAreaEmoji : FALLBACK_SPRINT_EMOJI,
            durationSeconds: duration,
            nudgeCheckpoints: cadenceCheckpoints(cadence, duration),
          }),
          cadence,
          startedAt,
          deadline: new Date(startedAt.getTime() + duration * 1000),
          checkpointBanner: undefined,
        });
        startTicking();
        reschedule(true);
        persist();
      },
      startPlan: (plan) =>
        get().start({
          taskId: plan.taskId,
          taskTitle: plan.taskTitle,
          lifeAreaEmoji: plan.lifeAreaEmoji,
          durationSeconds: plan.durationSeconds,
          cadence: { kind: 'count', count: plan.nudgeCount },
        }),
      togglePause: () => {
        syncToWallClock();
        const current = get().session;
        if (!current) return;
        if (!current.isPaused && isSessionComplete(current)) {
          void get().stop(true);
          return;
        }
        if (current.isPaused) {
          set({
            session: { ...current, isPaused: false },
            deadline: new Date(now().getTime() + current.remainingSeconds * 1000),
          });
          startTicking();
        } else {
          set({ session: { ...current, isPaused: true }, deadline: undefined });
          stopTicking();
        }
        reschedule();
        persist();
      },
      addSeconds: (seconds) => {
        syncToWallClock();
        const current = get().session;
        if (!current || seconds <= 0) return;
        const extended = {
          ...current,
          durationSeconds: current.durationSeconds + seconds,
          remainingSeconds: current.remainingSeconds + seconds,
        };
        set({
          session: extended,
          ...(extended.isPaused
            ? {}
            : { deadline: new Date(now().getTime() + extended.remainingSeconds * 1000) }),
        });
        reschedule();
        persist();
      },
      updateCadence: (cadence) => {
        syncToWallClock();
        const current = get().session;
        if (!current) return;
        set({ cadence, session: replanSession(current, cadence) });
        reschedule();
        persist();
      },
      stop: async (completedNaturally = false) => {
        syncToWallClock();
        const current = get().session;
        const ranOut = current !== undefined && !current.isPaused && isSessionComplete(current);
        const naturally = completedNaturally || ranOut;
        const record = finishCurrentSprint(naturally);
        if (!record) return;
        if (naturally) pushUnconfirmedCompletion(record);
        await log(record);
      },
      tick: async () => {
        const crossed = syncToWallClock();
        const current = get().session;
        if (!current || current.isPaused) return;
        applyCrossed(crossed);
        if (isSessionComplete(current)) await get().stop(true);
        else if (crossed.length > 0) persist();
      },
      syncNow: () => {
        const crossed = syncToWallClock();
        const current = get().session;
        if (!current || current.isPaused) return;
        applyCrossed(crossed);
        if (isSessionComplete(current)) void get().stop(true);
        else if (crossed.length > 0) persist();
      },
      restorePersistedSprint: async () => {
        if (!sprintStore) return;
        if (get().offlineCompletionSummary === undefined) {
          const unacknowledged = sprintStore.readUnacknowledgedCompletion();
          if (unacknowledged) set({ offlineCompletionSummary: unacknowledged });
        }
        get().setCardCollapsed(sprintStore.readCardCollapsed());
        set({ unconfirmedCompletions: sprintStore.readUnconfirmedCompletions() });
        if (get().session) return;
        const saved = sprintStore.read();
        if (!saved) return;
        set({ cadence: persistedCadence(saved), startedAt: saved.startedAt });
        let restored = sessionFromPersisted(saved);
        if (saved.deadline) {
          restored = advanceSession(
            restored,
            Math.ceil((saved.deadline.getTime() - now().getTime()) / 1000),
          ).session;
          set({ session: restored, deadline: saved.deadline });
          if (isSessionComplete(restored)) {
            const record = finishCurrentSprint(true);
            if (record) {
              set({ offlineCompletionSummary: record });
              sprintStore.writeUnacknowledgedCompletion(record);
              await log(record);
            }
            return;
          }
          startTicking();
        } else {
          set({ session: restored, deadline: undefined });
        }
        reschedule();
        persist();
      },
      acknowledgeOfflineCompletion: () => {
        set({ offlineCompletionSummary: undefined });
        sprintStore?.clearUnacknowledgedCompletion();
      },
      confirmCompletion: async (record) => {
        const waiting = get().unconfirmedCompletions;
        const wasWaiting = waiting.some((r) => r.id === record.id);
        const next = waiting.filter((r) => r.id !== record.id);
        set({ unconfirmedCompletions: next });
        sprintStore?.writeUnconfirmedCompletions(next);
        if (wasWaiting) {
          set({
            latestConfirmation: {
              ordinal: (get().latestConfirmation?.ordinal ?? 0) + 1,
              clearedStack: next.length === 0,
            },
          });
        }
        if (!get().session) get().setCardCollapsed(false);
        await log(confirmedRecord(record, now()));
      },
      setCardCollapsed: (collapsed) => {
        set({ isCardCollapsed: collapsed });
        sprintStore?.writeCardCollapsed(collapsed);
      },
      clearLogError: () => set({ logErrorMessage: undefined }),
    };
  });
}
