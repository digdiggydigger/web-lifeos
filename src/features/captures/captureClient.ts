/** `CaptureClientAdapting`, the seam `CaptureInboxService` is tested through, plus the Firebase conformance. */
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

import { newCapture } from '@/data/codec/payloads/captures';
import type { CaptureUpdate } from '@/data/codec/payloads/captures';
import * as captures from '@/data/repos/capturesRepo';
import type { UploadedMedia } from '@/data/repos/capturesRepo';
import { fetchLifeAreas } from '@/data/repos/lifeAreasRepo';
import * as tags from '@/data/repos/tagsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import type { NormalizedCreateCaptureInput } from '@/domain/captures';
import type { Capture, LifeArea, Tag, Task, TaskPriority } from '@/domain/types';
import { newId } from '@/data/codec/ids';

/** `NormalizedPromoteToTaskInput`. */
export interface PromoteToTaskInput {
  readonly title: string;
  readonly notes: string | undefined;
  readonly lifeAreaId: string | undefined;
  readonly priority: TaskPriority;
  readonly dueDate: Date | undefined;
  readonly focusDurationSeconds: number | undefined;
}

export interface CaptureClient {
  createCapture(input: NormalizedCreateCaptureInput, mediaURL?: string): Promise<Capture>;
  fetchUnprocessedCaptures(): Promise<Capture[]>;
  fetchProcessedCaptures(): Promise<Capture[]>;
  fetchSeenCaptures(): Promise<Capture[]>;
  fetchCaptures(): Promise<Capture[]>;
  fetchCapture(id: string): Promise<Capture>;
  fetchLifeAreas(): Promise<LifeArea[]>;
  createTask(input: PromoteToTaskInput): Promise<Task>;
  markProcessed(captureId: string): Promise<void>;
  markUnprocessed(captureId: string): Promise<void>;
  softDeleteCapture(id: string): Promise<void>;
  restoreCapture(id: string): Promise<void>;
  updateCapture(id: string, changes: CaptureUpdate): Promise<Capture>;
  fetchAllTags(): Promise<Tag[]>;
  createTag(name: string): Promise<Tag>;
  fetchTags(captureId: string): Promise<Tag[]>;
  addTag(captureId: string, tagId: string): Promise<void>;
  removeTag(captureId: string, tagId: string): Promise<void>;
  uploadMedia(data: Blob, contentType: string): Promise<UploadedMedia>;
}

export const ALREADY_PROCESSED_ERROR = 'This capture has already been processed.';

export function firebaseCaptureClient(
  db: Firestore,
  storage: FirebaseStorage,
  uid: string,
  now: () => Date = () => new Date(),
): CaptureClient {
  return {
    createCapture: async (input, mediaURL) => {
      const capture = newCapture(input, now(), mediaURL);
      await captures.saveCapture(db, uid, capture);
      return capture;
    },
    fetchUnprocessedCaptures: () => captures.fetchUnprocessedCaptures(db, uid),
    fetchProcessedCaptures: () => captures.fetchProcessedCaptures(db, uid),
    fetchSeenCaptures: () => captures.fetchSeenCaptures(db, uid),
    fetchCaptures: async () => (await captures.fetchCaptures(db, uid)).items.slice(),
    fetchCapture: (id) => captures.fetchCapture(db, uid, id),
    fetchLifeAreas: async () =>
      (await fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
    createTask: async (input) => {
      const task: Task & { createdAt: Date } = {
        id: newId(),
        title: input.title,
        status: 'open',
        priority: input.priority,
        createdAt: now(),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.lifeAreaId !== undefined ? { lifeAreaId: input.lifeAreaId } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.focusDurationSeconds !== undefined
          ? { focusDurationSeconds: input.focusDurationSeconds }
          : {}),
      };
      await tasks.createTask(db, uid, task);
      return task;
    },
    markProcessed: (id) => captures.markCaptureProcessed(db, uid, id, now()),
    markUnprocessed: (id) => captures.markCaptureUnprocessed(db, uid, id),
    softDeleteCapture: (id) => captures.softDeleteCapture(db, uid, id, now()),
    restoreCapture: (id) => captures.restoreCapture(db, uid, id),
    updateCapture: (id, changes) => captures.updateCapture(db, uid, id, changes),
    fetchAllTags: async () => (await tags.fetchTags(db, uid)).items.slice(),
    createTag: (name) => tags.createTagDeduplicating(db, uid, name),
    fetchTags: (captureId) => tags.fetchTagsForParent(db, uid, 'captures', captureId),
    addTag: (captureId, tagId) => tags.addTagToParent(db, uid, 'captures', captureId, tagId),
    removeTag: (captureId, tagId) =>
      tags.removeTagFromParent(db, uid, 'captures', captureId, tagId),
    uploadMedia: (data, contentType) =>
      captures.uploadCaptureMedia(storage, uid, data, contentType),
  };
}
