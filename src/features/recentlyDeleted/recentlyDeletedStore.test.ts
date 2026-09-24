// Ports of RecentlyDeletedServiceTests and RecentlyDeletedAdapterTests (the pure `itemsFrom` half).
import { describe, expect, it } from 'vitest';

import type { RecentlyDeletedItem, RecentlyDeletedKind } from '@/domain/recentlyDeleted';

import type { RecentlyDeletedClient } from './recentlyDeletedClient';
import { itemsFrom } from './recentlyDeletedClient';
import { createRecentlyDeletedStore } from './recentlyDeletedStore';

const now = new Date(1_800_000_000_000);
const day = 24 * 60 * 60 * 1000;
let seq = 0;
function item(
  title: string,
  daysAgo: number,
  kind: RecentlyDeletedKind = 'task',
  extra: Partial<RecentlyDeletedItem> = {},
): RecentlyDeletedItem {
  seq += 1;
  return {
    itemId: `I${seq}`,
    kind,
    title,
    deletedAt: new Date(now.getTime() - daysAgo * day),
    ...extra,
  };
}

class FakeClient implements RecentlyDeletedClient {
  waiting: RecentlyDeletedItem[] | Error = [];
  restoreError: Error | undefined;
  deleteError: Error | undefined;
  restored: RecentlyDeletedItem[] = [];
  resolved: { item: RecentlyDeletedItem; keptRestored: boolean }[] = [];
  deletedForever: RecentlyDeletedItem[] = [];
  fetchCalls = 0;
  fetchDeleted() {
    this.fetchCalls += 1;
    return this.waiting instanceof Error
      ? Promise.reject(this.waiting)
      : Promise.resolve(this.waiting);
  }
  restore(item: RecentlyDeletedItem) {
    if (this.restoreError) return Promise.reject(this.restoreError);
    this.restored.push(item);
    return Promise.resolve();
  }
  restoreResolving(item: RecentlyDeletedItem, keptRestored: boolean) {
    this.resolved.push({ item, keptRestored });
    return Promise.resolve();
  }
  deleteForever(item: RecentlyDeletedItem) {
    this.deletedForever.push(item);
    return this.deleteError ? Promise.reject(this.deleteError) : Promise.resolve();
  }
}

function make(waiting: RecentlyDeletedItem[] | Error) {
  const client = new FakeClient();
  client.waiting = waiting;
  return { client, store: createRecentlyDeletedStore(client, () => now) };
}

