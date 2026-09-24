/**
 * `life_areas` (`FirebaseManager+LifeAreas.swift`): ordered by `sort_order`; archived areas are
 * filtered on the client (the iOS query has no `where`). Reads are defensive via `decodeList`.
 */
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { Firestore, Unsubscribe } from 'firebase/firestore';

import type { LifeArea } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { decodeLifeArea } from '../codec/schemas';

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
