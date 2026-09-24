/** `TasksService` (`Tasks/TasksService.swift`) on a vanilla zustand store. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  applySearch,
  applyingStatus,
  filterTasks,
  groupMomentum,
  groupTasksByLifeArea,
} from '@/domain/tasks';
import type { LifeAreaTaskGroup, TaskStatusFilterOption } from '@/domain/tasks';
import type { LifeArea, Task } from '@/domain/types';

import { errorText } from './tasksClient';
import type { TasksClient } from './tasksClient';

export type TasksLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly groups: readonly LifeAreaTaskGroup[] }
  | { readonly kind: 'failed'; readonly message: string };

export interface TasksState {
  readonly state: TasksLoadState;
  readonly statusFilter: TaskStatusFilterOption;
  readonly searchText: string;
  readonly mutationErrorMessage: string | undefined;
  readonly lifeAreas: readonly LifeArea[];
  readonly tasks: readonly Task[];
  readonly hasLoadedOnce: boolean;
  readonly load: () => Promise<void>;
  readonly setStatusFilter: (filter: TaskStatusFilterOption) => void;
  readonly setSearchText: (text: string) => void;
  readonly close: (task: Task) => Promise<void>;
  readonly reopen: (task: Task) => Promise<boolean>;
  readonly clearMutationError: () => void;
}

export type TasksStore = StoreApi<TasksState>;

export function createTasksStore(
  client: TasksClient,
  now: () => Date = () => new Date(),
): TasksStore {
  return createStore<TasksState>((set, get) => {
    function recompute(): void {
      const { tasks, lifeAreas, statusFilter, searchText } = get();
      const refined = applySearch(filterTasks(tasks, statusFilter, now()), searchText);
      set({
        state: {
          kind: 'loaded',
          groups:
            statusFilter === 'momentum'
              ? groupMomentum(refined, now())
              : groupTasksByLifeArea(refined, lifeAreas),
        },
      });
    }

    async function setStatusOptimistically(
      task: Task,
      from: Task['status'],
      to: Task['status'],
    ): Promise<boolean> {
      const { hasLoadedOnce, tasks } = get();
      const index = tasks.findIndex((t) => t.id === task.id);
      if (!hasLoadedOnce || index < 0 || tasks[index]?.status !== from) return false;
      const next = tasks.slice();
      next[index] = applyingStatus(to, tasks[index], now());
      set({ tasks: next });
      recompute();
      try {
        await client.setStatus(task.id, to);
        return true;
      } catch (error) {
        set({ mutationErrorMessage: errorText(error) });
        await get().load();
        return false;
      }
    }

    return {
      state: { kind: 'loading' },
      statusFilter: 'momentum',
      searchText: '',
      mutationErrorMessage: undefined,
      lifeAreas: [],
      tasks: [],
      hasLoadedOnce: false,

      load: async () => {
        if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
        try {
          const [lifeAreas, tasks] = await Promise.all([
            client.fetchLifeAreas(),
            client.fetchAllTasks(),
          ]);
          set({ lifeAreas, tasks, hasLoadedOnce: true });
          recompute();
        } catch (error) {
          set({ hasLoadedOnce: false, state: { kind: 'failed', message: errorText(error) } });
        }
      },

      setStatusFilter: (statusFilter) => {
        set({ statusFilter });
        if (get().hasLoadedOnce) recompute();
      },

      setSearchText: (searchText) => {
        set({ searchText });
        if (get().hasLoadedOnce) recompute();
      },

      close: async (task) => {
        await setStatusOptimistically(task, 'open', 'done');
      },

      reopen: (task) => setStatusOptimistically(task, 'done', 'open'),

      clearMutationError: () => set({ mutationErrorMessage: undefined }),
    };
  });
}