describe('recentlyDeletedStore', () => {
  it('load fills the list; a failed load is an error state, never the empty one', async () => {
    const { store } = make([item('Ring the dentist', 2)]);
    await store.getState().load();
    expect(store.getState().items.map((i) => i.title)).toEqual(['Ring the dentist']);
    const screen = store.getState().screen;
    expect(screen.kind === 'rows' && screen.rows.map((r) => r.title)).toEqual(['Ring the dentist']);
    const failing = make(new Error('offline'));
    await failing.store.getState().load();
    expect(failing.store.getState().screen).toEqual({ kind: 'failed', message: 'offline' });
  });
  it('restore and delete forever call the client and drop the row; failures keep it and surface', async () => {
    const doomed = item('Doomed', 1);
    const { client, store } = make([doomed, item('Keep waiting', 2)]);
    await store.getState().load();
    expect(await store.getState().restore(doomed)).toBe(true);
    expect(client.restored.map((i) => i.itemId)).toEqual([doomed.itemId]);
    expect(client.deletedForever).toEqual([]);
    expect(store.getState().items.map((i) => i.title)).toEqual(['Keep waiting']);
    const failing = make([doomed]);
    await failing.store.getState().load();
    failing.client.restoreError = new Error('offline');
    expect(await failing.store.getState().restore(doomed)).toBe(false);
    expect(failing.store.getState().items).toHaveLength(1);
    expect(failing.store.getState().errorMessage).toBe('offline');
    const last = make([doomed]);
    await last.store.getState().load();
    expect(await last.store.getState().deleteForever(doomed)).toBe(true);
    expect(last.store.getState().screen).toEqual({ kind: 'empty' });
    const failDelete = make([doomed]);
    await failDelete.store.getState().load();
    failDelete.client.deleteError = new Error('offline');
    expect(await failDelete.store.getState().deleteForever(doomed)).toBe(false);
    expect(failDelete.store.getState().items).toHaveLength(1);
  });
  it('the purge takes only what is past the window, never a future stamp, survives refusals, says nothing, and is idempotent', async () => {
    const { client, store } = make([
      item('Long gone', 31),
      item('Last day', 30),
      item('Yesterday', 1),
    ]);
    await store.getState().purge();
    expect(client.deletedForever.map((i) => i.title)).toEqual(['Long gone']);
    const future = make([item('From the future', -2)]);
    await future.store.getState().purge();
    expect(future.client.deletedForever).toEqual([]);
    const failing = make(new Error('offline'));
    await failing.store.getState().purge();
    expect(failing.store.getState().errorMessage).toBeUndefined();
    expect(failing.store.getState().screen).toEqual({ kind: 'loading' });
    const refusing = make([item('A', 40), item('B', 41)]);
    refusing.client.deleteError = new Error('refused');
    await refusing.store.getState().purge();
    expect(refusing.client.deletedForever).toHaveLength(2);
    const twice = make([item('Long gone', 31)]);
    await twice.store.getState().purge();
    await twice.store.getState().purge();
    expect(twice.client.deletedForever).toHaveLength(2);
    expect(twice.client.fetchCalls).toBe(2);
  });
  it('a colliding tag opens the survivor choice instead of writing; choosing writes once; cancelling keeps the row', async () => {
    const colliding = item('errand', 1, 'tag', {
      collision: { liveId: 'LIVE', liveName: 'Errand' },
    });
    const { client, store } = make([colliding]);
    await store.getState().load();
    expect(await store.getState().restore(colliding)).toBe(false);
    expect(store.getState().pendingSurvivorChoice).toBe(colliding);
    expect(client.restored).toEqual([]);
    expect(client.resolved).toEqual([]);
    expect(await store.getState().resolveSurvivor(colliding, false)).toBe(true);
    expect(store.getState().pendingSurvivorChoice).toBeUndefined();
    expect(client.resolved).toEqual([{ item: colliding, keptRestored: false }]);
    expect(store.getState().items).toEqual([]);
    const cancel = make([colliding]);
    await cancel.store.getState().load();
    await cancel.store.getState().restore(colliding);
    cancel.store.getState().cancelSurvivorChoice();
    expect(cancel.store.getState().pendingSurvivorChoice).toBeUndefined();
    expect(cancel.store.getState().items).toHaveLength(1);
    const free = item('someday', 1, 'tag');
    const noClash = make([free]);
    await noClash.store.getState().load();
    expect(await noClash.store.getState().restore(free)).toBe(true);
    expect(noClash.store.getState().pendingSurvivorChoice).toBeUndefined();
    expect(noClash.client.restored).toEqual([free]);
  });
});

describe('itemsFrom', () => {
  const stamp = new Date(1_700_000_000_000);
  it('drops unstamped documents, names captures by the headline rule, and folds case for tag collisions', () => {
    const items = itemsFrom({
      tasks: [
        { id: 'T1', title: 'No stamp', status: 'open', priority: 'p4' },
        { id: 'T2', title: 'Stamped', status: 'open', priority: 'p4', deletedAt: stamp },
      ],
      captures: [
        {
          id: 'C1',
          content: 'transcript',
          kind: 'voice',
          processed: false,
          createdAt: stamp,
          deletedAt: stamp,
        },
      ],
      tags: [
        { id: 'G1', name: 'ERRAND', deletedAt: stamp },
        { id: 'G2', name: 'someday', deletedAt: stamp },
      ],
      liveTags: [{ id: 'L1', name: 'errand' }],
    });
    expect(items.map((i) => [i.kind, i.title])).toEqual([
      ['task', 'Stamped'],
      ['capture', 'Voice note'],
      ['tag', 'ERRAND'],
      ['tag', 'someday'],
    ]);
    expect(items[2]?.collision).toEqual({ liveId: 'L1', liveName: 'errand' });
    expect(items[3]?.collision).toBeUndefined();
    expect(items[0]?.collision).toBeUndefined();
  });
});
