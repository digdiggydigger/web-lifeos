import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import {
  addTagToParent,
  createTagDeduplicating,
  fetchTags,
  fetchTagsForParent,
  removeTagFromParent,
} from '@/data/repos/tagsRepo';
import { createTask } from '@/data/repos/tasksRepo';

import { resetEmulators, signUpTestUser } from './support';

describe('tagsRepo', () => {
  let uid = '';
  const taskId = newId();

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('tags');
    await createTask(firebase().db, uid, {
      id: taskId,
      title: 'T',
      status: 'open',
      priority: 'p4',
      createdAt: new Date(),
    });
  });

  it('dedups case-insensitively on create and lists by name', async () => {
    const { db } = firebase();
    const errand = await createTagDeduplicating(db, uid, 'Errand');
    const again = await createTagDeduplicating(db, uid, 'errand');
    expect(again.id).toBe(errand.id);
    await createTagDeduplicating(db, uid, 'Admin');
    expect((await fetchTags(db, uid)).items.map((t) => t.name)).toEqual(['Admin', 'Errand']);
  });

  it("adds and removes membership via tag_ids, and resolves a parent's tags dropping unknown ids", async () => {
    const { db } = firebase();
    const errand = await createTagDeduplicating(db, uid, 'Errand');
    await addTagToParent(db, uid, 'tasks', taskId, errand.id);
    await addTagToParent(db, uid, 'tasks', taskId, newId()); // an id no live tag has
    let raw = (await getDoc(doc(db, 'users', uid, 'tasks', taskId))).data()!;
    expect(raw['tag_ids']).toHaveLength(2);
    expect(raw).not.toHaveProperty('tagIds');
    expect((await fetchTagsForParent(db, uid, 'tasks', taskId)).map((t) => t.name)).toEqual([
      'Errand',
    ]);

    await removeTagFromParent(db, uid, 'tasks', taskId, errand.id);
    raw = (await getDoc(doc(db, 'users', uid, 'tasks', taskId))).data()!;
    expect(raw['tag_ids']).toHaveLength(1);
    expect(await fetchTagsForParent(db, uid, 'tasks', taskId)).toEqual([]);
  });
});
