/**
 * `captures/{id}` (`Capture/CaptureModels.swift`): camelCase EXCEPT `created_at` and `tag_ids`,
 * because that is what the capture Cloud Function and the iOS Shortcut write.
 */
import { z } from 'zod';

import { CAPTURE_KINDS } from '@/domain/types';
import type { Capture } from '@/domain/types';

import { omitUndefined } from '../fields';
import { toTimestamp } from '../time';
import { documentId, idList, timestamp } from './common';
import type { DocumentData } from './common';

const linkPreview = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  thumbnailURL: z.string().optional(),
});

export const captureDocument = z.object({
  id: documentId,
  content: z.string(),
  kind: z.enum(CAPTURE_KINDS),
  processed: z.boolean(),
  created_at: timestamp,
  title: z.string().optional(),
  lifeAreaId: documentId.optional(),
  mediaURL: z.string().optional(),
  mediaContentType: z.string().optional(),
  thumbnailURL: z.string().optional(),
  linkPreview: linkPreview.optional(),
  aiAssessment: z.string().optional(),
  notes: z.string().optional(),
  clearedAt: timestamp.optional(),
  seen: z.boolean().optional(),
  tag_ids: idList.optional(),
  placeId: documentId.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deletedAt: timestamp.optional(),
});

export function decodeCapture(data: DocumentData): Capture {
  const doc = captureDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    content: doc.content,
    kind: doc.kind,
    processed: doc.processed,
    createdAt: doc.created_at,
    title: doc.title,
    lifeAreaId: doc.lifeAreaId,
    mediaURL: doc.mediaURL,
    mediaContentType: doc.mediaContentType,
    thumbnailURL: doc.thumbnailURL,
    linkPreview: doc.linkPreview && omitUndefined(doc.linkPreview),
    aiAssessment: doc.aiAssessment,
    notes: doc.notes,
    clearedAt: doc.clearedAt,
    seen: doc.seen,
    tagIds: doc.tag_ids,
    placeId: doc.placeId,
    latitude: doc.latitude,
    longitude: doc.longitude,
    deletedAt: doc.deletedAt,
  });
}

/** Full-document encode for create (`saveCapture`). `tag_ids` is never encoded here (arrayUnion only). */
export function encodeCapture(capture: Capture): DocumentData {
  return omitUndefined({
    id: capture.id,
    content: capture.content,
    kind: capture.kind,
    processed: capture.processed,
    created_at: toTimestamp(capture.createdAt),
    title: capture.title,
    lifeAreaId: capture.lifeAreaId,
    mediaURL: capture.mediaURL,
    mediaContentType: capture.mediaContentType,
    thumbnailURL: capture.thumbnailURL,
    linkPreview: capture.linkPreview && omitUndefined({ ...capture.linkPreview }),
    aiAssessment: capture.aiAssessment,
    notes: capture.notes,
    clearedAt: capture.clearedAt && toTimestamp(capture.clearedAt),
    seen: capture.seen,
    placeId: capture.placeId,
    latitude: capture.latitude,
    longitude: capture.longitude,
    deletedAt: capture.deletedAt && toTimestamp(capture.deletedAt),
  });
}
