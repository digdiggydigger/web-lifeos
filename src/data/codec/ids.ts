/**
 * Document ids, iOS style: UPPERCASE UUID strings (Swift's `uuidString`), duplicated into an `id`
 * field on every document. Reference fields (`life_area_id`, `tag_ids[]`, `place_id`…) carry the
 * same spelling, and Firestore equality queries are exact-match, so a lowercase id never matches.
 */
const UPPERCASE_UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

export function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && UPPERCASE_UUID.test(value);
}

export function assertDocumentId(value: string, what = 'id'): string {
  if (!UPPERCASE_UUID.test(value)) {
    throw new Error(`${what} must be an uppercase UUID (got "${value}")`);
  }
  return value;
}

/** A fresh document id in the iOS spelling. */
export function newId(): string {
  return crypto.randomUUID().toUpperCase();
}

/** Storage object names use the LOWERCASE form (`FirebaseManager.makeUploadTarget`). */
export function storageObjectName(id: string, extension: string): string {
  return `${assertDocumentId(id).toLowerCase()}.${extension}`;
}
