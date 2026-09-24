/**
 * `tags` (`FirebaseManager+Tags.swift`), the subset Tasks needs: the live list, a task's tags,
 * case-insensitive dedup on create, and membership writes. The editor's merge/purge is M1.2/M1.5.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { live } from '@/domain/softDelete';
import type { Tag } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { newId } from '../codec/ids';
import { tagIdsRemove, tagIdsUnion } from '../codec/payloads/tags';
import { decodeTag, encodeTag, idList } from '../codec/schemas';

export type TagParent = 'tasks' | 'captures';

function tagsCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'tags');
}

/** `fetchTags`: live tags ordered by name. */
export async function fetchTags(db: Firestore, uid: string): Promise<DecodedList<Tag>> {
  const snapshot = await getDocs(query(tagsCollection(db, uid), orderBy('name')));
  const list = decodeList(snapshot.docs, decodeTag);
  return { items: live(list.items), skipped: list.skipped };
}

/** `fetchTags(for:parentId:)`: the parent's `tag_ids` resolved against live tags; unknown ids dropped. */
export async function fetchTagsForParent(
  db: Firestore,
  uid: string,
  parent: TagParent,
  parentId: string,
): Promise<Tag[]> {
  const snapshot = await getDoc(doc(db, 'users', uid, parent, parentId));
  const parsed = idList.safeParse(snapshot.get('tag_ids'));
  if (!parsed.success || parsed.data.length === 0) return [];
  const wanted = new Set(parsed.data);
  const { items } = await fetchTags(db, uid);
  return items.filter((tag) => wanted.has(tag.id));
}

/** `createTagDeduplicating`: an existing live tag matched case-insensitively wins; otherwise a new document. */
export async function createTagDeduplicating(
  db: Firestore,
  uid: string,
  name: string,
): Promise<Tag> {
  const wanted = name.toLocaleLowerCase();
  const { items } = await fetchTags(db, uid);
  const existing = items.find((tag) => tag.name.toLocaleLowerCase() === wanted);
  if (existing) return existing;
  const tag: Tag = { id: newId(), name };
  await setDoc(doc(tagsCollection(db, uid), tag.id), encodeTag(tag));
  return tag;
}

export async function addTagToParent(
  db: Firestore,
  uid: string,
  parent: TagParent,
  parentId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, parent, parentId), tagIdsUnion(tagId));
}

export async function removeTagFromParent(
  db: Firestore,
  uid: string,
  parent: TagParent,
  parentId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, parent, parentId), tagIdsRemove(tagId));
}
