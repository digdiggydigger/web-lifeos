// Ports of AreasService/LifeAreaDetailServiceTests/LifeAreaEditorServiceTests/TagEditorServiceTests (the cases that matter on the web).
import { describe, expect, it } from 'vitest';

import type { LifeAreaPaletteEdit } from '@/data/codec/payloads/lifeAreas';
import type { LifeAreaWriteResult } from '@/data/repos/lifeAreasRepo';
import type { TagCreateResult, TagRenameResult, TagWithUsage } from '@/data/repos/tagsRepo';
import type { LifeArea, Log, Task, TaskStatus } from '@/domain/types';
import { createLifeAreaEditorStore } from '@/features/lifeAreaEditor/lifeAreaEditorStore';
import { createTagEditorStore } from '@/features/tagEditor/tagEditorStore';

import type {
  AreasClient,
  LifeAreaDetailClient,
  LifeAreaEditorClient,
  TagEditorClient,
} from './areasClient';
import { createAreasStore } from './areasStore';
import { createLifeAreaDetailStore } from './lifeAreaDetailStore';

const now = () => new Date(2026, 7, 14, 9, 41);
const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 1, archived: false };
const health: LifeArea = { id: 'H', name: 'Health', colour: '🫀', sortOrder: 0, archived: false };
const old: LifeArea = { id: 'O', name: 'Old', colour: '📦', sortOrder: 2, archived: true };
const open: Task = { id: 'T1', title: 'Open', status: 'open', priority: 'p3', lifeAreaId: 'W' };
const done: Task = {
  id: 'T2',
  title: 'Done',
  status: 'done',
  priority: 'p3',
  lifeAreaId: 'W',
  completedAt: now(),
};

describe('areasStore', () => {
  it('loads active areas by sort order with grid items; logs and captures degrade to empty', async () => {
    const client: AreasClient = {
      fetchLifeAreas: () => Promise.resolve([work, health, old]),
      fetchOpenTasks: () => Promise.resolve([open]),
      fetchAllTasks: () => Promise.resolve([open, done]),
      fetchLogs: () => Promise.reject(new Error('no journal yet')),
      fetchUnprocessedCaptures: () => Promise.resolve([{}, { lifeAreaId: 'W' }]),
    };
    const store = createAreasStore(client, now);
    await store.getState().load();
    const s = store.getState();
    expect(s.lifeAreas.map((a) => a.id)).toEqual(['H', 'W']);
    expect(s.state.kind).toBe('loaded');
    if (s.state.kind === 'loaded')
      expect(
        s.state.items.map((i) => [
          i.momentum.area.id,
          i.momentum.open,
          i.momentum.closedThisWeek,
          i.captureCount,
        ]),
      ).toEqual([
        ['H', 0, 0, 0],
        ['W', 1, 1, 1],
      ]);
    expect(s.unfiledCount).toBe(1);
    expect(s.weekShare?.caption).toBe('1 item closed: 1 Work. Nothing in Health.');
  });
  it('fails when areas or tasks fail', async () => {
    const client: AreasClient = {
      fetchLifeAreas: () => Promise.reject(new Error('boom')),
      fetchOpenTasks: () => Promise.resolve([]),
      fetchAllTasks: () => Promise.resolve([]),
      fetchLogs: () => Promise.resolve([]),
      fetchUnprocessedCaptures: () => Promise.resolve([]),
    };
    const store = createAreasStore(client, now);
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'boom' });
  });
});

