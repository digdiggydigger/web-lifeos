/** `logs` (`FirebaseManager+Logs.swift`): append, delete, and the two reads. Never an update. */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { Log } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeLog, encodeLog } from '../codec/schemas';

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

/** The only write for logs: a full document, born with its tags or never having them. */
export async function appendLog(db: Firestore, uid: string, log: Log): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'logs', log.id), encodeLog(log));
}

/** Removes one entry (undoing capture triage's "Journal it"). There is still no path that edits one. */
export async function deleteLog(db: Firestore, uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'logs', id));
}
