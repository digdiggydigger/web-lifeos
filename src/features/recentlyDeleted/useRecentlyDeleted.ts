import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import { firebaseRecentlyDeletedClient } from './recentlyDeletedClient';
import { createRecentlyDeletedStore } from './recentlyDeletedStore';
import type { RecentlyDeletedState } from './recentlyDeletedStore';

const stores = new Map<string, StoreApi<RecentlyDeletedState>>();
const purged = new Set<string>();

function storeFor(uid: string): StoreApi<RecentlyDeletedState> {
  let existing = stores.get(uid);
  if (!existing) {
    existing = createRecentlyDeletedStore(firebaseRecentlyDeletedClient(firebase().db, uid));
    stores.set(uid, existing);
  }
  return existing;
}

/** The list, loaded on every mount like the iOS `.task`. */
export function useRecentlyDeleted(): StoreApi<RecentlyDeletedState> {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  const store = useMemo(() => storeFor(uid), [uid]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}

/** `RecentlyDeletedPurge.run()`: once per signed-in user per session, as `RootView` does at launch. */
export function useRecentlyDeletedPurge(): void {
  const uid = useAuth((s) => signedInUser(s)?.uid);
  useEffect(() => {
    if (!uid || purged.has(uid)) return;
    purged.add(uid);
    void storeFor(uid).getState().purge();
  }, [uid]);
}
