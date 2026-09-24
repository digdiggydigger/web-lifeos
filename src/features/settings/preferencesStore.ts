/** The local preference set, app-wide: one store over localStorage (`UserDefaultsMomentumPreferencesStore`). */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { readPreferences, writePreferences } from '@/domain/settings';
import type { MomentumPreferences } from '@/domain/settings';

export interface PreferencesState {
  readonly preferences: MomentumPreferences;
  readonly update: (patch: Partial<MomentumPreferences>) => void;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createPreferencesStore(
  storage: StorageLike | undefined = defaultStorage(),
): StoreApi<PreferencesState> {
  return createStore<PreferencesState>((set, get) => ({
    preferences: readPreferences(storage),
    update: (patch) => {
      const next = { ...get().preferences, ...patch };
      writePreferences(storage, next);
      set({ preferences: readPreferences(storage) ?? next });
    },
  }));
}

export const preferencesStore = createPreferencesStore();