describe('lifeAreaDetailStore', () => {
  const log = (daysAgo: number): Log => ({
    id: `L${daysAgo}`,
    type: 'log',
    body: 'x',
    entryDate: new Date(2026, 7, 14 - daysAgo),
    createdAt: now(),
  });
  function make(fail?: 'tasks' | 'logs') {
    const calls: [string, TaskStatus][] = [];
    const client: LifeAreaDetailClient = {
      fetchTasksForArea: () =>
        fail === 'tasks'
          ? Promise.reject(new Error('Network error'))
          : Promise.resolve([open, done]),
      fetchLogsForArea: () =>
        fail === 'logs'
          ? Promise.reject(new Error('Network error'))
          : Promise.resolve([log(2), log(0)]),
      updateStatus: (id, status) => {
        calls.push([id, status]);
        return Promise.resolve();
      },
    };
    return { calls, store: createLifeAreaDetailStore(client, 'W', now) };
  }
  it('defaults to Open, sorts logs newest first, refilters without refetching, and fails on either fetch', async () => {
    const { store } = make();
    expect(store.getState().statusFilter).toBe('open');
    await store.getState().load();
    expect(store.getState().filteredTasks.map((t) => t.id)).toEqual(['T1']);
    expect(store.getState().logs.map((l) => l.id)).toEqual(['L0', 'L2']);
    store.getState().setStatusFilter('all');
    expect(store.getState().filteredTasks).toHaveLength(2);
    const failing = make('logs');
    await failing.store.getState().load();
    expect(failing.store.getState().state).toEqual({ kind: 'failed', message: 'Network error' });
  });
  it('closes and reopens with the paired write', async () => {
    const { calls, store } = make();
    await store.getState().load();
    await store.getState().closeTask(open);
    expect(store.getState().allTasks.find((t) => t.id === 'T1')?.status).toBe('done');
    expect(await store.getState().reopenTask(open)).toBe(true);
    expect(calls).toEqual([
      ['T1', 'done'],
      ['T1', 'open'],
    ]);
  });
});

describe('lifeAreaEditorStore', () => {
  class FakeEditorClient implements LifeAreaEditorClient {
    areas: LifeArea[] = [work, health, old];
    updates: [string, { name?: string; colour?: string; palette: LifeAreaPaletteEdit }][] = [];
    creates: [string, string][] = [];
    archived: [string, boolean][] = [];
    orders: (readonly string[])[] = [];
    result: LifeAreaWriteResult = { kind: 'ok' };
    fetchCount = 0;
    fetchLifeAreas() {
      this.fetchCount += 1;
      return Promise.resolve(this.areas);
    }
    update(id: string, input: { name?: string; colour?: string; palette: LifeAreaPaletteEdit }) {
      this.updates.push([id, input]);
      return Promise.resolve(this.result);
    }
    setArchived(id: string, archived: boolean) {
      this.archived.push([id, archived]);
      return Promise.resolve();
    }
    create(name: string, colour: string) {
      this.creates.push([name, colour]);
      return Promise.resolve(this.result);
    }
    reorder(ids: readonly string[]) {
      this.orders.push(ids);
      return Promise.resolve();
    }
  }
  async function loaded() {
    const client = new FakeEditorClient();
    const store = createLifeAreaEditorStore(client);
    await store.getState().load();
    return { client, store };
  }
  it('saveEdits sends only what changed, reloads, and pops without a call when nothing changed', async () => {
    const { client, store } = await loaded();
    expect(await store.getState().saveEdits(work, '  Career ', '💼', undefined)).toBe(true);
    expect(client.updates).toEqual([['W', { name: 'Career', palette: { kind: 'unchanged' } }]]);
    expect(client.fetchCount).toBe(2);
    expect(await store.getState().saveEdits(work, 'Work', '🧑‍💻', undefined)).toBe(true);
    expect(client.updates[1]).toEqual(['W', { colour: '🧑‍💻', palette: { kind: 'unchanged' } }]);
    expect(await store.getState().saveEdits(work, 'Work', '💼', 'growth')).toBe(true);
    expect(client.updates[2]).toEqual(['W', { palette: { kind: 'set', key: 'growth' } }]);
    expect(await store.getState().saveEdits(work, 'Work', '💼', undefined)).toBe(true);
    expect(client.updates).toHaveLength(3);
    expect(await store.getState().saveEdits(work, '   ', '💼', undefined)).toBe(false);
  });
  it('a rename conflict becomes pending state without a reload; create likewise; unarchiving resolves it', async () => {
    const { client, store } = await loaded();
    client.result = { kind: 'nameConflict', conflict: { id: 'O', name: 'Old', archived: true } };
    expect(await store.getState().saveEdits(work, 'old', '💼', undefined)).toBe(false);
    expect(store.getState().pendingRenameConflict?.name).toBe('Old');
    expect(client.fetchCount).toBe(1);
    expect(await store.getState().create('old', '📦')).toBe(false);
    expect(store.getState().pendingCreateConflict?.archived).toBe(true);
    expect(
      await store.getState().unarchiveConflicting(store.getState().pendingCreateConflict!),
    ).toBe(true);
    expect(client.archived).toEqual([['O', false]]);
    expect(store.getState().pendingCreateConflict).toBeUndefined();
    expect(store.getState().infoMessage).toBe('Unarchived “Old”.');
  });
  it('create, archive, and arrange write and reload; a second mutation in flight is rejected', async () => {
    const { client, store } = await loaded();
    expect(await store.getState().create(' Garden ', '🌱')).toBe(true);
    expect(client.creates).toEqual([['Garden', '🌱']]);
    expect(await store.getState().setArchived(work, true)).toBe(true);
    expect(store.getState().infoMessage).toBe('Archived “Work”.');
    expect(await store.getState().moveActive('W', -1)).toBe(true);
    expect(client.orders).toEqual([['W', 'H', 'O']]);
    expect(await store.getState().moveActive('H', -1)).toBe(false);
    const first = store.getState().create('A', '🅰️');
    const second = store.getState().create('B', '🅱️');
    expect(await second).toBe(false);
    expect(await first).toBe(true);
  });
});

