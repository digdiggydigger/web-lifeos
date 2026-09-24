/** `tags/{id}` (`Tasks/TagModels.swift`): `id`, `name`, and the snake_case `deleted_at`. */
import { z } from 'zod';

import type { Tag } from '@/domain/types';

import { omitUndefined } from '../fields';
import { toTimestamp } from '../time';
import { documentId, timestamp } from './common';
import type { DocumentData } from './common';

export const tagDocument = z.object({
  id: documentId,
  name: z.string(),
  deleted_at: timestamp.optional(),
});

export function decodeTag(data: DocumentData): Tag {
  const doc = tagDocument.parse(data);
  return omitUndefined({ id: doc.id, name: doc.name, deletedAt: doc.deleted_at });
}

export function encodeTag(tag: Tag): DocumentData {
  return omitUndefined({
    id: tag.id,
    name: tag.name,
    deleted_at: tag.deletedAt && toTimestamp(tag.deletedAt),
  });
}
