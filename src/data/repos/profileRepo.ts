import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { Profile } from '@/domain/types';

import { decodeProfile } from '../codec/schemas';
import { omitUndefined } from '../codec/fields';

export function profileDoc(db: Firestore, uid: string) {
  return doc(db, 'users', uid);
}

/** `FirebaseManager.signUp`: email, server-clock created_at, and the name when given. Merge, never overwrite. */
export async function ensureProfile(
  db: Firestore,
  uid: string,
  email: string,
  displayName: string | undefined,
): Promise<void> {
  await setDoc(
    profileDoc(db, uid),
    omitUndefined({ email, created_at: serverTimestamp(), display_name: displayName }),
    { merge: true },
  );
}

export async function fetchProfile(db: Firestore, uid: string): Promise<Profile | undefined> {
  const snapshot = await getDoc(profileDoc(db, uid));
  return snapshot.exists() ? decodeProfile(snapshot.data()) : undefined;
}
