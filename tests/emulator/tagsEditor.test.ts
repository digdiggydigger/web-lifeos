// Ports of FirebaseTagEditorClientAdapterTests and the FirebaseManagerTagsTests merge/purge cases.
import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import {
  addTagToParent,
  createTag,
  fetchDeletedTags,
  fetchTags,
  fetchTagsWithUsage,
  mergeTagInto,
  purgeTag,
  renameTag,
  restoreTag,
  softDeleteTag,
} from '@/data/repos/tagsRepo';
import { createTask } from '@/data/repos/tasksRepo';

import { resetEmulators, signUpTestUser } from './support';

describe('tag editor writes', () => {
  let uid = '';
  const taskA = newId();
  const taskB = newId();
  let errand = '';
  let chores = '';

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('tags-editor');
    const { db } = firebase();
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
    const e = await createTag(db, uid, 'errand');
    const c = await createTag(db, uid, 'chores');
    errand = e.tag.id;
    chores = c.tag.id;
    await addTagToParent(db, uid, 'tasks', taskA, errand);
    await addTagToParent(db, uid, 'tasks', taskB, errand);
    await addTagToParent(db, uid, 'tasks', taskB, chores);
  });

  it('joins usage counts, and create with an existing name returns it without writing', async () => {
    const { db } = firebase();
    const withUsage = await fetchTagsWithUsage(db, uid);
    expect(withUsage.map((t) => [t.name, t.usageCount])).toEqual([
      ['chores', 1],
      ['errand', 2],
    ]);
    const again = await createTag(db, uid, 'ERRAND');
    expect(again).toMatchObject({ kind: 'alreadyExisted', tag: { id: errand, usageCount: 2 } });
    expect((await fetchTags(db, uid)).items).toHaveLength(2);
  });

  it('rename to a free name renames; onto another tag needs a merge with its usage; a case-only self-rename goes through', async () => {
    const { db } = firebase();
    expect(await renameTag(db, uid, errand, 'Errands')).toEqual({ kind: 'renamed' });
    expect(await renameTag(db, uid, errand, 'CHORES')).toEqual({
      kind: 'needsMerge',
      id: chores,
      name: 'chores',
      usageCount: 1,
    });
    expect(await renameTag(db, uid, errand, 'errands')).toEqual({ kind: 'renamed' });
  });

  it('merge rewrites every reference to the target once and deletes the absorbed tag; merging into itself or a missing name fails', async () => {
    const { db } = firebase();
    await expect(mergeTagInto(db, uid, errand, 'errands')).rejects.toThrow(/no other tag/);
    await expect(mergeTagInto(db, uid, errand, 'nope')).rejects.toThrow(/no other tag/);
    await mergeTagInto(db, uid, errand, 'chores');
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskA))).get('tag_ids')).toEqual([chores]);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskB))).get('tag_ids')).toEqual([chores]);
    expect((await fetchTags(db, uid)).items.map((t) => t.id)).toEqual([chores]);
  });

  it('soft delete stamps and cascades nothing; restore erases the stamp; purge strips links and deletes', async () => {
    const { db } = firebase();
    await softDeleteTag(db, uid, chores, new Date());
    expect((await fetchTags(db, uid)).items).toEqual([]);
    expect((await fetchDeletedTags(db, uid)).items.map((t) => t.id)).toEqual([chores]);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskB))).get('tag_ids')).toEqual([chores]);
    await restoreTag(db, uid, chores);
    expect((await getDoc(doc(db, 'users', uid, 'tags', chores))).data()).not.toHaveProperty(
      'deleted_at',
    );
    await purgeTag(db, uid, chores);
    expect((await getDoc(doc(db, 'users', uid, 'tasks', taskB))).get('tag_ids')).toEqual([]);
    expect((await getDoc(doc(db, 'users', uid, 'tags', chores))).exists()).toBe(false);
  });
});
