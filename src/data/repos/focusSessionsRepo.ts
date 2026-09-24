/** `focus_sessions` (`FirebaseManager+FocusSessions.swift`): the read the journal timeline needs. Writes are Phase 2. */
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { CompletedFocusSession } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeFocusSession } from '../codec/schemas';

export async function fetchFocusSessions(
  db: Firestore,
  uid: string,
): Promise<DecodedList<CompletedFocusSession>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'focus_sessions'), orderBy('ended_at', 'desc')),
  );
  return decodeList(snapshot.docs, decodeFocusSession);
}
