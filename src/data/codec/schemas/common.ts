import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

/** Uppercase UUID, the iOS `uuidString` spelling. */
export const documentId = z
  .string()
  .regex(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/, 'uppercase UUID');

/** A Firestore Timestamp, decoded to a Date. Strings and numbers are NOT dates on this wire. */
export const timestamp = z.instanceof(Timestamp).transform((value) => value.toDate());

export const idList = z.array(documentId);

/** The raw shape `snapshot.data()` hands back. */
export type DocumentData = Record<string, unknown>;
