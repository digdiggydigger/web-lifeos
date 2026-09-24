import { useMemo } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import { firebaseAreaClients } from './areasClient';
import type { AreaClients } from './areasClient';

/** One client per signed-in user for the whole session, so every screen that keys a store on it shares that store. */
const clients = new Map<string, AreaClients>();

export function useAreaClients(): AreaClients {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  return useMemo(() => {
    let existing = clients.get(uid);
    if (!existing) {
      existing = firebaseAreaClients(firebase().db, uid);
      clients.set(uid, existing);
    }
    return existing;
  }, [uid]);
}