describe('tagEditorStore', () => {
  class FakeTagClient implements TagEditorClient {
    tags: TagWithUsage[] = [
      { id: 'C', name: 'Cherry', usageCount: 2 },
      { id: 'A', name: 'apple', usageCount: 0 },
      { id: 'B', name: 'Banana', usageCount: 1 },
    ];
    renameResult: TagRenameResult = { kind: 'renamed' };
    createResult: TagCreateResult = {
      kind: 'created',
      tag: { id: 'N', name: 'new', usageCount: 0 },
    };
    renames: [string, string][] = [];
    merges: [string, string][] = [];
    deleted: string[] = [];
    restored: string[] = [];
    failRestore = false;
    fetchTags() {
      return Promise.resolve(this.tags);
    }
    renameTag(id: string, name: string) {
      this.renames.push([id, name]);
      return Promise.resolve(this.renameResult);
    }
    mergeTag(id: string, into: string) {
      this.merges.push([id, into]);
      return Promise.resolve();
    }
    softDeleteTag(id: string) {
      this.deleted.push(id);
      this.tags = this.tags.filter((t) => t.id !== id);
      return Promise.resolve();
    }
    restoreTag(id: string) {
      this.restored.push(id);
      return this.failRestore
        ? Promise.reject(new Error("Couldn't reach the server."))
        : Promise.resolve();
    }
    createTag() {
      return Promise.resolve(this.createResult);
    }
  }
  async function loaded() {
    const client = new FakeTagClient();
    const store = createTagEditorStore(client);
    await store.getState().load();
    return { client, store };
  }
  it('sorts case-insensitively; rename valid renames, conflict sets a pending merge, unchanged writes nothing', async () => {
    const { client, store } = await loaded();
    expect(store.getState().tags.map((t) => t.name)).toEqual(['apple', 'Banana', 'Cherry']);
    const apple = store.getState().tags[0]!;
    expect(await store.getState().rename(apple, ' apples ')).toBe(true);
    expect(client.renames).toEqual([['A', 'apples']]);
    expect(await store.getState().rename(apple, 'apple')).toBe(false);
    client.renameResult = { kind: 'needsMerge', id: 'B', name: 'Banana', usageCount: 1 };
    expect(await store.getState().rename(apple, 'banana')).toBe(false);
    expect(store.getState().pendingMergeConflict).toEqual({
      id: 'B',
      name: 'Banana',
      usageCount: 1,
    });
    expect(await store.getState().confirmMerge(apple, 'Banana')).toBe(true);
    expect(client.merges).toEqual([['A', 'Banana']]);
    expect(store.getState().pendingMergeConflict).toBeUndefined();
  });
  it('soft delete shrinks the list; restore reloads and surfaces failure; create reports an existing name', async () => {
    const { client, store } = await loaded();
    const cherry = store.getState().tags[2]!;
    expect(await store.getState().softDelete(cherry)).toBe(true);
    expect(store.getState().tags).toHaveLength(2);
    client.failRestore = true;
    expect(await store.getState().restore('C')).toBe(false);
    expect(store.getState().errorMessage).toBe("Couldn't reach the server.");
    client.createResult = {
      kind: 'alreadyExisted',
      tag: { id: 'A', name: 'apple', usageCount: 0 },
    };
    expect(await store.getState().create('apple')).toBe(true);
    expect(store.getState().infoMessage).toBe('"apple" already exists.');
    expect(await store.getState().create('  ')).toBe(false);
  });
});
