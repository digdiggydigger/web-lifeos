/**
 * The capture payloads (`FirestoreFieldPayloads.captureUpdate` and friends) and the one place a
 * capture document is born (`FirebaseCaptureClientAdapter.createCapture`). camelCase apart from
 * `created_at` and `tag_ids`. The retired `status` field is never minted.
 */
import type { NormalizedCreateCaptureInput } from '@/domain/captures/captureValidation';
import type { Capture } from '@/domain/types';

import { clear, dateField, setNullable } from '../fields';
import type { Delta, Fields } from '../fields';
import { newId } from '../ids';
import { toTimestamp } from '../time';

/** `Capture/CaptureClientAdapting.swift` `CaptureUpdate`. */
export interface CaptureUpdate {
  readonly lifeAreaId?: Delta<string>;
  readonly title?: string;
  readonly notes?: Delta<string>;
  /** Set-or-omit, never a delete: undo writes an explicit `false`. */
  readonly seen?: boolean;
  readonly clearedAt?: Delta<Date>;
}

export function captureUpdate(changes: CaptureUpdate): Fields {
  const fields: Fields = {};
  if (changes.title !== undefined) fields['title'] = changes.title;
  setNullable(fields, 'lifeAreaId', changes.lifeAreaId);
  setNullable(fields, 'notes', changes.notes);
  if (changes.seen !== undefined) fields['seen'] = changes.seen;
  setNullable(fields, 'clearedAt', changes.clearedAt, dateField);
  return fields;
}

/** The processed flip and the inbox-exit stamp, always together. */
export function captureProcessed(now: Date): Fields {
  return { processed: true, clearedAt: toTimestamp(now) };
}

/** The inverse: back in the inbox means no exit stamp at all, not an old one left standing. */
export function captureUnprocessed(): Fields {
  return { processed: false, clearedAt: clear() };
}

export function captureSoftDelete(now: Date): Fields {
  return { deletedAt: toTimestamp(now) };
}

export function captureRestore(): Fields {
  return { deletedAt: clear() };
}

/** A new, unprocessed capture. `mediaURL` is the permanent download URL resolved from the media key. */
export function newCapture(
  input: NormalizedCreateCaptureInput,
  now: Date,
  mediaURL: string | undefined,
  id: string = newId(),
): Capture {
  return {
    id,
    content: input.content,
    kind: input.kind,
    processed: false,
    createdAt: now,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.lifeAreaId !== undefined ? { lifeAreaId: input.lifeAreaId } : {}),
    ...(mediaURL !== undefined ? { mediaURL } : {}),
    ...(input.mediaContentType !== undefined ? { mediaContentType: input.mediaContentType } : {}),
  };
}
