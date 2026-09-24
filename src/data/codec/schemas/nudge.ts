/** `nudges/{id}` (`Nudges/NudgeModels.swift`): snake_case. */
import { z } from 'zod';

import type { Nudge } from '@/domain/types';

import { omitUndefined } from '../fields';
import { toTimestamp } from '../time';
import { documentId, timestamp } from './common';
import type { DocumentData } from './common';

export const nudgeDocument = z.object({
  id: documentId,
  label: z.string(),
  schedule: z.string(),
  active: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
  last_fired_at: timestamp.optional(),
  completion_dates: z.array(timestamp).optional(),
});

export function decodeNudge(data: DocumentData): Nudge {
  const doc = nudgeDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    label: doc.label,
    schedule: doc.schedule,
    active: doc.active,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    lastFiredAt: doc.last_fired_at,
    completionDates: doc.completion_dates,
  });
}

export function encodeNudge(nudge: Nudge): DocumentData {
  return omitUndefined({
    id: nudge.id,
    label: nudge.label,
    schedule: nudge.schedule,
    active: nudge.active,
    created_at: toTimestamp(nudge.createdAt),
    updated_at: toTimestamp(nudge.updatedAt),
    last_fired_at: nudge.lastFiredAt ? toTimestamp(nudge.lastFiredAt) : undefined,
    completion_dates: nudge.completionDates
      ? nudge.completionDates.map((d) => toTimestamp(d))
      : undefined,
  });
}
