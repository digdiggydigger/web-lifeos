/** `FocusCadenceDraft`: the cadence editor's working copy. */
import { cadenceCheckpoints, MINIMUM_CHECKPOINT_INTERVAL_SECONDS } from './focusCheckpoints';
import type { FocusNudgeCadence } from './focusCheckpoints';
import { clampNudgeCount } from './focusSprintConfiguration';
import { humanSpan } from './focusTimeFormatting';

export type CadenceMode = 'count' | 'interval';
export type IntervalUnit = 'seconds' | 'minutes';

export interface FocusCadenceDraft {
  readonly mode: CadenceMode;
  readonly count: number;
  readonly intervalValue: number;
  readonly intervalUnit: IntervalUnit;
}

export const CADENCE_COUNT_CHOICES = [1, 2, 3, 4, 5] as const;
export const CADENCE_INTERVAL_PRESET_SECONDS = [30, 45, 60, 120] as const;

export function cadenceModeTitle(mode: CadenceMode): string {
  return mode === 'count' ? 'By count' : 'By interval';
}

export function intervalUnitTitle(unit: IntervalUnit): string {
  return unit === 'seconds' ? 'Sec' : 'Min';
}

export function draftFromCadence(cadence: FocusNudgeCadence): FocusCadenceDraft {
  if (cadence.kind === 'count') {
    return {
      mode: 'count',
      count: cadence.count,
      intervalValue: MINIMUM_CHECKPOINT_INTERVAL_SECONDS,
      intervalUnit: 'seconds',
    };
  }
  const wholeMinutes = cadence.seconds >= 60 && cadence.seconds % 60 === 0;
  return {
    mode: 'interval',
    count: 1,
    intervalValue: wholeMinutes ? cadence.seconds / 60 : cadence.seconds,
    intervalUnit: wholeMinutes ? 'minutes' : 'seconds',
  };
}

export function resolvedIntervalSeconds(draft: FocusCadenceDraft): number {
  const raw = draft.intervalUnit === 'minutes' ? draft.intervalValue * 60 : draft.intervalValue;
  return Math.max(MINIMUM_CHECKPOINT_INTERVAL_SECONDS, raw);
}

export function resolvedCadence(draft: FocusCadenceDraft): FocusNudgeCadence {
  return draft.mode === 'count'
    ? { kind: 'count', count: clampNudgeCount(draft.count) }
    : { kind: 'interval', seconds: resolvedIntervalSeconds(draft) };
}

export function selectingIntervalUnit(
  draft: FocusCadenceDraft,
  unit: IntervalUnit,
): FocusCadenceDraft {
  const lifted = unit === 'seconds' && draft.intervalValue < MINIMUM_CHECKPOINT_INTERVAL_SECONDS;
  return {
    ...draft,
    intervalUnit: unit,
    intervalValue: lifted ? MINIMUM_CHECKPOINT_INTERVAL_SECONDS : draft.intervalValue,
  };
}

export function draftSummary(draft: FocusCadenceDraft, durationSeconds: number): string {
  const scheduled = cadenceCheckpoints(resolvedCadence(draft), durationSeconds).length;
  if (scheduled <= 0) return 'No nudges';
  const nudges = scheduled === 1 ? '1 nudge' : `${scheduled} nudges`;
  return draft.mode === 'interval'
    ? `${nudges} — every ${humanSpan(resolvedIntervalSeconds(draft))}`
    : nudges;
}
