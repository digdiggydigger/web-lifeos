/**
 * `logs/{id}` (`Journal/LogModels.swift`): snake_case, append-only. An `energy_level` this build
 * does not recognise decodes as ABSENT rather than failing the document (the hand-written Swift
 * decoder does exactly this so one entry from a newer build cannot empty the journal).
 */
import { z } from 'zod';

import { ENERGY_LEVELS, LOG_TYPES } from '@/domain/types';
import type { EnergyLevel, Log } from '@/domain/types';

import { omitUndefined } from '../fields';
import { toTimestamp } from '../time';
import { documentId, idList, timestamp } from './common';
import type { DocumentData } from './common';

const tolerantEnergyLevel = z.preprocess(
  (value) => (ENERGY_LEVELS.includes(value as EnergyLevel) ? value : undefined),
  z.enum(ENERGY_LEVELS).optional(),
);

export const logDocument = z.object({
  id: documentId,
  type: z.enum(LOG_TYPES),
  body: z.string(),
  entry_date: timestamp,
  created_at: timestamp,
  life_area_id: documentId.optional(),
  energy_level: tolerantEnergyLevel,
  mood_emoji: z.string().optional(),
  tag_ids: idList.optional(),
  place_id: documentId.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export function decodeLog(data: DocumentData): Log {
  const doc = logDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    type: doc.type,
    body: doc.body,
    entryDate: doc.entry_date,
    createdAt: doc.created_at,
    lifeAreaId: doc.life_area_id,
    energyLevel: doc.energy_level,
    moodEmoji: doc.mood_emoji,
    tagIds: doc.tag_ids,
    placeId: doc.place_id,
    latitude: doc.latitude,
    longitude: doc.longitude,
  });
}

/** Full-document encode for create (`appendLog`): logs are born with their tags or never have them. */
export function encodeLog(log: Log): DocumentData {
  return omitUndefined({
    id: log.id,
    type: log.type,
    body: log.body,
    entry_date: toTimestamp(log.entryDate),
    created_at: toTimestamp(log.createdAt),
    life_area_id: log.lifeAreaId,
    energy_level: log.energyLevel,
    mood_emoji: log.moodEmoji,
    tag_ids: log.tagIds ? [...log.tagIds] : undefined,
    place_id: log.placeId,
    latitude: log.latitude,
    longitude: log.longitude,
  });
}
