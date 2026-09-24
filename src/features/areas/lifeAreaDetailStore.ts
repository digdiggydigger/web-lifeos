/** `LifeAreaDetailService`: one area's tasks (filtered), logs (newest first) and captures. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { applyingStatus, filterTasks } from '@/domain/tasks';
import type { TaskStatusFilterOption } from '@/domain/tasks';
import type { Log, Task } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { LifeAreaDetailClient } from './areasClient';

export type DetailLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'failed'; readonly message: string };

export interface LifeAreaDetailState {
  readonly state: DetailLoadState;
  readonly statusFilter: TaskStatusFilterOption;
  readonly allTasks: readonly Task[];
  readonly filteredTasks: readonly Task[];
  readonly logs: readonly Log[];
  readonly mutationErrorMessage: string | undefined;
  readonly load: () => Promise<void>;
  readonly setStatusFilter: (filter: TaskStatusFilterOption) => void;
  readonly closeTask: (task: Task) => Promise<void>;
  readonly reopenTask: (task: Task) => Promise<boolean>;
}

export function createLifeAreaDetailStore(
  client: LifeAreaDetailClient,
  lifeAreaId: string,
  now: () => Date = () => new Date(),
): StoreApi<LifeAreaDetailState> {
  return createStore<LifeAreaDetailState>((set, get) => {
    function refilter(): void {
      set({ filteredTasks: filterTasks(get().allTasks, get().statusFilter, now()) });
    }
    async function setStatus(
      task: Task,
      from: Task['status'],
      to: Task['status'],
    ): Promise<boolean> {
      const { allTasks, state } = get();
      const index = allTasks.findIndex((t) => t.id === task.id);
      if (state.kind !== 'loaded' || index < 0 || allTasks[index]?.status !== from) return false;
      const next = allTasks.slice();
      next[index] = applyingStatus(to, allTasks[index], now());
      set({ allTasks: next });
      refilter();
      try {
        await client.updateStatus(task.id, to);
        return true;
      } catch (error) {
        set({ mutationErrorMessage: errorText(error) });
        await get().load();
        return false;
      }
    }
    return {
      state: { kind: 'loading' },
      statusFilter: 'open',
      allTasks: [],
      filteredTasks: [],
      logs: [],
      mutationErrorMessage: undefined,
      load: async () => {
        if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
        try {
          const [allTasks, logs] = await Promise.all([
            client.fetchTasksForArea(lifeAreaId),
            client.fetchLogsForArea(lifeAreaId),
          ]);
          set({
            allTasks,
            logs: [...logs].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime()),
            state: { kind: 'loaded' },
          });
          refilter();
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },
      setStatusFilter: (statusFilter) => {
        set({ statusFilter });
        if (get().state.kind === 'loaded') refilter();
      },
      closeTask: async (task) => {
        await setStatus(task, 'open', 'done');
      },
      reopenTask: (task) => setStatus(task, 'done', 'open'),
    };
  });
}
