// Ports of TasksServiceTests, TasksServiceMutationTests and the list half of UndoCapsuleReopenTests.
import { describe, expect, it } from 'vitest';

import type { LifeArea, Task, TaskStatus } from '@/domain/types';

import { createTasksStore } from './tasksStore';
import type { TasksClient } from './tasksClient';

const now = () => new Date(2026, 7, 14, 9, 41);
const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
const dated: Task = {
  id: 'A',
  title: 'Due today',
  status: 'open',
  priority: 'p3',
  dueDate: new Date(2026, 7, 14),
  lifeAreaId: 'W',
};
const undated: Task = { id: 'B', title: 'Undated', status: 'open', priority: 'p3' };

class FakeTasksClient implements TasksClient {
  lifeAreas: LifeArea[] = [work];
  tasks: Task[] = [dated, undated];
  failFetch: Error | undefined;
  failSetStatus: Error | undefined;
  fetchCount = 0;
  setStatusCalls: [string, TaskStatus][] = [];
  fetchLifeAreas() {
    return this.failFetch ? Promise.reject(this.failFetch) : Promise.resolve(this.lifeAreas);
  }
  fetchAllTasks() {
    this.fetchCount += 1;
    return this.failFetch ? Promise.reject(this.failFetch) : Promise.resolve(this.tasks);
  }
  setStatus(taskId: string, status: TaskStatus) {
    this.setStatusCalls.push([taskId, status]);
    return this.failSetStatus ? Promise.reject(this.failSetStatus) : Promise.resolve();
  }
}

function make() {
  const client = new FakeTasksClient();
  return { client, store: createTasksStore(client, now) };
}
const groupNames = (store: ReturnType<typeof make>['store']) => {
  const s = store.getState().state;
  return s.kind === 'loaded' ? s.groups.map((g) => g.lifeAreaName) : s.kind;
};

describe('load', () => {
  it('starts loading, then groups; Momentum excludes undated tasks and Open shows them', async () => {
    const { store } = make();
    expect(store.getState().state.kind).toBe('loading');
    expect(store.getState().statusFilter).toBe('momentum');
    await store.getState().load();
    expect(groupNames(store)).toEqual(['Due today · 1']);
    store.getState().setStatusFilter('open');
    expect(groupNames(store)).toEqual(['Work', 'Unassigned']);
  });

  it('sets failed on a fetch failure and recovers on the next load', async () => {
    const { client, store } = make();
    client.failFetch = new Error('offline');
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'offline' });
    client.failFetch = undefined;
    await store.getState().load();
    expect(store.getState().state.kind).toBe('loaded');
  });

  it('does not flash loading on a reload, and empty data loads empty groups', async () => {
    const { client, store } = make();
    await store.getState().load();
    const seen: string[] = [];
    const stop = store.subscribe((s) => seen.push(s.state.kind));
    await store.getState().load();
    stop();
    expect(seen).not.toContain('loading');
    client.tasks = [];
    await store.getState().load();
    expect(groupNames(store)).toEqual([]);
  });

  it('changing the filter before load does nothing; after load it regroups without refetching', async () => {
    const { client, store } = make();
    store.getState().setStatusFilter('done');
    expect(store.getState().state.kind).toBe('loading');
    await store.getState().load();
    const fetches = client.fetchCount;
    store.getState().setStatusFilter('all');
    store.getState().setSearchText('due');
    expect(client.fetchCount).toBe(fetches);
    expect(groupNames(store)).toEqual(['Work']);
    store.getState().setStatusFilter('done');
    expect(groupNames(store)).toEqual([]);
  });
});

describe('close and reopen', () => {
  it("closes an open task optimistically with today's stamp, persisting done", async () => {
    const { client, store } = make();
    await store.getState().load();
    await store.getState().close(dated);
    expect(client.setStatusCalls).toEqual([['A', 'done']]);
    const closed = store.getState().tasks.find((t) => t.id === 'A')!;
    expect(closed.status).toBe('done');
    expect(closed.completedAt).toEqual(now());
    expect(groupNames(store)).toEqual(['Closed today · 1']);
  });

  it('is a no-op on a done task, or before load', async () => {
    const { client, store } = make();
    await store.getState().close(dated);
    expect(client.setStatusCalls).toEqual([]);
    client.tasks = [{ ...dated, status: 'done', completedAt: now() }];
    await store.getState().load();
    await store.getState().close(client.tasks[0]!);
    expect(client.setStatusCalls).toEqual([]);
  });

  it('reverts to server truth and surfaces the error on failure', async () => {
    const { client, store } = make();
    await store.getState().load();
    client.failSetStatus = new Error('network down');
    await store.getState().close(dated);
    expect(store.getState().mutationErrorMessage).toBe('network down');
    expect(client.fetchCount).toBe(2);
    expect(store.getState().tasks.find((t) => t.id === 'A')?.status).toBe('open');
  });

  it('reopen flips a closed row back and writes open; declines when already open or unloaded', async () => {
    const { client, store } = make();
    expect(await store.getState().reopen(dated)).toBe(false);
    await store.getState().load();
    expect(await store.getState().reopen(dated)).toBe(false);
    await store.getState().close(dated);
    expect(await store.getState().reopen(dated)).toBe(true);
    expect(client.setStatusCalls).toEqual([
      ['A', 'done'],
      ['A', 'open'],
    ]);
    expect(store.getState().tasks.find((t) => t.id === 'A')?.completedAt).toBeUndefined();
    client.failSetStatus = new Error('nope');
    await store.getState().close(dated);
    expect(store.getState().mutationErrorMessage).toBe('nope');
  });
});
