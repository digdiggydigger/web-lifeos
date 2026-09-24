// Port of FirebaseManagerSeedTests against the emulator, through the real sign-up path.
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { FirebaseAuthClient } from '@/data/auth';
import { decodeLifeArea, decodeLog, decodeTag, decodeTask } from '@/data/codec';
import { firebase } from '@/data/firebase';
import { seedDefaultContentIfNeeded } from '@/data/seed';
import { live } from '@/domain/softDelete';

import { resetEmulators, signOutTestUser } from './support';

const client = new FirebaseAuthClient();
const password = 'correct horse battery staple';

async function signUpSeeded(label: string) {
  const email = `${label}-${Date.now()}@example.com`;
  const user = await client.signUp(email, password, 'E');
  return { ...user, email };
}

function under(uid: string, name: string) {
  return collection(firebase().db, 'users', uid, name);
}

async function areas(uid: string) {
  const snap = await getDocs(query(under(uid, 'life_areas'), orderBy('sort_order')));
  return snap.docs.map((d) => decodeLifeArea(d.data()));
}

describe('seedDefaultContentIfNeeded through sign-up', () => {
  let uid = '';
  let email = '';

  beforeAll(async () => {
    await resetEmulators();
    const user = await signUpSeeded('seed');
    uid = user.uid;
    email = user.email;
  });

  it('writes the six life areas in grid order with the emoji in the colour field', async () => {
    const list = await areas(uid);
    expect(list.map((a) => a.name)).toEqual([
      'Health',
      'Work',
      'Home',
      'Money',
      'Relationships',
      'Growth',
    ]);
    expect(list.map((a) => a.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(list.map((a) => a.colour)).toEqual(['🫀', '💼', '🏠', '💰', '💬', '🌱']);
  });

  it('writes the five baseline tags', async () => {
    const snap = await getDocs(query(under(uid, 'tags'), orderBy('name')));
    expect(snap.docs.map((d) => decodeTag(d.data()).name)).toEqual([
      'focus',
      'quick-win',
      'someday',
      'urgent',
      'waiting-on',
    ]);
  });

  it('writes the three starter tasks, filed and tagged like iOS, with created_at set', async () => {
    const snap = await getDocs(query(under(uid, 'tasks'), orderBy('created_at', 'desc')));
    const tasks = live(snap.docs.map((d) => decodeTask(d.data())));
    expect(tasks).toHaveLength(3);
    const byTitle = new Map(tasks.map((t) => [t.title, t]));
    const list = await areas(uid);
    const health = list.find((a) => a.name === 'Health')!;
    const growth = list.find((a) => a.name === 'Growth')!;
    const tagSnap = await getDocs(under(uid, 'tags'));
    const quickWin = tagSnap.docs
      .map((d) => decodeTag(d.data()))
      .find((t) => t.name === 'quick-win')!;

    expect(byTitle.get('Take a 10-minute walk')?.lifeAreaId).toBe(health.id);
    expect(byTitle.get('Check off your first task')?.lifeAreaId).toBe(growth.id);
    expect(byTitle.get('Check off your first task')?.tagIds).toEqual([quickWin.id]);
    expect(byTitle.get('Take a 10-minute walk')?.tagIds).toBeUndefined();
    expect(byTitle.get('Capture three things on your mind')?.lifeAreaId).toBeUndefined();

    const walkDue = byTitle.get('Take a 10-minute walk')?.dueDate;
    expect(walkDue).toBeInstanceOf(Date);
    expect(walkDue!.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(byTitle.get('Check off your first task')?.dueDate).toBeUndefined();
    expect(tasks.every((t) => t.createdAt instanceof Date)).toBe(true);
  });

  it('writes one welcome journal entry', async () => {
    const snap = await getDocs(under(uid, 'logs'));
    const logs = snap.docs.map((d) => decodeLog(d.data()));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.type).toBe('journal');
    expect(logs[0]?.body).toMatch(/Welcome to ADHD LifeOS/);
  });

  it('writes the profile with email, created_at, display_name and the seeded_at marker', async () => {
    const profile = await getDoc(doc(firebase().db, 'users', uid));
    expect(profile.get('email')).toBe(email);
    expect(profile.get('display_name')).toBe('E');
    expect(profile.get('created_at')).toBeDefined();
    expect(profile.get('seeded_at')).toBeDefined();
  });

  it('on a second sign-in writes nothing further, and called repeatedly is a no-op', async () => {
    await signOutTestUser();
    await client.signIn(email, password);
    expect(await seedDefaultContentIfNeeded(firebase().db, uid)).toBe('already-seeded');
    expect(await seedDefaultContentIfNeeded(firebase().db, uid)).toBe('already-seeded');
    expect(await areas(uid)).toHaveLength(6);
    expect((await getDocs(under(uid, 'tasks'))).size).toBe(3);
  });

  it('after the user deletes their life areas, does not restore them', async () => {
    for (const area of await areas(uid)) {
      await deleteDoc(doc(under(uid, 'life_areas'), area.id));
    }
    expect(await seedDefaultContentIfNeeded(firebase().db, uid)).toBe('already-seeded');
    expect(await areas(uid)).toHaveLength(0);
  });

  it('writes only the marker for an account that already has life areas but no marker', async () => {
    await signOutTestUser();
    const other = await client.signUp(`legacy-${Date.now()}@example.com`, password, undefined);
    // Simulate a pre-marker account: drop the marker but keep the content.
    const { db } = firebase();
    await updateDoc(doc(db, 'users', other.uid), { seeded_at: deleteField() });
    expect(await seedDefaultContentIfNeeded(db, other.uid)).toBe('marker-only');
    expect(await areas(other.uid)).toHaveLength(6);
    expect((await getDoc(doc(db, 'users', other.uid))).get('seeded_at')).toBeDefined();
  });

  it('when signed out, seeding is refused by the rules', async () => {
    await signOutTestUser();
    await expect(seedDefaultContentIfNeeded(firebase().db, uid)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});
