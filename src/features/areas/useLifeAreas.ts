import { useEffect, useState } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { firebase } from '@/data/firebase';
import { watchLifeAreas } from '@/data/repos/lifeAreasRepo';
import { signedInUser } from '@/data/store/authStore';
import type { LifeArea } from '@/domain/types';

export type LifeAreasState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly areas: readonly LifeArea[]; readonly skipped: number }
  | { readonly kind: 'error'; readonly message: string };

/** The signed-in user's live life areas (active only), newest snapshot wins. */
export function useLifeAreas(): LifeAreasState {
  const uid = useAuth((s) => signedInUser(s)?.uid);
  const [state, setState] = useState<LifeAreasState>({ kind: 'loading' });

  useEffect(() => {
    if (!uid) return;
    setState({ kind: 'loading' });
    return watchLifeAreas(firebase().db, uid, {
      onData: (list) =>
        setState({ kind: 'ready', areas: list.items, skipped: list.skipped.length }),
      onError: (error) => setState({ kind: 'error', message: error.message }),
    });
  }, [uid]);

  return state;
}
