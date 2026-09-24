/**
 * `HomeService` (`Home/HomeService.swift`) plus the side inputs `HomeView` fetches itself
 * (`refreshInboxCount`, `refreshClearedCaptureCount`, the nudges and focus history): one store
 * behind Today and the week review.
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { completeOrder, countOpenTasksByLifeArea } from '@/domain/lifeAreas';
import type { LifeAreaTaskCount } from '@/domain/lifeAreas';
import { clearedToday } from '@/domain/momentum';
import type { Capture, CompletedFocusSession, LifeArea, Nudge, Task } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { HomeClient } from './homeClient';

export type HomeLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly counts: readonly LifeAreaTaskCount[] }
  | { readonly kind: 'failed'; readonly message: string };

export type SideLoadState = 'loading' | 'loaded' | 'failed';

export interface HomeState {
  readonly state: HomeLoadState;
  /** The FULL fetched set, archived included. */
  readonly lifeAreas: readonly LifeArea[];
  readonly openTasks: readonly Task[];
  /** Every task; a failed refetch keeps the last-known set, never empties it. */
  readonly allTasks: readonly Task[];
  readonly reorderErrorMessage: string | undefined;
  readonly mutationErrorMessage: string | undefined;
  readonly closingTaskId: string | undefined;
  /** Unprocessed captures, newest first from the repo; failure keeps the last known. */
  readonly inbox: readonly Capture[];
  readonly inboxHandledToday: number;
  /** Whether both cleared-capture fetches landed: the daily goal must tell "zero" from "unknown". */
  readonly hasLoadedClearedCaptures: boolean;
  readonly nudges: readonly Nudge[];
  readonly nudgesState: SideLoadState;
  readonly focusSessions: readonly CompletedFocusSession[];
  readonly load: () => Promise<void>;
  /** Persist a new ordering of the active areas; the payload is completed with the archived ones. */
  readonly submitReorder: (activeInNewOrder: readonly LifeArea[]) => Promise<void>;
  readonly moveActiveArea: (id: string, direction: -1 | 1) => Promise<void>;
  /** Waits for the write, then reloads; the caller records the undo only once it returns true. */
  readonly close: (task: Task) => Promise<boolean>;
  readonly reopen: (task: Task) => Promise<boolean>;
  readonly clearMutationError: () => void;
  readonly clearReorderError: () => void;
}

export type HomeStore = StoreApi<HomeState>;

export function activeAreas(lifeAreas: readonly LifeArea[]): LifeArea[] {
  return lifeAreas.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function archivedAreas(lifeAreas: readonly LifeArea[]): LifeArea[] {
  return lifeAreas.filter((a) => a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createHomeStore(client: HomeClient, now: () => Date = () => new Date()): HomeStore {
  let isReordering = false;
  let pendingOrder: readonly string[] | undefined;

  return createStore<HomeState>((set, get) => {
    async function loadSideInputs(): Promise<void> {
      const [waiting, seen, processed, nudges, sessions] = await Promise.allSettled([
        client.fetchUnprocessedCaptures(),
        client.fetchSeenCaptures(),
        client.fetchProcessedCaptures(),
        client.fetchNudges(),
        client.fetchFocusSessions(),
      ]);
      const cleared = [
        ...(seen.status === 'fulfilled' ? seen.value : []),
        ...(processed.status === 'fulfilled' ? processed.value : []),
      ];
      set({
        ...(waiting.status === 'fulfilled' ? { inbox: waiting.value } : {}),
        inboxHandledToday: clearedToday(cleared, now()),
        hasLoadedClearedCaptures: seen.status === 'fulfilled' && processed.status === 'fulfilled',
        ...(nudges.status === 'fulfilled'
          ? { nudges: nudges.value, nudgesState: 'loaded' as const }
          : { nudgesState: 'failed' as const }),
        ...(sessions.status === 'fulfilled' ? { focusSessions: sessions.value } : {}),
      });
    }

    async function handleReorderFailure(error: unknown): Promise<void> {
      set({ reorderErrorMessage: errorText(error) });
      await get().load();
    }

    async function submitOrder(order: readonly string[]): Promise<void> {
      if (isReordering) {
        pendingOrder = order;
        return;
      }
      isReordering = true;
      let current = order;
      for (;;) {
        try {
          await client.reorder(current);
        } catch (error) {
          isReordering = false;
          pendingOrder = undefined;
          await handleReorderFailure(error);
          return;
        }
        if (pendingOrder) {
          current = pendingOrder;
          pendingOrder = undefined;
          continue;
        }
        break;
      }
      isReordering = false;
    }

    async function setStatus(task: Task, status: Task['status']): Promise<boolean> {
      set({ closingTaskId: status === 'done' ? task.id : get().closingTaskId });
      try {
        await client.setStatus(task.id, status);
      } catch (error) {
        set({ mutationErrorMessage: errorText(error), closingTaskId: undefined });
        return false;
      }
      await get().load();
      set({ closingTaskId: undefined });
      return true;
    }

    return {
      state: { kind: 'loading' },
      lifeAreas: [],
      openTasks: [],
      allTasks: [],
      reorderErrorMessage: undefined,
      mutationErrorMessage: undefined,
      closingTaskId: undefined,
      inbox: [],
      inboxHandledToday: 0,
      hasLoadedClearedCaptures: false,
      nudges: [],
      nudgesState: 'loading',
      focusSessions: [],
      load: async () => {
        // Quiet reload: only the first load may show the loading state.
        if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
        const side = loadSideInputs();
        try {
          const [lifeAreas, openTasks, allTasks] = await Promise.all([
            client.fetchLifeAreas(),
            client.fetchOpenTasks(),
            client.fetchAllTasks().catch(() => undefined),
          ]);
          set({
            lifeAreas,
            openTasks,
            ...(allTasks ? { allTasks } : {}),
            state: {
              kind: 'loaded',
              counts: countOpenTasksByLifeArea(activeAreas(lifeAreas), openTasks),
            },
          });
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
        await side;
      },
      submitReorder: (activeInNewOrder) =>
        submitOrder(completeOrder(activeInNewOrder, archivedAreas(get().lifeAreas))),
      moveActiveArea: async (id, direction) => {
        const active = activeAreas(get().lifeAreas);
        const index = active.findIndex((a) => a.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= active.length) return;
        const reordered = active.slice();
        [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
        // Show the new order at once; a rejected write reloads the server's order.
        const renumbered = reordered.map((a, sortOrder) => ({ ...a, sortOrder }));
        const lifeAreas = [...renumbered, ...archivedAreas(get().lifeAreas)];
        set({
          lifeAreas,
          state: { kind: 'loaded', counts: countOpenTasksByLifeArea(renumbered, get().openTasks) },
        });
        await get().submitReorder(renumbered);
      },
      close: (task) => setStatus(task, 'done'),
      reopen: (task) => setStatus(task, 'open'),
      clearMutationError: () => set({ mutationErrorMessage: undefined }),
      clearReorderError: () => set({ reorderErrorMessage: undefined }),
    };
  });
}
