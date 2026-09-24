import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import { firebaseJournalClient } from './journalClient';
import { createJournalStore } from './journalStore';
import type { JournalState } from './journalStore';

/** One journal store per signed-in user for the session, reloaded on every mount like the iOS `.task`. */
const stores = new Map<string, StoreApi<JournalState>>();

export function useJournalStore(): StoreApi<JournalState> {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  const store = useMemo(() => {
    let existing = stores.get(uid);
    if (!existing) {
      existing = createJournalStore(firebaseJournalClient(firebase().db, uid));
      stores.set(uid, existing);
    }
    return existing;
  }, [uid]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}
