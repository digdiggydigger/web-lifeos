import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newCapture, newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import { saveCapture, softDeleteCapture } from '@/data/repos/capturesRepo';
import {
  addTagToParent,
  createTagDeduplicating,
  fetchTags,
  softDeleteTag,
} from '@/data/repos/tagsRepo';
import { createTask, fetchTasks, softDeleteTask } from '@/data/repos/tasksRepo';
import { firebaseRecentlyDeletedClient } from '@/features/recentlyDeleted/recentlyDeletedClient';

import { resetEmulators, signUpTestUser } from './support';

describe('recentlyDeleted client', () => {
  let uid = '';
  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('deleted');
  });

  it('lists deleted tasks, captures and tags as one list, restores and deletes forever by kind', async () => {
    const { db } = firebase();
    const client = firebaseRecentlyDeletedClient(db, uid);
    const taskId = newId();
    await createTask(db, uid, {
      id: taskId,
      title: 'Ring the dentist',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(),
    });
    await createTask(db, uid, {
      id: newId(),
      title: 'Still here',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(),
    });
    await softDeleteTask(db, uid, taskId, new Date());
    const capture = newCapture(
      {
        content: 'Idle thought',
        kind: 'note',
        title: undefined,
        lifeAreaId: undefined,
        mediaKey: undefined,
        mediaContentType: undefined,
      },
      new Date(),
      undefined,
    );
    await saveCapture(db, uid, capture);
    await softDeleteCapture(db, uid, capture.id, new Date());
    const someday = await createTagDeduplicating(db, uid, 'someday');
    await softDeleteTag(db, uid, someday.id, new Date());

    const items = await client.fetchDeleted();
    expect(items.map((i) => [i.kind, i.title]).sort()).toEqual([
      ['capture', 'Idle thought'],
      ['tag', 'someday'],
      ['task', 'Ring the dentist'],
    ]);
    expect(items.find((i) => i.kind === 'tag')?.collision).toBeUndefined();

    await client.restore(items.find((i) => i.kind === 'task')!);
    expect((await fetchTasks(db, uid)).items.map((t) => t.title).sort()).toEqual([
      'Ring the dentist',
      'Still here',
    ]);
    await client.deleteForever(items.find((i) => i.kind === 'capture')!);
    expect((await getDoc(doc(db, 'users', uid, 'captures', capture.id))).exists()).toBe(false);
    await client.deleteForever(items.find((i) => i.kind === 'tag')!);
    expect((await getDoc(doc(db, 'users', uid, 'tags', someday.id))).exists()).toBe(false);
    expect(await client.fetchDeleted()).toEqual([]);
  });

  it('a deleted tag whose name was taken again carries the collision; restoring merges either way', async () => {
    const { db } = firebase();
    const client = firebaseRecentlyDeletedClient(db, uid);
    const taskA = newId();
    const taskB = newId();
    await createTask(db, uid, {
      id: taskA,
      title: 'A',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(),
    });
    await createTask(db, uid, {
      id: taskB,
      title: 'B',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(),
    });

    // Keep the restored spelling: the live tag is absorbed into the survivor.
    const errand = await createTagDeduplicating(db, uid, 'errand');
    await addTagToParent(db, uid, 'tasks', taskA, errand.id);
    await softDeleteTag(db, uid, errand.id, new Date());
    const liveErrand = await createTagDeduplicating(db, uid, 'Errand');
    expect(liveErrand.id).not.toBe(errand.id);
    await addTagToParent(db, uid, 'tasks', taskB, liveErrand.id);
    let item = (await client.fetchDeleted()).find((i) => i.itemId === errand.id)!;
    expect(item.collision).toEqual({ liveId: liveErrand.id, liveName: 'Errand' });
    await client.restoreResolving(item, true);
    expect((await fetchTags(db, uid)).items.map((t) => t.name)).toEqual(['errand']);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskB))).get('tag_ids')).toEqual([
      errand.id,
    ]);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskA))).get('tag_ids')).toEqual([
      errand.id,
    ]);

    // Keep the live spelling: the restored tag is absorbed into the live one.
    const focus = await createTagDeduplicating(db, uid, 'focus');
    await addTagToParent(db, uid, 'tasks', taskA, focus.id);
    await softDeleteTag(db, uid, focus.id, new Date());
    const liveFocus = await createTagDeduplicating(db, uid, 'Focus');
    item = (await client.fetchDeleted()).find((i) => i.itemId === focus.id)!;
    await client.restoreResolving(item, false);
    expect((await fetchTags(db, uid)).items.map((t) => t.name).sort()).toEqual(['Focus', 'errand']);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskA))).get('tag_ids')).toEqual([
      errand.id,
      liveFocus.id,
    ]);
    expect((await getDoc(doc(db, 'users', uid, 'tags', focus.id))).exists()).toBe(false);
  });
});
