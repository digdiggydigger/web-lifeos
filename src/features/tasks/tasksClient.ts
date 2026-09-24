/**
 * The narrow seams the Tasks services depend on (`TasksClientAdapting`, `TaskCreateClientAdapting`,
 * `TaskDetailClientAdapting`), and their Firebase implementation over the repos.
 */
import type { Firestore } from 'firebase/firestore';

import { newId } from '@/data/codec/ids';
import type { TaskUpdatePayload } from '@/data/codec/payloads/tasks';
import { fetchLifeAreas } from '@/data/repos/lifeAreasRepo';
import * as tags from '@/data/repos/tagsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import type { NormalizedCreateTaskInput } from '@/domain/tasks';
import type { LifeArea, Tag, Task, TaskStatus } from '@/domain/types';

export interface TasksClient {
  fetchLifeAreas(): Promise<LifeArea[]>;
  fetchAllTasks(): Promise<Task[]>;
  setStatus(taskId: string, status: TaskStatus): Promise<void>;
}

export interface TaskCreateClient {
  createTask(input: NormalizedCreateTaskInput): Promise<Task>;
  updateTask(taskId: string, payload: TaskUpdatePayload): Promise<Task>;
}

export interface TaskDetailClient {
  fetchTask(taskId: string): Promise<Task>;
  fetchTagsForTask(taskId: string): Promise<Tag[]>;
  fetchAllTags(): Promise<Tag[]>;
  updateTask(taskId: string, payload: TaskUpdatePayload): Promise<Task>;
  updateStatus(taskId: string, status: TaskStatus): Promise<Task>;
  softDeleteTask(taskId: string): Promise<void>;
  restoreTask(taskId: string): Promise<void>;
  createTag(name: string): Promise<Tag>;
  addTagToTask(taskId: string, tagId: string): Promise<void>;
  removeTagFromTask(taskId: string, tagId: string): Promise<void>;
}

export type TaskClients = TasksClient & TaskCreateClient & TaskDetailClient;

export function firebaseTaskClients(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): TaskClients {
  return {
    fetchLifeAreas: async () =>
      (await fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
    fetchAllTasks: async () => (await tasks.fetchTasks(db, uid)).items.slice(),
    setStatus: (taskId, status) => tasks.setTaskStatus(db, uid, taskId, status, now()),
    createTask: async (input) => {
      const task: Task & { createdAt: Date } = {
        id: newId(),
        status: 'open',
        createdAt: now(),
        ...input,
      };
      await tasks.createTask(db, uid, task);
      return task;
    },
    updateTask: (taskId, payload) => tasks.updateTask(db, uid, taskId, payload),
    fetchTask: (taskId) => tasks.fetchTask(db, uid, taskId),
    fetchTagsForTask: (taskId) => tags.fetchTagsForParent(db, uid, 'tasks', taskId),
    fetchAllTags: async () => (await tags.fetchTags(db, uid)).items.slice(),
    updateStatus: async (taskId, status) => {
      await tasks.setTaskStatus(db, uid, taskId, status, now());
      return tasks.fetchTask(db, uid, taskId);
    },
    softDeleteTask: (taskId) => tasks.softDeleteTask(db, uid, taskId, now()),
    restoreTask: (taskId) => tasks.restoreTask(db, uid, taskId),
    createTag: (name) => tags.createTagDeduplicating(db, uid, name),
    addTagToTask: (taskId, tagId) => tags.addTagToParent(db, uid, 'tasks', taskId, tagId),
    removeTagFromTask: (taskId, tagId) => tags.removeTagFromParent(db, uid, 'tasks', taskId, tagId),
  };
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
