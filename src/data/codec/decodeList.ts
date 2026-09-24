/**
 * Defensive list decoding. iOS decodes with `documents.map { try … }`, so ONE bad document blanks
 * the whole list on the phone. The web must never do that silently: a document that fails its
 * schema is skipped, logged, and COUNTED, and the count is surfaced to the screen.
 */
import type { DocumentData } from './schemas/common';

export interface DecodedList<T> {
  readonly items: readonly T[];
  readonly skipped: ReadonlyArray<{ readonly id: string; readonly reason: string }>;
}

export interface DocumentLike {
  readonly id: string;
  data(): DocumentData;
}

export function decodeList<T>(
  documents: readonly DocumentLike[],
  decode: (data: DocumentData, id: string) => T,
  log: (message: string) => void = (message) => console.warn(message),
): DecodedList<T> {
  const items: T[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const document of documents) {
    try {
      items.push(decode(document.data(), document.id));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ id: document.id, reason });
      log(`Skipped document ${document.id}: ${reason}`);
    }
  }
  return { items, skipped };
}
