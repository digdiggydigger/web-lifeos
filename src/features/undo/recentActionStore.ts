/** `RecentActionCenter` (`Undo/RecentActionCenter.swift`): one slot app-wide, the newest action owns it, no timeout. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import type { RecentAction } from '@/domain/undo/recentAction';

export interface RecentActionState {
  readonly current: RecentAction | undefined;
  readonly undoing: boolean;
  readonly record: (action: RecentAction) => void;
  /** Dismissal, not undo: never runs the reversal. */
  readonly dismiss: () => void;
  /**
   * Clears the slot BEFORE awaiting the reversal so a second tap reverses nothing, and puts the
   * offer back only if the reversal declined AND nothing newer took the slot meanwhile.
   */
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
      let ok: boolean;
      try {
        ok = await action.undo();
      } catch {
        ok = false;
      } finally {
        set({ undoing: false });
      }
      if (!ok && get().current === undefined) set({ current: action });
      return ok;
    },
  }));
}

export const recentActionStore = createRecentActionStore();
