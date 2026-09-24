/**
 * `FirebaseJournalClientAdapter.createLog`: the ONE place a log document is born. Logs cannot be
 * updated (rules deny it), so the document carries its tags from the start or never has them.
 */
import type { NormalizedCreateLogInput } from '@/domain/journal/logValidation';
import type { Log } from '@/domain/types';

import { newId } from '../ids';

export function newLog(input: NormalizedCreateLogInput, now: Date, id: string = newId()): Log {
  return {
    id,
    type: input.type,
    body: input.body,
    entryDate: now,
    createdAt: now,
    ...(input.lifeAreaId !== undefined ? { lifeAreaId: input.lifeAreaId } : {}),
    ...(input.energyLevel !== undefined ? { energyLevel: input.energyLevel } : {}),
    ...(input.moodEmoji !== undefined ? { moodEmoji: input.moodEmoji } : {}),
    ...(input.tagIds.length > 0 ? { tagIds: [...input.tagIds] } : {}),
  };
}
