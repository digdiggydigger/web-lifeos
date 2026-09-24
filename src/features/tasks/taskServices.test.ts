// Ports of TaskCreateServiceTests and TaskDetailServiceTests.
import { describe, expect, it } from 'vitest';

import type { TaskUpdatePayload } from '@/data/codec/payloads/tasks';
import type { NormalizedCreateTaskInput } from '@/domain/tasks';
import { editedFieldsFrom } from '@/domain/tasks';
import type { LifeArea, Tag, Task, TaskStatus } from '@/domain/types';

import {
  createTaskFlow,
  isTitleValid,
  offeredAreas,
  TIME_NOT_SAVED_WARNING,
} from './taskCreateService';
import { createTaskDetailStore } from './taskDetailStore';
import type { TaskCreateClient, TaskDetailClient } from './tasksClient';

class FakeCreateClient implements TaskCreateClient {
  created: NormalizedCreateTaskInput[] = [];
  updates: [string, TaskUpdatePayload][] = [];
  failCreate: Error | undefined;
  failUpdate: Error | undefined;
  createTask(input: NormalizedCreateTaskInput): Promise<Task> {
    this.created.push(input);
    if (this.failCreate) return Promise.reject(this.failCreate);
    return Promise.resolve({ id: 'NEW', status: 'open', ...input });
  }
  updateTask(taskId: string, payload: TaskUpdatePayload): Promise<Task> {
    this.updates.push([taskId, payload]);
    if (this.failUpdate) return Promise.reject(this.failUpdate);
    return Promise.resolve({ id: taskId, title: 'x', status: 'open', priority: 'p4' });
  }
}

