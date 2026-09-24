/** `nudges` (`FirebaseManager+Nudges.swift` through `FirebaseNudgesClientAdapter`): writes land the delta, then re-read. */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import type { NudgeUpdatePayload } from '@/domain/nudges';
import type { Nudge } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { nudgeFired, nudgeUnfired, nudgeUpdate } from '../codec/payloads/nudges';
import { decodeNudge, encodeNudge } from '../codec/schemas';

export const NUDGE_NOT_FOUND_MESSAGE = 'This nudge no longer exists.';

export class NudgeNotFoundError extends Error {
  constructor() {
    super(NUDGE_NOT_FOUND_MESSAGE);
    this.name = 'NudgeNotFoundError';
  }
}

function ref(db: Firestore, uid: string, id: string) {
  return doc(db, 'users', uid, 'nudges', id);
}

export async function fetchNudges(db: Firestore, uid: string): Promise<DecodedList<Nudge>> {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'nudges'), orderBy('created_at')),
  );
  return decodeList(snapshot.docs, decodeNudge);
}

/** Strict single read: a missing document is `NudgeNotFoundError`. */
export async function fetchNudge(db: Firestore, uid: string, id: string): Promise<Nudge> {
  const snapshot = await getDoc(ref(db, uid, id));
  if (!snapshot.exists()) throw new NudgeNotFoundError();
  return decodeNudge(snapshot.data());
}

export async function createNudge(db: Firestore, uid: string, nudge: Nudge): Promise<void> {
  await setDoc(ref(db, uid, nudge.id), encodeNudge(nudge));
}

async function applyThenRead(
  db: Firestore,
  uid: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<Nudge> {
  if (Object.keys(fields).length > 0) {
    try {
      await updateDoc(ref(db, uid, id), fields);
    } catch (error) {
      if ((error as { code?: string }).code === 'not-found') throw new NudgeNotFoundError();
      throw error;
    }
  }
  return fetchNudge(db, uid, id);
}

export function updateNudge(
  db: Firestore,
  uid: string,
  id: string,
  payload: NudgeUpdatePayload,
): Promise<Nudge> {
  return applyThenRead(db, uid, id, nudgeUpdate(payload));
}

/** `existingCompletionDates` is the array the caller holds; the firing instant is appended and the whole array written. */
export function markNudgeFired(
  db: Firestore,
  uid: string,
  id: string,
  existingCompletionDates: readonly Date[],
  now: Date,
): Promise<Nudge> {
  return applyThenRead(db, uid, id, nudgeFired(now, [...existingCompletionDates, now]));
}

export function unmarkNudgeFired(
  db: Firestore,
  uid: string,
  id: string,
  previousLastFiredAt: Date | undefined,
  previousCompletionDates: readonly Date[],
  now: Date,
): Promise<Nudge> {
  return applyThenRead(
    db,
    uid,
    id,
    nudgeUnfired(previousLastFiredAt, previousCompletionDates, now),
  );
}
