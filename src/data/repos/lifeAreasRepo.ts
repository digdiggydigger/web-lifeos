/**
 * `life_areas` (`FirebaseManager+LifeAreas.swift`): ordered by `sort_order`; archived areas are
 * filtered on the client (the iOS query has no `where`). Reads are defensive via `decodeList`.
 */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Firestore, Unsubscribe } from 'firebase/firestore';

import { findNameClash, nextSortOrder } from '@/domain/lifeAreas/lifeAreaEditor';
import type { LifeArea } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { newId } from '../codec/ids';
import { lifeAreaArchived, lifeAreaSortOrders, lifeAreaUpdate } from '../codec/payloads/lifeAreas';
import type { LifeAreaPaletteEdit } from '../codec/payloads/lifeAreas';
import { decodeLifeArea, encodeLifeArea } from '../codec/schemas';

function lifeAreasQuery(db: Firestore, uid: string) {
  return query(collection(db, 'users', uid, 'life_areas'), orderBy('sort_order'));
}

function visible(list: DecodedList<LifeArea>, includeArchived: boolean): DecodedList<LifeArea> {
  return includeArchived
    ? list
    : { items: list.items.filter((area) => !area.archived), skipped: list.skipped };
}

export async function fetchLifeAreas(
  db: Firestore,
  uid: string,
  options: { includeArchived?: boolean } = {},
): Promise<DecodedList<LifeArea>> {
  const snapshot = await getDocs(lifeAreasQuery(db, uid));
  return visible(decodeList(snapshot.docs, decodeLifeArea), options.includeArchived ?? false);
}

export interface WatchCallbacks<T> {
  readonly onData: (list: DecodedList<T>) => void;
  readonly onError: (error: Error) => void;
}

/** Live variant: the web gets real-time updates for free; the phone stays fetch-on-demand. */
export function watchLifeAreas(
  db: Firestore,
  uid: string,
  callbacks: WatchCallbacks<LifeArea>,
  options: { includeArchived?: boolean } = {},
): Unsubscribe {
  return onSnapshot(
    lifeAreasQuery(db, uid),
    (snapshot) =>
      callbacks.onData(
        visible(decodeList(snapshot.docs, decodeLifeArea), options.includeArchived ?? false),
      ),
    (error) => callbacks.onError(error),
  );
}

// MARK: - The editor's writes (`LifeAreaEditorClientAdapting` + `FirebaseManager+LifeAreas`)

export type LifeAreaNameConflict = {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
};
export type LifeAreaWriteResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'nameConflict'; readonly conflict: LifeAreaNameConflict };

function conflictOf(area: LifeArea): LifeAreaWriteResult {
  return {
    kind: 'nameConflict',
    conflict: { id: area.id, name: area.name, archived: area.archived },
  };
}

/** `create(name, colour)`: a case-insensitive clash against EVERY area (archived too) refuses; otherwise a whole document with `sort_order` = max + 1 and no palette. */
export async function createLifeArea(
  db: Firestore,
  uid: string,
  name: string,
  colour: string,
): Promise<LifeAreaWriteResult & { readonly id?: string }> {
  const all = (await fetchLifeAreas(db, uid, { includeArchived: true })).items;
  const clash = findNameClash(all, name);
  if (clash) return conflictOf(clash);
  const area: LifeArea = {
    id: newId(),
    name,
    colour,
    sortOrder: nextSortOrder(all),
    archived: false,
  };
  await setDoc(doc(db, 'users', uid, 'life_areas', area.id), encodeLifeArea(area));
  return { kind: 'ok', id: area.id };
}

/** `update(id, name?, colour?, palette)`: a rename clashing with ANOTHER area writes nothing; a same-case rename of itself is fine. */
export async function updateLifeArea(
  db: Firestore,
  uid: string,
  id: string,
  input: {
    readonly name?: string;
    readonly colour?: string;
    readonly palette: LifeAreaPaletteEdit;
  },
): Promise<LifeAreaWriteResult> {
  if (input.name !== undefined) {
    const all = (await fetchLifeAreas(db, uid, { includeArchived: true })).items;
    const clash = findNameClash(all, input.name, id);
    if (clash) return conflictOf(clash);
  }
  const fields = lifeAreaUpdate(input);
  if (Object.keys(fields).length > 0)
    await updateDoc(doc(db, 'users', uid, 'life_areas', id), fields);
  return { kind: 'ok' };
}

export async function setLifeAreaArchived(
  db: Firestore,
  uid: string,
  id: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'life_areas', id), lifeAreaArchived(archived));
}

/** `reorderLifeAreas`: the COMPLETE order in one batch, index → sort_order. */
export async function reorderLifeAreas(
  db: Firestore,
  uid: string,
  orderedIds: readonly string[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, fields } of lifeAreaSortOrders(orderedIds))
    batch.update(doc(db, 'users', uid, 'life_areas', id), fields);
  await batch.commit();
}
