/** `AreasService`: the Areas tab. Areas, open tasks and all tasks must load; logs and captures degrade to []. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { buildAreasGrid, unfiledCount, weekShare } from '@/domain/lifeAreas';
import type { AreasGridItem, WeekShare } from '@/domain/lifeAreas';
import type { LifeArea } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { AreasClient } from './areasClient';

export type AreasLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly items: readonly AreasGridItem[] }
  | { readonly kind: 'failed'; readonly message: string };

export interface AreasState {
  readonly state: AreasLoadState;
  readonly lifeAreas: readonly LifeArea[];
  readonly unfiledCount: number;
  readonly weekShare: WeekShare | undefined;
  readonly load: () => Promise<void>;
}

export function createAreasStore(
  client: AreasClient,
  now: () => Date = () => new Date(),
): StoreApi<AreasState> {
  return createStore<AreasState>((set, get) => ({
    state: { kind: 'loading' },
    lifeAreas: [],
    unfiledCount: 0,
    weekShare: undefined,
    load: async () => {
      if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
      try {
        const [allAreas, openTasks, allTasks, logs, captures] = await Promise.all([
          client.fetchLifeAreas(),
          client.fetchOpenTasks(),
          client.fetchAllTasks(),
          client.fetchLogs().catch(() => []),
          client.fetchUnprocessedCaptures().catch(() => []),
        ]);
        const lifeAreas = allAreas
          .filter((a) => !a.archived)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        set({
          lifeAreas,
          unfiledCount: unfiledCount(captures),
          weekShare: weekShare(lifeAreas, allTasks, now()),
          state: {
            kind: 'loaded',
            items: buildAreasGrid({
              areas: lifeAreas,
              openTasks,
              allTasks,
              logs,
              captures,
              now: now(),
            }),
          },
        });
      } catch (error) {
        set({ state: { kind: 'failed', message: errorText(error) } });
      }
    },
  }));
}
