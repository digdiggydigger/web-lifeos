/** `RecentlyDeletedService`: the list, restore (with the tag survivor choice), delete forever, and the launch purge. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { isPurgeable, recentlyDeletedContent, recentlyDeletedId } from '@/domain/recentlyDeleted';
import type { RecentlyDeletedItem, RecentlyDeletedRow } from '@/domain/recentlyDeleted';
import { errorText } from '@/features/tasks/tasksClient';

import type { RecentlyDeletedClient } from './recentlyDeletedClient';

export type RecentlyDeletedScreen =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'rows'; readonly rows: readonly RecentlyDeletedRow[] }
  | { readonly kind: 'empty' };

export interface RecentlyDeletedState {
  readonly screen: RecentlyDeletedScreen;
  readonly items: readonly RecentlyDeletedItem[];
  readonly busyItemId: string | undefined;
  readonly errorMessage: string | undefined;
  readonly pendingSurvivorChoice: RecentlyDeletedItem | undefined;
  readonly load: () => Promise<void>;
  readonly restore: (item: RecentlyDeletedItem) => Promise<boolean>;
  readonly resolveSurvivor: (
    item: RecentlyDeletedItem,
    keepingRestored: boolean,
  ) => Promise<boolean>;
  readonly cancelSurvivorChoice: () => void;
  readonly deleteForever: (item: RecentlyDeletedItem) => Promise<boolean>;
  /** Takes only what is past the window; one refusal never abandons the rest; says nothing on failure. */
  readonly purge: () => Promise<void>;
}

export function createRecentlyDeletedStore(
  client: RecentlyDeletedClient,
  now: () => Date = () => new Date(),
): StoreApi<RecentlyDeletedState> {
  return createStore<RecentlyDeletedState>((set, get) => {
    function redraw(): void {
      const content = recentlyDeletedContent(get().items, now());
      set({
        screen: content.kind === 'rows' ? { kind: 'rows', rows: content.rows } : { kind: 'empty' },
      });
    }
    async function mutate(item: RecentlyDeletedItem, write: () => Promise<void>): Promise<boolean> {
      set({ errorMessage: undefined, busyItemId: recentlyDeletedId(item) });
      try {
        await write();
        set({ items: get().items.filter((i) => recentlyDeletedId(i) !== recentlyDeletedId(item)) });
        redraw();
        return true;
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return false;
      } finally {
        set({ busyItemId: undefined });
      }
    }
    return {
      screen: { kind: 'loading' },
      items: [],
      busyItemId: undefined,
      errorMessage: undefined,
      pendingSurvivorChoice: undefined,
      load: async () => {
        try {
          set({ items: await client.fetchDeleted() });
          redraw();
        } catch (error) {
          set({ screen: { kind: 'failed', message: errorText(error) } });
        }
      },
      restore: (item) => {
        if (item.collision) {
          set({ pendingSurvivorChoice: item });
          return Promise.resolve(false);
        }
        return mutate(item, () => client.restore(item));
      },
      resolveSurvivor: (item, keepingRestored) => {
        set({ pendingSurvivorChoice: undefined });
        return mutate(item, () => client.restoreResolving(item, keepingRestored));
      },
      cancelSurvivorChoice: () => set({ pendingSurvivorChoice: undefined }),
      deleteForever: (item) => mutate(item, () => client.deleteForever(item)),
      purge: async () => {
        let waiting: RecentlyDeletedItem[];
        try {
          waiting = await client.fetchDeleted();
        } catch {
          return;
        }
        const asOf = now();
        for (const item of waiting) {
          if (!isPurgeable(item.deletedAt, asOf)) continue;
          try {
            await client.deleteForever(item);
          } catch {
            // one refusal never abandons the rest
          }
        }
      },
    };
  });
}
