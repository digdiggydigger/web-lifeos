import { useMemo } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';

import { firebaseTaskClients } from './tasksClient';
import type { TaskClients } from './tasksClient';

/** The Firebase task clients for the signed-in user (the route gate guarantees one). */
export function useTaskClients(): TaskClients {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  return useMemo(() => firebaseTaskClients(firebase().db, uid), [uid]);
}
