// Ports of FirebaseTasksClientAdapterTests / FirebaseTaskCreateClientAdapterTests /
// FirebaseTaskDetailClientAdapterTests, plus raw read-backs of the key sets iOS decodes.
import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import {
  createTask,
  fetchDeletedTasks,
  fetchOpenTasks,
  fetchTask,
  fetchTasks,
  restoreTask,
  setTaskStatus,
  softDeleteTask,
  updateTask,
} from '@/data/repos/tasksRepo';
import { ItemIsDeletedError } from '@/domain/softDelete';

import { resetEmulators, signUpTestUser } from './support';

const now = new Date('2026-09-24T09:00:00Z');

describe('tasksRepo', () => {
  let uid = '';
  const first = newId();
  const second = newId();

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('tasks');
    const { db } = firebase();
    await createTask(db, uid, {
      id: first,
      title: 'First',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(now.getTime() - 1000),
    });
    await createTask(db, uid, {
      id: second,
      title: 'Second',
      status: 'open',
      priority: 'p3',
      createdAt: now,
      notes: 'n',
    });
  });

  it('create writes exactly the iOS key set, snake_cased, with created_at and no tag_ids', async () => {
    const raw = (await getDoc(doc(firebase().db, 'users', uid, 'tasks', second))).data()!;
    expect(Object.keys(raw).sort()).toEqual([
      'created_at',
      'id',
      'notes',
      'priority',
      'status',
      'title',
    ]);
    expect(raw['id']).toBe(second);
  });

  it('lists newest first and open-only', async () => {
    const { db } = firebase();
    expect((await fetchTasks(db, uid)).items.map((t) => t.title)).toEqual(['Second', 'First']);
    expect((await fetchOpenTasks(db, uid)).items).toHaveLength(2);
  });

  it('closing writes the five-key paired payload and reopening deletes the stamp and trio', async () => {
    const { db } = firebase();
    const ref = doc(db, 'users', uid, 'tasks', first);
    await setTaskStatus(db, uid, first, 'done', now);
    let raw = (await getDoc(ref)).data()!;
    expect(raw['status']).toBe('done');
    expect(raw['completed_at']).toBeDefined();
    expect(raw).not.toHaveProperty('completedAt');
    expect(raw).not.toHaveProperty('place_id');
    expect((await fetchTask(db, uid, first)).completedAt).toEqual(now);

    await setTaskStatus(db, uid, first, 'open', now);
    raw = (await getDoc(ref)).data()!;
    expect(raw['status']).toBe('open');
    expect(raw).not.toHaveProperty('completed_at');
  });

  it('updates with the delta convention and re-reads; an empty payload writes nothing', async () => {
    const { db } = firebase();
    const updated = await updateTask(db, uid, second, {
      title: 'Second!',
      notes: null,
      priority: 'p1',
    });
    expect(updated.title).toBe('Second!');
    expect(updated.notes).toBeUndefined();
    expect(updated.priority).toBe('p1');
    const raw = (await getDoc(doc(db, 'users', uid, 'tasks', second))).data()!;
    expect(raw).not.toHaveProperty('notes');
    expect(await updateTask(db, uid, second, {})).toEqual(updated);
  });

  it('soft delete hides the task, the detail read refuses it, restore erases the stamp', async () => {
    const { db } = firebase();
    await softDeleteTask(db, uid, first, now);
    expect((await fetchTasks(db, uid)).items.map((t) => t.id)).toEqual([second]);
    expect((await fetchDeletedTasks(db, uid)).items.map((t) => t.id)).toEqual([first]);
    await expect(fetchTask(db, uid, first)).rejects.toBeInstanceOf(ItemIsDeletedError);
    let raw = (await getDoc(doc(db, 'users', uid, 'tasks', first))).data()!;
    expect(raw['deleted_at']).toBeDefined();
    expect(raw).not.toHaveProperty('deletedAt');

    await restoreTask(db, uid, first);
    raw = (await getDoc(doc(db, 'users', uid, 'tasks', first))).data()!;
    expect(raw).not.toHaveProperty('deleted_at');
    expect((await fetchTasks(db, uid)).items).toHaveLength(2);
  });
});
