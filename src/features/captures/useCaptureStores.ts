import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';
import { firebaseJournalClient } from '@/features/journal/journalClient';
import { recentActionStore } from '@/features/undo/recentActionStore';

import { firebaseCaptureClient } from './captureClient';
import type { CaptureClient } from './captureClient';
import { createCaptureInboxStore } from './captureInboxStore';
import type { CaptureInboxState } from './captureInboxStore';

interface CaptureStores {
  readonly client: CaptureClient;
  readonly inbox: StoreApi<CaptureInboxState>;
}

/** One client and one inbox store per signed-in user for the session; the inbox, detail and composers share them. */
const stores = new Map<string, CaptureStores>();

export function useCaptureStores(): CaptureStores {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  return useMemo(() => {
    let existing = stores.get(uid);
    if (!existing) {
      const { db, storage } = firebase();
      const client = firebaseCaptureClient(db, storage, uid);
      existing = {
        client,
        inbox: createCaptureInboxStore(client, {
          journalClient: firebaseJournalClient(db, uid),
          availableFilters: ['unprocessed', 'seen', 'promoted'],
          record: (action) => recentActionStore.getState().record(action),
        }),
      };
      stores.set(uid, existing);
    }
    return existing;
  }, [uid]);
}

/** The inbox store, loaded on mount like the iOS `.task`. */
export function useCaptureInbox(): StoreApi<CaptureInboxState> {
  const { inbox } = useCaptureStores();
  useEffect(() => {
    void inbox.getState().load();
  }, [inbox]);
  return inbox;
}
