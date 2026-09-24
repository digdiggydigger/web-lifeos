/** Seams for the Areas tab, the area detail, the Life Areas editor and the Tag Editor, plus their Firebase implementation. */
import type { Firestore } from 'firebase/firestore';

import type { LifeAreaPaletteEdit } from '@/data/codec/payloads/lifeAreas';
import * as areas from '@/data/repos/lifeAreasRepo';
import type { LifeAreaWriteResult } from '@/data/repos/lifeAreasRepo';
import * as logs from '@/data/repos/logsRepo';
import * as tags from '@/data/repos/tagsRepo';
import type { TagCreateResult, TagRenameResult, TagWithUsage } from '@/data/repos/tagsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import type { LifeArea, Log, Task, TaskStatus } from '@/domain/types';

export interface AreasClient {
  fetchLifeAreas(): Promise<LifeArea[]>;
  fetchOpenTasks(): Promise<Task[]>;
  fetchAllTasks(): Promise<Task[]>;
  fetchLogs(): Promise<Log[]>;
  /** Unprocessed captures; the inbox arrives in M1.4, until then an empty list. */
  fetchUnprocessedCaptures(): Promise<{ readonly lifeAreaId?: string }[]>;
}

export interface LifeAreaDetailClient {
  fetchTasksForArea(lifeAreaId: string): Promise<Task[]>;
  fetchLogsForArea(lifeAreaId: string): Promise<Log[]>;
  updateStatus(taskId: string, status: TaskStatus): Promise<void>;
}

export interface LifeAreaEditorClient {
  fetchLifeAreas(): Promise<LifeArea[]>;
  update(
    id: string,
    input: { name?: string; colour?: string; palette: LifeAreaPaletteEdit },
  ): Promise<LifeAreaWriteResult>;
  setArchived(id: string, archived: boolean): Promise<void>;
  create(name: string, colour: string): Promise<LifeAreaWriteResult>;
  reorder(orderedIds: readonly string[]): Promise<void>;
}

export interface TagEditorClient {
  fetchTags(): Promise<TagWithUsage[]>;
  renameTag(id: string, name: string): Promise<TagRenameResult>;
  mergeTag(id: string, intoName: string): Promise<void>;
  softDeleteTag(id: string): Promise<void>;
  restoreTag(id: string): Promise<void>;
  createTag(name: string): Promise<TagCreateResult>;
}

export type AreaClients = AreasClient &
  LifeAreaDetailClient &
  LifeAreaEditorClient &
  TagEditorClient;

export function firebaseAreaClients(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): AreaClients {
  return {
    fetchLifeAreas: async () =>
      (await areas.fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
    fetchOpenTasks: async () => (await tasks.fetchOpenTasks(db, uid)).items.slice(),
    fetchAllTasks: async () => (await tasks.fetchTasks(db, uid)).items.slice(),
    fetchLogs: async () => (await logs.fetchLogs(db, uid)).items.slice(),
    fetchUnprocessedCaptures: () => Promise.resolve([]),
    fetchTasksForArea: async (lifeAreaId) =>
      (await tasks.fetchTasksForLifeArea(db, uid, lifeAreaId)).items.slice(),
    fetchLogsForArea: async (lifeAreaId) =>
      (await logs.fetchLogsForLifeArea(db, uid, lifeAreaId)).items.slice(),
    updateStatus: (taskId, status) => tasks.setTaskStatus(db, uid, taskId, status, now()),
    update: (id, input) => areas.updateLifeArea(db, uid, id, input),
    setArchived: (id, archived) => areas.setLifeAreaArchived(db, uid, id, archived),
    create: (name, colour) => areas.createLifeArea(db, uid, name, colour),
    reorder: (orderedIds) => areas.reorderLifeAreas(db, uid, orderedIds),
    fetchTags: () => tags.fetchTagsWithUsage(db, uid),
    renameTag: (id, name) => tags.renameTag(db, uid, id, name),
    mergeTag: (id, intoName) => tags.mergeTagInto(db, uid, id, intoName),
    softDeleteTag: (id) => tags.softDeleteTag(db, uid, id, now()),
    restoreTag: (id) => tags.restoreTag(db, uid, id),
    createTag: (name) => tags.createTag(db, uid, name),
  };
}
