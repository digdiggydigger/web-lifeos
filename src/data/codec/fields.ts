/**
 * Field-level conventions shared by every payload builder (the Swift `FirestoreFieldPayloads`
 * helpers): absent-not-null optionals, the erase sentinel, the server clock, and the delta
 * convention for partial updates.
 */
import { deleteField, FieldValue, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';

import { toTimestamp } from './time';

/** A Firestore write value. Arrays and maps are allowed but only of these primitives. */
export type FieldWrite =
  | string
  | number
  | boolean
  | Timestamp
  | FieldValue
  | readonly FieldWrite[]
  | { readonly [key: string]: FieldWrite };

export type Fields = Record<string, FieldWrite>;

/** The "erase this field" sentinel. Restores and clears use this, never `null`. */
export function clear(): FieldValue {
  return deleteField();
}

export function serverNow(): FieldValue {
  return serverTimestamp();
}

/** Mirrors `FirestoreDocumentCoder.isFieldDelete`: distinguishes delete from the other FieldValue sentinels. */
export function isFieldDelete(value: unknown): boolean {
  return value instanceof FieldValue && value.isEqual(deleteField());
}

export function isServerTimestamp(value: unknown): boolean {
  return value instanceof FieldValue && value.isEqual(serverTimestamp());
}

/**
 * The delta convention for partial updates (Swift `T??`): a key that is ABSENT in the payload is
 * untouched (no write); `null` means "explicitly cleared", which Firestore expresses as
 * `deleteField()`; any other value is written.
 */
export type Delta<T> = T | null;

export function setNullable<T>(
  fields: Fields,
  key: string,
  change: Delta<T> | undefined,
  map: (value: T) => FieldWrite = (value) => value as unknown as FieldWrite,
): void {
  if (change === undefined) return;
  fields[key] = change === null ? clear() : map(change);
}

/** Dates in a delta become Timestamps. */
export function dateField(value: Date): Timestamp {
  return toTimestamp(value);
}

/** Drops `undefined` values so an optional never lands on the document as `null`. */
export function omitUndefined<T extends Record<string, unknown>>(
  object: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}
