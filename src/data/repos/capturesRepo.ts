/** `captures` (`FirebaseManager+Captures.swift`): the reads the journal needs now; M1.4 adds the inbox and its writes. */
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { live } from '@/domain/softDelete';
import type { Capture } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeCapture } from '../codec/schemas';

/** Every live capture, newest first (soft-deleted ones are filtered client-side, as on iOS). */
export async function fetchCaptures(db: Firestore, uid: string): Promise<DecodedList<Capture>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'captures'), orderBy('created_at', 'desc')),
  );
  const list = decodeList(snapshot.docs, decodeCapture);
  return { items: live(list.items), skipped: list.skipped };
}
