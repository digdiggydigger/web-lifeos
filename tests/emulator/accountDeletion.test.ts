import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { FirebaseAuthClient } from '@/data/auth';
import { firebase } from '@/data/firebase';
import { deleteAllUserData, USER_COLLECTIONS } from '@/data/repos/accountDeletionRepo';
import { seedDefaultContentIfNeeded } from '@/data/seed';

import { resetEmulators, signUpTestUser } from './support';

describe('account deletion', () => {
  let uid = '';
  const password = 'correct horse battery staple';
  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('deletion');
  });

  it('empties every per-user collection (logs included), clears the seed marker so the account can seed again', async () => {
    const { db, storage } = firebase();
    expect(await seedDefaultContentIfNeeded(db, uid)).toBe('seeded');
    expect((await getDocs(collection(db, 'users', uid, 'life_areas'))).size).toBe(6);
    expect((await getDocs(collection(db, 'users', uid, 'logs'))).size).toBe(1);

    await deleteAllUserData(db, storage, uid);
    for (const name of USER_COLLECTIONS) {
      expect(
        (await getDocs(collection(db, 'users', uid, name))).size,
        `${name} survived the cascade`,
      ).toBe(0);
    }
    expect((await getDoc(doc(db, 'users', uid))).exists()).toBe(false);
    expect(await seedDefaultContentIfNeeded(db, uid)).toBe('seeded');
    expect((await getDocs(collection(db, 'users', uid, 'life_areas'))).size).toBe(6);
  });

  it('a wrong password fails reauthentication, the right one passes, and deleting the user ends the session', async () => {
    const { auth } = firebase();
    const client = new FirebaseAuthClient();
    expect(client.reauthMethod()).toBe('password');
    await expect(client.reauthenticateWithPassword('wrong')).rejects.toBeTruthy();
    await client.reauthenticateWithPassword(password);
    const email = auth.currentUser?.email ?? '';
    await client.deleteAuthUser();
    expect(auth.currentUser).toBeNull();
    expect(client.reauthMethod()).toBeUndefined();
    await expect(signInWithEmailAndPassword(auth, email, password)).rejects.toBeTruthy();
  });
});
