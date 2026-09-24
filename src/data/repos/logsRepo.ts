/** `logs` (`FirebaseManager+Logs.swift`), the reads the area detail needs now; M1.3 adds the timeline and composer. */
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { Log } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeLog } from '../codec/schemas';

export async function fetchLogs(db: Firestore, uid: string): Promise<DecodedList<Log>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'logs'), orderBy('entry_date', 'desc')),
  );
  return decodeList(snapshot.docs, decodeLog);
}

/** Equality query (no orderBy: a composite index would be needed); sorted newest-first on the client. */
export async function fetchLogsForLifeArea(
  db: Firestore,
  uid: string,
  lifeAreaId: string,
): Promise<DecodedList<Log>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'logs'), where('life_area_id', '==', lifeAreaId)),
  );
  const list = decodeList(snapshot.docs, decodeLog);
  return {
    items: [...list.items].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime()),
    skipped: list.skipped,
  };
}
