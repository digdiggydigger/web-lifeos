/** `focus_sessions/{id}` (`Focus/FocusModels.swift` `CompletedFocusSession`): snake_case. Read-only until Phase 2. */
import { z } from 'zod';

import type { CompletedFocusSession } from '@/domain/types';

import { omitUndefined } from '../fields';
import { documentId, timestamp } from './common';
import type { DocumentData } from './common';

export const focusSessionDocument = z.object({
  id: documentId,
  task_title: z.string(),
  life_area_emoji: z.string(),
  planned_seconds: z.number(),
  focused_seconds: z.number(),
  checkpoints_reached: z.number(),
  completed_naturally: z.boolean(),
  started_at: timestamp,
  ended_at: timestamp,
  task_id: documentId.optional(),
  place_id: documentId.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  confirmed_at: timestamp.optional(),
});

export function decodeFocusSession(data: DocumentData): CompletedFocusSession {
  const doc = focusSessionDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    taskTitle: doc.task_title,
    lifeAreaEmoji: doc.life_area_emoji,
    plannedSeconds: doc.planned_seconds,
    focusedSeconds: doc.focused_seconds,
    checkpointsReached: doc.checkpoints_reached,
    completedNaturally: doc.completed_naturally,
    startedAt: doc.started_at,
    endedAt: doc.ended_at,
    taskId: doc.task_id,
    placeId: doc.place_id,
    latitude: doc.latitude,
    longitude: doc.longitude,
    confirmedAt: doc.confirmed_at,
  });
}
