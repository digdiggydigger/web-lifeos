/**
 * The task partial-update payloads (`FirestoreFieldPayloads.taskUpdate` / `taskStatus` /
 * `taskSoftDelete` / `taskRestore`). Fully snake_cased. A wrong key raises nothing, so the tests
 * assert the capture spelling is ABSENT as well as the task spelling present.
 */
import type { TaskPriority, TaskStatus } from '@/domain/types';

import { clear, dateField, setNullable } from '../fields';
import type { Delta, Fields } from '../fields';
import { toTimestamp } from '../time';

/** `Tasks/TaskDetailModels.swift` `TaskUpdatePayload`. Absent = untouched; `null` = cleared. */
export interface TaskUpdatePayload {
  readonly title?: string;
  readonly notes?: Delta<string>;
  readonly lifeAreaId?: Delta<string>;
  readonly priority?: TaskPriority;
  readonly dueDate?: Delta<Date>;
  readonly focusDurationSeconds?: number;
  readonly nudgesCount?: number;
  readonly atPlaceId?: Delta<string>;
}

export function taskUpdate(payload: TaskUpdatePayload): Fields {
  const fields: Fields = {};
  if (payload.title !== undefined) fields['title'] = payload.title;
  if (payload.priority !== undefined) fields['priority'] = payload.priority;
  setNullable(fields, 'notes', payload.notes);
  setNullable(fields, 'life_area_id', payload.lifeAreaId);
  setNullable(fields, 'due_date', payload.dueDate, dateField);
  setNullable(fields, 'at_place_id', payload.atPlaceId);
  if (payload.focusDurationSeconds !== undefined) {
    fields['focus_duration_seconds'] = payload.focusDurationSeconds;
  }
  if (payload.nudgesCount !== undefined) fields['nudges_count'] = payload.nudgesCount;
  return fields;
}

/** `Places/LocationStamping.swift` `LocationStamp`: where a close happened, and the named place if any. */
export interface LocationStamp {
  readonly latitude: number;
  readonly longitude: number;
  readonly placeId?: string;
}

/** `TaskCompletionStamp.completedAt(for:now:)`: the moment for `done`, nothing for `open`. */
export function completedAtFor(status: TaskStatus, now: Date): Date | undefined {
  return status === 'done' ? now : undefined;
}

/**
 * The status flip, its completion stamp and its location trio in ONE write. The stamp is the
 * CLIENT clock ("completed today" is the user's local day). Closing with a stamp records where;
 * anything else erases the trio, value-or-delete, never absent.
 */
export function taskStatus(status: TaskStatus, now: Date, stamp?: LocationStamp): Fields {
  const completedAt = completedAtFor(status, now);
  const fields: Fields = {
    status,
    completed_at: completedAt ? toTimestamp(completedAt) : clear(),
  };
  if (status === 'done' && stamp) {
    fields['place_id'] = stamp.placeId ?? clear();
    fields['latitude'] = stamp.latitude;
    fields['longitude'] = stamp.longitude;
  } else {
    fields['place_id'] = clear();
    fields['latitude'] = clear();
    fields['longitude'] = clear();
  }
  return fields;
}

/** The stamp, and nothing else; client clock. */
export function taskSoftDelete(now: Date): Fields {
  return { deleted_at: toTimestamp(now) };
}

/** Erases the field rather than writing null: absence is what "live" already looks like. */
export function taskRestore(): Fields {
  return { deleted_at: clear() };
}
