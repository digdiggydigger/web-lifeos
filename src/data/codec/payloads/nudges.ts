/**
 * The nudge payloads (`FirestoreFieldPayloads.nudgeUpdate` / `nudgeFired` / `nudgeUnfired`) and the
 * new document. Fully snake_cased; the schedule is encoded to its cron string only here.
 */
import { encodeSchedule } from '@/domain/nudges';
import type { NormalizedCreateNudgeInput, NudgeUpdatePayload } from '@/domain/nudges';
import type { Nudge } from '@/domain/types';

import { clear, serverNow } from '../fields';
import type { Fields } from '../fields';
import { newId } from '../ids';
import { toTimestamp } from '../time';

export type { NudgeUpdatePayload } from '@/domain/nudges';

/** A real change stamps `updated_at` from the SERVER clock; an empty payload writes nothing at all. */
export function nudgeUpdate(payload: NudgeUpdatePayload): Fields {
  const fields: Fields = {};
  if (payload.label !== undefined) fields['label'] = payload.label;
  if (payload.schedule !== undefined) fields['schedule'] = encodeSchedule(payload.schedule);
  if (payload.active !== undefined) fields['active'] = payload.active;
  if (Object.keys(fields).length > 0) fields['updated_at'] = serverNow();
  return fields;
}

/** A firing: both stamps the same CLIENT instant, and the FULL completion array including this one. */
export function nudgeFired(now: Date, completionDates: readonly Date[]): Fields {
  const stamp = toTimestamp(now);
  return {
    last_fired_at: stamp,
    updated_at: stamp,
    completion_dates: completionDates.map((d) => toTimestamp(d)),
  };
}

/** A firing taken back: restores the values held BEFORE it; a never-fired nudge has its stamp cleared, not written. */
export function nudgeUnfired(
  previousLastFiredAt: Date | undefined,
  completionDates: readonly Date[],
  now: Date,
): Fields {
  return {
    updated_at: toTimestamp(now),
    completion_dates: completionDates.map((d) => toTimestamp(d)),
    last_fired_at: previousLastFiredAt ? toTimestamp(previousLastFiredAt) : clear(),
  };
}

/** `FirebaseNudgesClientAdapter.createNudge`: active, never fired, both stamps the same client instant. */
export function newNudge(
  input: NormalizedCreateNudgeInput,
  now: Date,
  id: string = newId(),
): Nudge {
  return {
    id,
    label: input.label,
    schedule: encodeSchedule(input.schedule),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}
