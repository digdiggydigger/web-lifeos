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
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { deleted, live } from '@/domain/softDelete';
import { noOtherTagError } from '@/domain/tags/tagEditor';
import type { Tag } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { newId } from '../codec/ids';
import {
  tagIdsRemove,
  tagIdsUnion,
  tagRename,
  tagRestore,
  tagSoftDelete,
} from '../codec/payloads/tags';
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

// MARK: - The Tag Editor (`TagEditorClientAdapting` + the rest of `FirebaseManager+Tags`)

/** `fetchTag(named:)`: the first LIVE tag whose name matches case-insensitively; no trimming. */
export async function fetchTagNamed(
  db: Firestore,
  uid: string,
  name: string,
): Promise<Tag | undefined> {
  const wanted = name.toLocaleLowerCase();
  return (await fetchTags(db, uid)).items.find((t) => t.name.toLocaleLowerCase() === wanted);
}

/** `tagUsageCounts`: every `tag_ids` entry on every task and capture document, soft-deleted parents included. */
export async function tagUsageCounts(db: Firestore, uid: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const parent of ['tasks', 'captures'] as const) {
    const snapshot = await getDocs(collection(db, 'users', uid, parent));
    for (const document of snapshot.docs) {
      const parsed = idList.safeParse(document.get('tag_ids'));
      if (!parsed.success) continue;
      for (const id of parsed.data) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export interface TagWithUsage extends Tag {
  readonly usageCount: number;
}

export async function fetchTagsWithUsage(db: Firestore, uid: string): Promise<TagWithUsage[]> {
  const [{ items }, counts] = await Promise.all([fetchTags(db, uid), tagUsageCounts(db, uid)]);
  return items.map((tag) => ({ ...tag, usageCount: counts.get(tag.id) ?? 0 }));
}

export type TagRenameResult =
  | { readonly kind: 'renamed' }
  | {
      readonly kind: 'needsMerge';
      readonly id: string;
      readonly name: string;
      readonly usageCount: number;
    };

/** A rename onto another live tag's name (case-insensitively) needs a merge; a case-only rename of itself goes through. */
export async function renameTag(
  db: Firestore,
  uid: string,
  id: string,
  name: string,
): Promise<TagRenameResult> {
  const other = await fetchTagNamed(db, uid, name);
  if (other && other.id !== id) {
    const counts = await tagUsageCounts(db, uid);
    return {
      kind: 'needsMerge',
      id: other.id,
      name: other.name,
      usageCount: counts.get(other.id) ?? 0,
    };
  }
  await updateDoc(doc(tagsCollection(db, uid), id), tagRename(name));
  return { kind: 'renamed' };
}

/** `removeTagEverywhere`: one batch that rewrites every parent's `tag_ids` (dropping the id, adding the replacement once) and deletes the tag. */
export async function removeTagEverywhere(
  db: Firestore,
  uid: string,
  tagId: string,
  replacementId?: string,
): Promise<void> {
  const batch = writeBatch(db);
  for (const parent of ['tasks', 'captures'] as const) {
    const snapshot = await getDocs(
      query(collection(db, 'users', uid, parent), where('tag_ids', 'array-contains', tagId)),
    );
    for (const document of snapshot.docs) {
      const parsed = idList.safeParse(document.get('tag_ids'));
      const current = parsed.success ? parsed.data : [];
      const next = current.filter((x) => x !== tagId);
      if (replacementId && !next.includes(replacementId)) next.push(replacementId);
      batch.update(document.ref, { tag_ids: next });
    }
  }
  batch.delete(doc(tagsCollection(db, uid), tagId));
  await batch.commit();
}

/** `mergeTagInto(_:replacement:)` by id: every reference to `id` becomes `replacementId`, then `id` is deleted. */
export async function mergeTagIntoId(
  db: Firestore,
  uid: string,
  id: string,
  replacementId: string,
): Promise<void> {
  await removeTagEverywhere(db, uid, id, replacementId);
}

/**
 * `mergeTagsRestoring(survivor:absorbed:)`: restoring a deleted tag whose name a live tag took,
 * keeping the RESTORED spelling. One batch: every reference to the live tag is rewritten to the
 * survivor, the live tag is deleted, and the survivor's stamp is erased.
 */
export async function mergeTagsRestoring(
  db: Firestore,
  uid: string,
  survivorId: string,
  absorbedId: string,
): Promise<void> {
  const batch = writeBatch(db);
  for (const parent of ['tasks', 'captures'] as const) {
    const snapshot = await getDocs(
      query(collection(db, 'users', uid, parent), where('tag_ids', 'array-contains', absorbedId)),
    );
    for (const document of snapshot.docs) {
      const parsed = idList.safeParse(document.get('tag_ids'));
      const current = parsed.success ? parsed.data : [];
      const next = current.filter((x) => x !== absorbedId);
      if (!next.includes(survivorId)) next.push(survivorId);
      batch.update(document.ref, { tag_ids: next });
    }
  }
  batch.delete(doc(tagsCollection(db, uid), absorbedId));
  batch.update(doc(tagsCollection(db, uid), survivorId), tagRestore());
  await batch.commit();
}

/** `mergeTag(id, into: name)`: the renamed tag is absorbed; the existing tag survives. */
export async function mergeTagInto(
  db: Firestore,
  uid: string,
  id: string,
  targetName: string,
): Promise<void> {
  const target = await fetchTagNamed(db, uid, targetName);
  if (!target || target.id === id) throw new Error(noOtherTagError(targetName));
  await removeTagEverywhere(db, uid, id, target.id);
}

export async function softDeleteTag(
  db: Firestore,
  uid: string,
  id: string,
  now: Date,
): Promise<void> {
  await updateDoc(doc(tagsCollection(db, uid), id), tagSoftDelete(now));
}

export async function restoreTag(db: Firestore, uid: string, id: string): Promise<void> {
  await updateDoc(doc(tagsCollection(db, uid), id), tagRestore());
}

export async function fetchDeletedTags(db: Firestore, uid: string): Promise<DecodedList<Tag>> {
  const snapshot = await getDocs(query(tagsCollection(db, uid), orderBy('name')));
  const list = decodeList(snapshot.docs, decodeTag);
  return { items: deleted(list.items), skipped: list.skipped };
}

/** The 30-day purge and "Delete forever": strips the links, then deletes the document. */
export async function purgeTag(db: Firestore, uid: string, id: string): Promise<void> {
  await removeTagEverywhere(db, uid, id);
}

export type TagCreateResult =
  | { readonly kind: 'created'; readonly tag: TagWithUsage }
  | { readonly kind: 'alreadyExisted'; readonly tag: TagWithUsage };

export async function createTag(
  db: Firestore,
  uid: string,
  name: string,
): Promise<TagCreateResult> {
  const existing = await fetchTagNamed(db, uid, name);
  if (existing) {
    const counts = await tagUsageCounts(db, uid);
    return {
      kind: 'alreadyExisted',
      tag: { ...existing, usageCount: counts.get(existing.id) ?? 0 },
    };
  }
  const tag: Tag = { id: newId(), name };
  await setDoc(doc(tagsCollection(db, uid), tag.id), encodeTag(tag));
  return { kind: 'created', tag: { ...tag, usageCount: 0 } };
}
