/** `captures` (`FirebaseManager+Captures.swift`, `FirebaseCaptureClientAdapter`, `+Storage`). Writes go through the payload builders only. */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

import { deleted, live, requireLive } from '@/domain/softDelete';
import type { Capture } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { newId } from '../codec/ids';
import {
  captureProcessed,
  captureRestore,
  captureSoftDelete,
  captureUnprocessed,
  captureUpdate,
} from '../codec/payloads/captures';
import type { CaptureUpdate } from '../codec/payloads/captures';
import { decodeCapture, encodeCapture } from '../codec/schemas';

function capturesCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'captures');
}

function captureDoc(db: Firestore, uid: string, id: string) {
  return doc(db, 'users', uid, 'captures', id);
}

const newestFirst = (a: Capture, b: Capture) => b.createdAt.getTime() - a.createdAt.getTime();

/** Every live capture, newest first (soft-deleted ones are filtered client-side, as on iOS). */
export async function fetchCaptures(db: Firestore, uid: string): Promise<DecodedList<Capture>> {
  const snapshot = await getDocs(query(capturesCollection(db, uid), orderBy('created_at', 'desc')));
  const list = decodeList(snapshot.docs, decodeCapture);
  return { items: live(list.items), skipped: list.skipped };
}

export async function fetchDeletedCaptures(
  db: Firestore,
  uid: string,
): Promise<DecodedList<Capture>> {
  const snapshot = await getDocs(query(capturesCollection(db, uid), orderBy('created_at', 'desc')));
  const list = decodeList(snapshot.docs, decodeCapture);
  return { items: deleted(list.items), skipped: list.skipped };
}

async function fetchWhere(
  db: Firestore,
  uid: string,
  field: string,
  equals: boolean,
): Promise<Capture[]> {
  const snapshot = await getDocs(query(capturesCollection(db, uid), where(field, '==', equals)));
  return live(decodeList(snapshot.docs, decodeCapture).items).sort(newestFirst);
}

/** "To triage": unprocessed and not yet sorted. */
export async function fetchUnprocessedCaptures(db: Firestore, uid: string): Promise<Capture[]> {
  return (await fetchWhere(db, uid, 'processed', false)).filter((c) => c.seen !== true);
}

/** "Promoted": processed (task or journal entry made). */
export async function fetchProcessedCaptures(db: Firestore, uid: string): Promise<Capture[]> {
  return fetchWhere(db, uid, 'processed', true);
}

/** "Sorted": seen and still unprocessed. */
export async function fetchSeenCaptures(db: Firestore, uid: string): Promise<Capture[]> {
  return (await fetchWhere(db, uid, 'seen', true)).filter((c) => !c.processed);
}

export class CaptureNotFoundError extends Error {
  constructor(id: string) {
    super(`No capture ${id}`);
    this.name = 'CaptureNotFoundError';
  }
}

/** Strict single read; throws `ItemIsDeletedError` for a soft-deleted capture. */
export async function fetchCapture(db: Firestore, uid: string, id: string): Promise<Capture> {
  const snapshot = await getDoc(captureDoc(db, uid, id));
  if (!snapshot.exists()) throw new CaptureNotFoundError(id);
  return requireLive(decodeCapture(snapshot.data()));
}

/** `saveCapture`: a full-document write; `tag_ids` is never part of it. */
export async function saveCapture(db: Firestore, uid: string, capture: Capture): Promise<void> {
  await setDoc(captureDoc(db, uid, capture.id), encodeCapture(capture));
}

export async function updateCapture(
  db: Firestore,
  uid: string,
  id: string,
  changes: CaptureUpdate,
): Promise<Capture> {
  const fields = captureUpdate(changes);
  if (Object.keys(fields).length > 0) await updateDoc(captureDoc(db, uid, id), fields);
  return fetchCapture(db, uid, id);
}

export async function markCaptureProcessed(
  db: Firestore,
  uid: string,
  id: string,
  now: Date,
): Promise<void> {
  await updateDoc(captureDoc(db, uid, id), captureProcessed(now));
}

export async function markCaptureUnprocessed(
  db: Firestore,
  uid: string,
  id: string,
): Promise<void> {
  await updateDoc(captureDoc(db, uid, id), captureUnprocessed());
}

export async function softDeleteCapture(
  db: Firestore,
  uid: string,
  id: string,
  now: Date,
): Promise<void> {
  await updateDoc(captureDoc(db, uid, id), captureSoftDelete(now));
}

export async function restoreCapture(db: Firestore, uid: string, id: string): Promise<void> {
  await updateDoc(captureDoc(db, uid, id), captureRestore());
}

/** The irreversible one: the launch purge and "Delete forever" only. */
export async function hardDeleteCapture(db: Firestore, uid: string, id: string): Promise<void> {
  await deleteDoc(captureDoc(db, uid, id));
}

// MARK: - Storage (`FirebaseManager+Storage.swift`)

export const PHOTO_CONTENT_TYPE = 'image/jpeg';

function fileExtension(contentType: string): string {
  const subtype = contentType.split('/').pop();
  if (!subtype) return 'bin';
  return subtype === 'jpeg' ? 'jpg' : subtype;
}

/** `users/{uid}/captures/{lowercase-uuid}.{ext}`, the path both clients read. */
export function mediaKey(uid: string, contentType: string): string {
  return `users/${uid}/captures/${newId().toLowerCase()}.${fileExtension(contentType)}`;
}

export interface UploadedMedia {
  readonly mediaKey: string;
  readonly mediaURL: string;
}

/** Uploads under the per-user path and returns the permanent download URL stored as `mediaURL`. */
export async function uploadCaptureMedia(
  storage: FirebaseStorage,
  uid: string,
  data: Blob,
  contentType: string,
): Promise<UploadedMedia> {
  const key = mediaKey(uid, contentType);
  const reference = ref(storage, key);
  await uploadBytes(reference, data, { contentType });
  return { mediaKey: key, mediaURL: await getDownloadURL(reference) };
}