describe('createTaskFlow', () => {
  it('creates the task, then writes the chosen time, and reports success', async () => {
    const client = new FakeCreateClient();
    const due = new Date(2026, 7, 14);
    const outcome = await createTaskFlow(client, {
      title: ' Walk ',
      lifeAreaId: 'W',
      dueDate: due,
      effort: 'thirty',
    });
    expect(outcome.ok).toBe(true);
    expect(client.created).toEqual([
      { title: 'Walk', priority: 'p4', lifeAreaId: 'W', dueDate: due },
    ]);
    expect(client.updates).toEqual([['NEW', { focusDurationSeconds: 1800 }]]);
  });

  it('writes fifteen minutes when the time is left alone, and no date when none picked', async () => {
    const client = new FakeCreateClient();
    await createTaskFlow(client, { title: 'Walk', effort: 'fifteen' });
    expect(client.created[0]).toEqual({ title: 'Walk', priority: 'p4' });
    expect(client.updates[0]?.[1]).toEqual({ focusDurationSeconds: 900 });
  });

  it('refuses an empty title without calling the client', async () => {
    const client = new FakeCreateClient();
    expect(await createTaskFlow(client, { title: '  ', effort: 'fifteen' })).toEqual({
      ok: false,
      error: 'Title is required.',
    });
    expect(client.created).toEqual([]);
    expect(isTitleValid('  ')).toBe(false);
    expect(isTitleValid(' x ')).toBe(true);
  });

  it('surfaces an insert failure and writes no time', async () => {
    const client = new FakeCreateClient();
    client.failCreate = new Error('insert failed');
    expect(await createTaskFlow(client, { title: 'Walk', effort: 'fifteen' })).toEqual({
      ok: false,
      error: 'insert failed',
    });
    expect(client.updates).toEqual([]);
  });

  it('still counts the task as created when only the time fails, with a warning', async () => {
    const client = new FakeCreateClient();
    client.failUpdate = new Error('time failed');
    const outcome = await createTaskFlow(client, { title: 'Walk', effort: 'fifteen' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.warning).toBe(TIME_NOT_SAVED_WARNING);
  });

  it('offers non-archived areas plus the selected one even if archived', () => {
    const areas: LifeArea[] = [
      { id: 'A', name: 'A', colour: 'a', sortOrder: 0, archived: false },
      { id: 'B', name: 'B', colour: 'b', sortOrder: 1, archived: true },
    ];
    expect(offeredAreas(areas, undefined).map((a) => a.id)).toEqual(['A']);
    expect(offeredAreas(areas, 'B').map((a) => a.id)).toEqual(['A', 'B']);
  });
});

const task: Task = { id: 'T', title: 'Original', notes: 'Notes', status: 'open', priority: 'p3' };
const errand: Tag = { id: 'TAG1', name: 'errand' };
const focus: Tag = { id: 'TAG2', name: 'focus' };

class FakeDetailClient implements TaskDetailClient {
  task: Task = task;
  taskTags: Tag[] = [errand];
  allTags: Tag[] = [errand, focus];
  failFetch: Error | undefined;
  failUpdate: Error | undefined;
  failDelete: Error | undefined;
  updates: TaskUpdatePayload[] = [];
  statusCalls: TaskStatus[] = [];
  createdTags: string[] = [];
  added: string[] = [];
  removed: string[] = [];
  deleted = 0;
  fetchTask() {
    return this.failFetch ? Promise.reject(this.failFetch) : Promise.resolve(this.task);
  }
  fetchTagsForTask() {
    return Promise.resolve(this.taskTags);
  }
  fetchAllTags() {
    return Promise.resolve(this.allTags);
  }
  updateTask(_id: string, payload: TaskUpdatePayload) {
    this.updates.push(payload);
    if (this.failUpdate) return Promise.reject(this.failUpdate);
    this.task = { ...this.task, ...(payload.title ? { title: payload.title } : {}) };
    return Promise.resolve(this.task);
  }
  updateStatus(_id: string, status: TaskStatus) {
    this.statusCalls.push(status);
    this.task = { ...this.task, status };
    return Promise.resolve(this.task);
  }
  softDeleteTask() {
    this.deleted += 1;
    return this.failDelete ? Promise.reject(this.failDelete) : Promise.resolve();
  }
  restoreTask() {
    return Promise.resolve();
  }
  createTag(name: string) {
    this.createdTags.push(name);
    return Promise.resolve({ id: `NEW-${name}`, name });
  }
  addTagToTask(_id: string, tagId: string) {
    this.added.push(tagId);
    return Promise.resolve();
  }
  removeTagFromTask(_id: string, tagId: string) {
    this.removed.push(tagId);
    return Promise.resolve();
  }
}

async function loaded() {
  const client = new FakeDetailClient();
  const store = createTaskDetailStore(client, 'T');
  await store.getState().load();
  return { client, store };
}

describe('taskDetailStore', () => {
  it('loads the task, its tags, and every tag for the chip row', async () => {
    const { store } = await loaded();
    expect(store.getState().state).toEqual({ kind: 'loaded', task });
    expect(store.getState().tags).toEqual([errand]);
    expect(store.getState().allTags).toEqual([errand, focus]);
  });

  it('fails the load with the error text', async () => {
    const client = new FakeDetailClient();
    client.failFetch = new Error('gone');
    const store = createTaskDetailStore(client, 'T');
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'gone' });
  });

  it('save: partial fields update the state; an invalid title is rejected before the network; no change needs no call', async () => {
    const { client, store } = await loaded();
    expect(await store.getState().save({ ...editedFieldsFrom(task), title: 'Renamed' })).toBe(true);
    expect(client.updates).toEqual([{ title: 'Renamed' }]);
    expect((store.getState().state as { task: Task }).task.title).toBe('Renamed');
    expect(await store.getState().save({ ...editedFieldsFrom(client.task), title: '  ' })).toBe(
      false,
    );
    expect(store.getState().errorMessage).toBe('Title is required.');
    expect(client.updates).toHaveLength(1);
    expect(await store.getState().save(editedFieldsFrom(client.task))).toBe(true);
    expect(client.updates).toHaveLength(1);
  });

  it('close and reopen write the status once and decline when already there', async () => {
    const { client, store } = await loaded();
    await store.getState().close();
    await store.getState().close();
    expect(client.statusCalls).toEqual(['done']);
    expect(await store.getState().reopen()).toBe(true);
    expect(await store.getState().reopen()).toBe(false);
    expect(client.statusCalls).toEqual(['done', 'open']);
  });

  it('soft delete reports success or surfaces the error', async () => {
    const { client, store } = await loaded();
    expect(await store.getState().softDelete()).toBe(true);
    client.failDelete = new Error('denied');
    expect(await store.getState().softDelete()).toBe(false);
    expect(store.getState().errorMessage).toBe('denied');
    expect(client.deleted).toBe(2);
  });

  it('tags: toggle attaches or removes; addTag reuses an exact match or creates then attaches, joining the row', async () => {
    const { client, store } = await loaded();
    await store.getState().toggleTag(focus);
    expect(client.added).toEqual(['TAG2']);
    expect(store.getState().tags.map((t) => t.id)).toEqual(['TAG1', 'TAG2']);
    await store.getState().toggleTag(errand);
    expect(client.removed).toEqual(['TAG1']);
    await store.getState().addTag(' errand ');
    expect(client.createdTags).toEqual([]);
    expect(client.added).toEqual(['TAG2', 'TAG1']);
    await store.getState().addTag('quick-win');
    expect(client.createdTags).toEqual(['quick-win']);
    expect(store.getState().allTags.map((t) => t.name)).toEqual(['errand', 'focus', 'quick-win']);
    expect(store.getState().tags.map((t) => t.name)).toContain('quick-win');
    await store.getState().addTag('   ');
    expect(client.createdTags).toEqual(['quick-win']);
  });
});
