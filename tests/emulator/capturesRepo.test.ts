import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newCapture, newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import {
  fetchCapture,
  fetchCaptures,
  fetchDeletedCaptures,
  fetchProcessedCaptures,
  fetchSeenCaptures,
  fetchUnprocessedCaptures,
  markCaptureProcessed,
  markCaptureUnprocessed,
  restoreCapture,
  saveCapture,
  softDeleteCapture,
  updateCapture,
  uploadCaptureMedia,
} from '@/data/repos/capturesRepo';
import { addTagToParent, createTagDeduplicating, fetchTagsForParent } from '@/data/repos/tagsRepo';
import { ItemIsDeletedError } from '@/domain/softDelete';

import { resetEmulators, signUpTestUser } from './support';

const note = (content: string, at: Date) =>
  newCapture(
    {
      content,
      kind: 'note',
      title: undefined,
      lifeAreaId: undefined,
      mediaKey: undefined,
      mediaContentType: undefined,
    },
    at,
    undefined,
  );

describe('capturesRepo', () => {
  let uid = '';
  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('captures');
  });

  it('saves the exact iOS key set and lists newest first, into the three slices', async () => {
    const { db } = firebase();
    const older = note('Older', new Date(2026, 7, 13, 9));
    const newer = note('Newer', new Date(2026, 7, 14, 9));
    await saveCapture(db, uid, older);
    await saveCapture(db, uid, newer);
    const raw = (await getDoc(doc(db, 'users', uid, 'captures', newer.id))).data()!;
    expect(Object.keys(raw).sort()).toEqual(['content', 'created_at', 'id', 'kind', 'processed']);
    expect(raw['created_at']).toBeInstanceOf(Timestamp);
    expect((await fetchCaptures(db, uid)).items.map((c) => c.content)).toEqual(['Newer', 'Older']);
    expect((await fetchUnprocessedCaptures(db, uid)).map((c) => c.content)).toEqual([
      'Newer',
      'Older',
    ]);
    expect(await fetchSeenCaptures(db, uid)).toEqual([]);
    expect(await fetchProcessedCaptures(db, uid)).toEqual([]);
  });

  it('sorting writes lifeAreaId + seen + clearedAt together; undo writes seen false and deletes clearedAt', async () => {
    const { db } = firebase();
    const area = newId();
    const c = note('Sort me', new Date());
    await saveCapture(db, uid, c);
    const sorted = await updateCapture(db, uid, c.id, {
      lifeAreaId: area,
      seen: true,
      clearedAt: new Date(),
    });
    expect(sorted.lifeAreaId).toBe(area);
    expect(sorted.seen).toBe(true);
    expect(sorted.clearedAt).toBeInstanceOf(Date);
    const raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw).not.toHaveProperty('life_area_id');
    expect(raw['clearedAt']).toBeInstanceOf(Timestamp);
    expect((await fetchSeenCaptures(db, uid)).map((x) => x.id)).toEqual([c.id]);
    expect((await fetchUnprocessedCaptures(db, uid)).map((x) => x.id)).not.toContain(c.id);

    const back = await updateCapture(db, uid, c.id, {
      lifeAreaId: null,
      seen: false,
      clearedAt: null,
    });
    expect(back.lifeAreaId).toBeUndefined();
    expect(back.seen).toBe(false);
    const rawBack = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(rawBack).not.toHaveProperty('clearedAt');
    expect(rawBack).not.toHaveProperty('lifeAreaId');
    expect(rawBack['seen']).toBe(false);
    expect((await fetchUnprocessedCaptures(db, uid)).map((x) => x.id)).toContain(c.id);
  });

  it('processed and clearedAt stay paired; unprocessed deletes the stamp; notes clear with a delete', async () => {
    const { db } = firebase();
    const c = note('Promote me', new Date());
    await saveCapture(db, uid, c);
    await markCaptureProcessed(db, uid, c.id, new Date());
    let raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw['processed']).toBe(true);
    expect(raw['clearedAt']).toBeInstanceOf(Timestamp);
    expect((await fetchProcessedCaptures(db, uid)).map((x) => x.id)).toEqual([c.id]);
    await markCaptureUnprocessed(db, uid, c.id);
    raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw['processed']).toBe(false);
    expect(raw).not.toHaveProperty('clearedAt');
    await updateCapture(db, uid, c.id, { notes: 'Read before Thursday' });
    expect((await fetchCapture(db, uid, c.id)).notes).toBe('Read before Thursday');
    await updateCapture(db, uid, c.id, { notes: null });
    raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw).not.toHaveProperty('notes');
  });

  it('soft delete hides from every list and the strict read; restore erases the key', async () => {
    const { db } = firebase();
    const c = note('Bin me', new Date());
    await saveCapture(db, uid, c);
    await softDeleteCapture(db, uid, c.id, new Date());
    expect((await fetchCaptures(db, uid)).items.map((x) => x.id)).not.toContain(c.id);
    expect((await fetchUnprocessedCaptures(db, uid)).map((x) => x.id)).not.toContain(c.id);
    expect((await fetchDeletedCaptures(db, uid)).items.map((x) => x.id)).toEqual([c.id]);
    await expect(fetchCapture(db, uid, c.id)).rejects.toBeInstanceOf(ItemIsDeletedError);
    await restoreCapture(db, uid, c.id);
    const raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw).not.toHaveProperty('deletedAt');
    expect((await fetchCapture(db, uid, c.id)).content).toBe('Bin me');
  });

  it('tags attach to captures through tag_ids', async () => {
    const { db } = firebase();
    const c = note('Tag me', new Date());
    await saveCapture(db, uid, c);
    const tag = await createTagDeduplicating(db, uid, 'errand');
    await addTagToParent(db, uid, 'captures', c.id, tag.id);
    expect((await fetchTagsForParent(db, uid, 'captures', c.id)).map((t) => t.name)).toEqual([
      'errand',
    ]);
    const raw = (await getDoc(doc(db, 'users', uid, 'captures', c.id))).data()!;
    expect(raw['tag_ids']).toEqual([tag.id]);
  });

  it('uploads photo media under the per-user path and returns a download URL', async () => {
    const { storage } = firebase();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    const uploaded = await uploadCaptureMedia(storage, uid, blob, 'image/jpeg');
    expect(uploaded.mediaKey).toMatch(new RegExp(`^users/${uid}/captures/[0-9a-f-]{36}\\.jpg$`));
    expect(uploaded.mediaURL).toContain(encodeURIComponent(uploaded.mediaKey));
  });
});
