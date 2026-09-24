/**
 * `FirebaseManager+AccountDeletion.swift` `deleteAllUserData`: every per-user collection in batches
 * of 500, the capture media, then the profile document (so the seed marker goes with it).
 */
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { deleteObject, listAll, ref } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

/** The iOS `Collection.allCases`, verbatim. */
export const USER_COLLECTIONS: readonly string[] = [
  'tasks',
  'life_areas',
  'logs',
  'captures',
  'tags',
  'nudges',
  'reminders',
  'focus_sessions',
  'places',
  'location_events',
  'routine_runs',
];

async function deleteAllDocuments(db: Firestore, uid: string, name: string): Promise<void> {
  const snapshot = await getDocs(collection(db, 'users', uid, name));
  const references = snapshot.docs.map((d) => d.ref);
  for (let start = 0; start < references.length; start += 500) {
    const batch = writeBatch(db);
    for (const reference of references.slice(start, start + 500)) batch.delete(reference);
    await batch.commit();
  }
}

async function deleteCaptureMedia(storage: FirebaseStorage, uid: string): Promise<void> {
  try {
    const listing = await listAll(ref(storage, `users/${uid}/captures`));
    for (const item of listing.items) {
      try {
        await deleteObject(item);
      } catch {
        // best effort, as on iOS
      }
    }
  } catch {
    // no media folder yet
  }
}

export async function deleteAllUserData(
  db: Firestore,
  storage: FirebaseStorage,
  uid: string,
): Promise<void> {
  for (const name of USER_COLLECTIONS) await deleteAllDocuments(db, uid, name);
  await deleteCaptureMedia(storage, uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
}
