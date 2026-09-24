import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import {
  dailySummaryProvider,
  endpointDailySummaryGenerator,
  firebaseDailySummaryBackingStore,
  localDailySummaryStorage,
  stubDailySummaryGenerator,
} from './dailySummaryClient';
import { createDailySummaryStore, sharedDailySummaryCoordinator } from './dailySummaryStore';
import type { DailySummaryState } from './dailySummaryStore';

function localStorageOrNothing(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * `DailySummaryService.live()`: a fresh store per appearance of the card (so only TODAY's summary
 * restores, even in a tab left open overnight), sharing one coordinator so a remount joins a
 * generation already running.
 *
 * Against the emulators there is no endpoint to reach (an emulator token means nothing to the
 * deployed function), so the on-device synthesis is the generator, as on iOS with no endpoint.
 */
export function useDailySummaryStore(): StoreApi<DailySummaryState> {
  const uid = useAuth((s) => signedInUser(s)?.uid);
  const store = useMemo(() => {
    const { db, auth, useEmulators } = firebase();
    const userId = uid ?? null;
    return createDailySummaryStore({
      provider: dailySummaryProvider(firebaseDailySummaryBackingStore(db, uid ?? '')),
      generator: useEmulators
        ? stubDailySummaryGenerator
        : endpointDailySummaryGenerator({
            idToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : undefined),
          }),
      ...(useEmulators ? {} : { fallbackGenerator: stubDailySummaryGenerator }),
      storage: localDailySummaryStorage(localStorageOrNothing()),
      userId,
      coordinator: sharedDailySummaryCoordinator,
    });
  }, [uid]);
  useEffect(() => {
    void store.getState().reattachIfGenerating();
  }, [store]);
  return store;
}
