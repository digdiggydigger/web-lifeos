import { useEffect, useMemo } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';
import { markHasHadNudges } from '@/domain/nudges';
import { celebrations } from '@/features/celebrations/appCelebrations';
import { recentActionStore } from '@/features/undo/recentActionStore';

import { browserNudgeNotifier, firebaseNudgesClient } from './nudgesClient';
import { createNudgesStore, nudgesOf } from './nudgesStore';
import type { NudgesStore } from './nudgesStore';

function localStorageOrNothing(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** One store per signed-in user for the session: Today's section and the Nudges screen share it, so a dismissal on either shows on both. */
const stores = new Map<string, NudgesStore>();

export function useNudgesStore(): NudgesStore {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  const store = useMemo(() => {
    let existing = stores.get(uid);
    if (!existing) {
      const created = createNudgesStore(firebaseNudgesClient(firebase().db, uid), {
        notifier: browserNudgeNotifier(),
        record: (action) => recentActionStore.getState().record(action),
        // R-b: the seventh consecutive Done for now. The site already has its own feedback.
        celebrate: (milestone) => celebrations.request({ kind: 'milestone', milestone }, null),
      });
      // The first-run marker latches on every appearance and every change; it only ever suppresses the door.
      created.subscribe((s) => {
        if (nudgesOf(s).length > 0) markHasHadNudges(uid, localStorageOrNothing());
      });
      stores.set(uid, created);
      existing = created;
    }
    return existing;
  }, [uid]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}

export function useUid(): string {
  return useAuth((s) => signedInUser(s)?.uid) ?? '';
}
