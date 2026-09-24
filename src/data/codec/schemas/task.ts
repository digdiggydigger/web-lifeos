/**
 * `tasks/{id}`: fully snake_cased (`Tasks/TaskDetailModels.swift` CodingKeys).
 */
import { z } from 'zod';

import { TASK_PRIORITIES, TASK_STATUSES } from '@/domain/types';
import type { Task } from '@/domain/types';

import { omitUndefined } from '../fields';
import { toTimestamp } from '../time';
import { documentId, idList, timestamp } from './common';
import type { DocumentData } from './common';

export const taskDocument = z.object({
  id: documentId,
  title: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  life_area_id: documentId.optional(),
  notes: z.string().optional(),
  due_date: timestamp.optional(),
  created_at: timestamp.optional(),
  focus_duration_seconds: z.number().int().optional(),
  nudges_count: z.number().int().optional(),
  completed_at: timestamp.optional(),
  at_place_id: documentId.optional(),
  place_id: documentId.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deleted_at: timestamp.optional(),
  tag_ids: idList.optional(),
});

export function decodeTask(data: DocumentData): Task {
  const doc = taskDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    title: doc.title,
    status: doc.status,
    priority: doc.priority,
    lifeAreaId: doc.life_area_id,
    notes: doc.notes,
    dueDate: doc.due_date,
    createdAt: doc.created_at,
    focusDurationSeconds: doc.focus_duration_seconds,
    nudgesCount: doc.nudges_count,
    completedAt: doc.completed_at,
    atPlaceId: doc.at_place_id,
    placeId: doc.place_id,
    latitude: doc.latitude,
    longitude: doc.longitude,
    deletedAt: doc.deleted_at,
    tagIds: doc.tag_ids,
  });
}

/** A task as written at CREATE: `created_at` is mandatory (the list query orders by it). */
export type NewTask = Task & { readonly createdAt: Date };

/** Full-document encode for create (`FirebaseManager.createTask` → `save`). `tag_ids` is never encoded here. */
export function encodeTask(task: NewTask): DocumentData {
  return omitUndefined({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    life_area_id: task.lifeAreaId,
    notes: task.notes,
    due_date: task.dueDate && toTimestamp(task.dueDate),
    created_at: toTimestamp(task.createdAt),
    focus_duration_seconds: task.focusDurationSeconds,
    nudges_count: task.nudgesCount,
    completed_at: task.completedAt && toTimestamp(task.completedAt),
    at_place_id: task.atPlaceId,
    place_id: task.placeId,
    latitude: task.latitude,
    longitude: task.longitude,
    deleted_at: task.deletedAt && toTimestamp(task.deletedAt),
  });
}
