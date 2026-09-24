import { useMemo } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { signedInUser } from '@/data/store/authStore';
import { celebrations } from '@/features/celebrations/appCelebrations';

import {
  browserFocusNotifier,
  firebaseFocusLogger,
  localStorageFocusSprintStore,
} from './focusClient';
import { createFocusSessionStore } from './focusSessionStore';
import type { FocusSessionStore } from './focusSessionStore';

/** One sprint service per signed-in user for the session: the bar, the detail, Today and the task screens all drive the same countdown. */
const stores = new Map<string, FocusSessionStore>();

export function useFocusStore(): FocusSessionStore {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  return useMemo(() => {
    let existing = stores.get(uid);
    if (!existing) {
      const created = createFocusSessionStore({
        logger: firebaseFocusLogger(firebase().db, uid),
        sprintStore: localStorageFocusSprintStore(uid),
        notifier: browserFocusNotifier(),
      });
      // The Confirm bridge (`FocusCompletionCelebration`): every NEW confirmation stamp asks for the
      // full-screen celebration; the one that cleared the stack earns the fireworks.
      created.subscribe((next, previous) => {
        const stamp = next.latestConfirmation;
        if (stamp && stamp.ordinal !== previous.latestConfirmation?.ordinal) {
          celebrations.request({ kind: 'confirm', clearedStack: stamp.clearedStack }, null);
        }
      });
      void created.getState().restorePersistedSprint();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') created.getState().syncNow();
        });
      }
      stores.set(uid, created);
      existing = created;
    }
    return existing;
  }, [uid]);
}
