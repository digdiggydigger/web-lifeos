/** `RecentActionCenter` (`Undo/RecentActionCenter.swift`), minimal: one slot, newest replaces, no timeout. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import type { RecentAction } from '@/domain/undo/recentAction';

export interface RecentActionState {
  readonly current: RecentAction | undefined;
  readonly undoing: boolean;
  readonly record: (action: RecentAction) => void;
  readonly dismiss: () => void;
  /** Clears the slot BEFORE awaiting the reversal, and puts it back if the reversal fails. */
  readonly undo: () => Promise<boolean>;
}

export type RecentActionStore = StoreApi<RecentActionState>;

export function createRecentActionStore(): RecentActionStore {
  return createStore<RecentActionState>((set, get) => ({
    current: undefined,
    undoing: false,
    record: (action) => set({ current: action }),
    dismiss: () => set({ current: undefined }),
    undo: async () => {
      const action = get().current;
      if (!action) return false;
      set({ current: undefined, undoing: true });
      try {
        const ok = await action.undo();
        if (!ok) set({ current: action });
        return ok;
      } catch {
        set({ current: action });
        return false;
      } finally {
        set({ undoing: false });
      }
    },
  }));
}

export const recentActionStore = createRecentActionStore();
