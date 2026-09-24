/** `nudges` (`FirebaseManager+Nudges.swift`): the read Today needs now; M2.2 adds the editor's writes. */
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { Nudge } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeNudge } from '../codec/schemas';

export async function fetchNudges(db: Firestore, uid: string): Promise<DecodedList<Nudge>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'nudges'), orderBy('created_at')),
  );
  return decodeList(snapshot.docs, decodeNudge);
}
