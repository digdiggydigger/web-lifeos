// Proves the emulator loads the REAL rules (verbatim copies of the iOS repo's): per-user
// isolation, the explicit collection allow-list, append-only logs, and the read-only catalog.
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { encodeLog, encodeTask, newId } from '@/data/codec';
import { firebase } from '@/data/firebase';

import { resetEmulators, signOutTestUser, signUpTestUser } from './support';

const denied = { code: 'permission-denied' };

describe('firestore.rules (copied from the iOS repo) in the emulator', () => {
  let ownerUid = '';
  const taskId = newId();

  beforeAll(async () => {
    await resetEmulators();
    ownerUid = await signUpTestUser('owner');
  });

  afterAll(async () => {
    await signOutTestUser();
  });

  it('lets the owner create and read a task in an allow-listed collection', async () => {
    const { db } = firebase();
    await setDoc(
      doc(db, `users/${ownerUid}/tasks/${taskId}`),
      encodeTask({
        id: taskId,
        title: 'Renew the passport',
        status: 'open',
        priority: 'p3',
        createdAt: new Date(),
      }),
    );
    const snapshot = await getDoc(doc(db, `users/${ownerUid}/tasks/${taskId}`));
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.get('title')).toBe('Renew the passport');
  });

  it('denies a collection name outside the allow-list', async () => {
    const { db } = firebase();
    await expect(
      setDoc(doc(db, `users/${ownerUid}/bogus/${newId()}`), { x: 1 }),
    ).rejects.toMatchObject(denied);
  });

  it('lets the owner create a log but never update it (append-only)', async () => {
    const { db } = firebase();
    const logId = newId();
    const ref = doc(db, `users/${ownerUid}/logs/${logId}`);
    await setDoc(
      ref,
      encodeLog({
        id: logId,
        type: 'log',
        body: 'Walked',
        entryDate: new Date(),
        createdAt: new Date(),
      }),
    );
    await expect(updateDoc(ref, { body: 'Ran' })).rejects.toMatchObject(denied);
  });

  it('lets any signed-in user read the catalog but never write it', async () => {
    const { db } = firebase();
    await expect(setDoc(doc(db, 'catalog/app_directory'), { entries: [] })).rejects.toMatchObject(
      denied,
    );
    const snapshot = await getDoc(doc(db, 'catalog/app_directory'));
    expect(snapshot.exists()).toBe(false);
  });

  it("blocks another user from reading or writing the owner's documents", async () => {
    await signOutTestUser();
    await signUpTestUser('intruder');
    const { db } = firebase();
    await expect(getDoc(doc(db, `users/${ownerUid}/tasks/${taskId}`))).rejects.toMatchObject(
      denied,
    );
    await expect(
      updateDoc(doc(db, `users/${ownerUid}/tasks/${taskId}`), { title: 'pwned' }),
    ).rejects.toMatchObject(denied);
  });
});
