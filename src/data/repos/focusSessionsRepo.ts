/** `focus_sessions` (`FirebaseManager+FocusSessions.swift`): newest first, and the whole-document save a finished sprint (or its confirmation) writes. */
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { CompletedFocusSession } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeFocusSession, encodeFocusSession } from '../codec/schemas';

export async function fetchFocusSessions(
  db: Firestore,
  uid: string,
): Promise<DecodedList<CompletedFocusSession>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'focus_sessions'), orderBy('ended_at', 'desc')),
  );
  return decodeList(snapshot.docs, decodeFocusSession);
}

/** `FirebaseManager.save`: the full document, no merge, keyed on the record's id so a confirmation upserts the provisional row. */
export async function saveFocusSession(
  db: Firestore,
  uid: string,
  session: CompletedFocusSession,
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'focus_sessions', session.id), encodeFocusSession(session));
}
