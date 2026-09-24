/**
 * First-login starter content (`FirebaseManager+Seed.swift`), written in ONE batch with the
 * `seeded_at` marker last. Idempotent two ways: the marker short-circuits every later call, and
 * an account that already has life areas (predating the marker) gets the marker only.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { buildSeedContent } from '@/domain/seed';

import { newId } from './codec/ids';
import { encodeLifeArea, encodeLog, encodeTag, encodeTask } from './codec/schemas';
import { profileDoc } from './repos/profileRepo';

export type SeedOutcome = 'already-seeded' | 'marker-only' | 'seeded';

const inFlight = new Map<string, Promise<SeedOutcome>>();

/** Runs at most once at a time per uid, so React StrictMode's double effects cannot double-seed. */
export function seedDefaultContentIfNeeded(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): Promise<SeedOutcome> {
  const pending = inFlight.get(uid);
  if (pending) return pending;
  const run = seedOnce(db, uid, now).finally(() => {
    inFlight.delete(uid);
  });
  inFlight.set(uid, run);
  return run;
}

async function seedOnce(db: Firestore, uid: string, now: () => Date): Promise<SeedOutcome> {
  const profile = await getDoc(profileDoc(db, uid));
  if (profile.exists() && profile.get('seeded_at') !== undefined) return 'already-seeded';

  const existingAreas = await getDocs(collection(db, 'users', uid, 'life_areas'));
  if (!existingAreas.empty) {
    await setDoc(profileDoc(db, uid), { seeded_at: serverTimestamp() }, { merge: true });
    return 'marker-only';
  }

  const content = buildSeedContent(now(), newId);
  const batch = writeBatch(db);
  const under = (name: string, id: string) => doc(db, 'users', uid, name, id);
  for (const area of content.areas) batch.set(under('life_areas', area.id), encodeLifeArea(area));
  for (const tag of content.tags) batch.set(under('tags', tag.id), encodeTag(tag));
  for (const task of content.tasks) {
    const data = encodeTask(task);
    if (task.tagIds.length > 0) data['tag_ids'] = [...task.tagIds];
    batch.set(under('tasks', task.id), data);
  }
  batch.set(under('logs', content.welcome.id), encodeLog(content.welcome));
  batch.set(profileDoc(db, uid), { seeded_at: serverTimestamp() }, { merge: true });
  await batch.commit();
  return 'seeded';
}
