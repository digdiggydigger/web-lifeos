/**
 * Dates on the wire are Firestore `Timestamp`s, never ISO strings or numbers: the iOS models decode
 * `Date` through `Firestore.Decoder`, which accepts only a Timestamp. Mirrors
 * `FirestoreDocumentCoder.date(from:)`.
 */
import { Timestamp } from 'firebase/firestore';

export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** `undefined` when the value is absent or is not a Timestamp: the interesting answer when checking what a payload wrote. */
export function fromTimestamp(value: unknown): Date | undefined {
  return value instanceof Timestamp ? value.toDate() : undefined;
}

export function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}
