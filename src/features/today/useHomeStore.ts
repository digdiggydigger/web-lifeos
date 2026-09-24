import { useEffect, useMemo } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import { firebaseHomeClient } from './homeClient';
import { createHomeStore } from './homeStore';
import type { HomeStore } from './homeStore';

/** One home store per signed-in user for the session: Today and the week review read the same load. */
const stores = new Map<string, HomeStore>();

export function useHomeStore(): HomeStore {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  const store = useMemo(() => {
    let existing = stores.get(uid);
    if (!existing) {
      existing = createHomeStore(firebaseHomeClient(firebase().db, uid));
      stores.set(uid, existing);
    }
    return existing;
  }, [uid]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}
