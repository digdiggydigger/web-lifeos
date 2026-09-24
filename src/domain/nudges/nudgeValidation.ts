/** `Nudges/NudgeValidation.swift`: trim, reject an empty label, reject an empty weekday set; updates carry only the delta. */
import type { Nudge } from '@/domain/types';

import { parseSchedule, sameSchedule } from './nudgeSchedule';
import type { NudgeSchedule } from './nudgeSchedule';

export type NudgeValidationError = 'emptyLabel' | 'invalidSchedule';

export const NUDGE_VALIDATION_MESSAGES: Record<NudgeValidationError, string> = {
  emptyLabel: 'Nudge label must not be empty.',
  invalidSchedule: 'Please select at least one day.',
};

export type NudgeValidated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: NudgeValidationError };

export interface NormalizedCreateNudgeInput {
  readonly label: string;
  readonly schedule: NudgeSchedule;
}

/** `NudgeUpdatePayload`: absent = untouched. `active` is toggled on its own, not through the form. */
export interface NudgeUpdatePayload {
  readonly label?: string;
  readonly schedule?: NudgeSchedule;
  readonly active?: boolean;
}

export function isEmptyNudgeUpdate(payload: NudgeUpdatePayload): boolean {
  return (
    payload.label === undefined && payload.schedule === undefined && payload.active === undefined
  );
}

export function normalizeCreateNudgeInput(
  label: string,
  schedule: NudgeSchedule,
): NudgeValidated<NormalizedCreateNudgeInput> {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, error: 'emptyLabel' };
  if (schedule.weekdays.size === 0) return { ok: false, error: 'invalidSchedule' };
  return { ok: true, value: { label: trimmed, schedule } };
}

/** An unparseable original schedule makes any valid edit a change. */
export function normalizeUpdateNudgeInput(
  original: Pick<Nudge, 'label' | 'schedule'>,
  editedLabel: string,
  editedSchedule: NudgeSchedule,
): NudgeValidated<NudgeUpdatePayload> {
  const trimmed = editedLabel.trim();
  if (trimmed.length === 0) return { ok: false, error: 'emptyLabel' };
  if (editedSchedule.weekdays.size === 0) return { ok: false, error: 'invalidSchedule' };
  const payload: { label?: string; schedule?: NudgeSchedule } = {};
  if (trimmed !== original.label) payload.label = trimmed;
  if (!sameSchedule(parseSchedule(original.schedule), editedSchedule))
    payload.schedule = editedSchedule;
  return { ok: true, value: payload };
}
