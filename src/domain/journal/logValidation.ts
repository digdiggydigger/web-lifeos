/** `Journal/LogValidation.swift`: trim, refuse an empty body, and keep energy/mood for journal entries only. */
import type { EnergyLevel, LogType } from '@/domain/types';

export const EMPTY_BODY_ERROR = 'Log body must not be empty.';

export interface NormalizedCreateLogInput {
  readonly body: string;
  readonly type: LogType;
  readonly lifeAreaId: string | undefined;
  readonly energyLevel: EnergyLevel | undefined;
  readonly moodEmoji: string | undefined;
  /** Both types carry tags, unlike energy and mood. */
  readonly tagIds: readonly string[];
}

export type CreateLogValidation =
  | { readonly kind: 'ok'; readonly input: NormalizedCreateLogInput }
  | { readonly kind: 'emptyBody'; readonly message: string };

export function normalizeCreateLogInput(input: {
  readonly body: string;
  readonly type: LogType;
  readonly lifeAreaId?: string | undefined;
  readonly energyLevel?: EnergyLevel | undefined;
  readonly moodEmoji?: string | undefined;
  readonly tagIds?: readonly string[] | undefined;
}): CreateLogValidation {
  const body = input.body.trim();
  if (body.length === 0) return { kind: 'emptyBody', message: EMPTY_BODY_ERROR };
  const isJournal = input.type === 'journal';
  const mood = input.moodEmoji?.trim();
  return {
    kind: 'ok',
    input: {
      body,
      type: input.type,
      lifeAreaId: input.lifeAreaId,
      energyLevel: isJournal ? input.energyLevel : undefined,
      moodEmoji: isJournal && mood ? mood : undefined,
      tagIds: input.tagIds ?? [],
    },
  };
}
