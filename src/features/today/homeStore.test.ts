// Port of HomeServiceTests, plus the web's side inputs (captures, focus) degrading independently.
import { describe, expect, it } from 'vitest';

import type { Capture, LifeArea, Task } from '@/domain/types';

import type { HomeClient } from './homeClient';
import { activeAreas, archivedAreas, createHomeStore } from './homeStore';

const now = () => new Date(2026, 7, 14, 9, 41);
const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
const play: LifeArea = { id: 'P', name: 'Play', colour: '🎲', sortOrder: 1, archived: false };
const old: LifeArea = { id: 'O', name: 'Old', colour: '🗂️', sortOrder: 2, archived: true };
const openWork: Task = { id: 'T1', title: 'Open', status: 'open', priority: 'p3', lifeAreaId: 'W' };
const done: Task = {
  id: 'T2',
  title: 'Closed',
  status: 'done',
  priority: 'p3',
  completedAt: now(),
};

function fakeClient(
  overrides: Partial<HomeClient> = {},
): HomeClient & { calls: string[]; orders: (readonly string[])[] } {
  const calls: string[] = [];
  const orders: (readonly string[])[] = [];
  return {
    calls,
    orders,
    fetchLifeAreas: () => {
      calls.push('areas');
      return Promise.resolve([]);
    },
    fetchOpenTasks: () => {
      calls.push('open');
      return Promise.resolve([]);
    },
    fetchAllTasks: () => Promise.resolve([]),
    reorder: (order) => {
      orders.push(order);
      return Promise.resolve();
    },
    setStatus: () => Promise.resolve(),
    fetchUnprocessedCaptures: () => Promise.resolve([]),
    fetchSeenCaptures: () => Promise.resolve([]),
    fetchProcessedCaptures: () => Promise.resolve([]),
    fetchFocusSessions: () => Promise.resolve([]),
    ...overrides,
  };
}

async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !condition(); i += 1) await Promise.resolve();
  if (!condition()) throw new Error('condition was never met');
}

describe('homeStore', () => {
  it('starts loading, then loads counts for active areas only while keeping the full set', async () => {
    const client = fakeClient({
      fetchLifeAreas: () => Promise.resolve([work, old]),
      fetchOpenTasks: () => Promise.resolve([openWork]),
    });
    const store = createHomeStore(client, now);
    expect(store.getState().state).toEqual({ kind: 'loading' });
    await store.getState().load();
    expect(store.getState().state).toEqual({
      kind: 'loaded',
      counts: [{ lifeArea: work, openTaskCount: 1 }],
    });
    expect(store.getState().lifeAreas.map((a) => a.id)).toEqual(['W', 'O']);
    expect(activeAreas(store.getState().lifeAreas).map((a) => a.id)).toEqual(['W']);
    expect(archivedAreas(store.getState().lifeAreas).map((a) => a.id)).toEqual(['O']);
  });

  it('fetches all tasks for the scoreboard; a failed fetch still loads the screen and keeps the last known set', async () => {
    let allTasks: () => Promise<Task[]> = () => Promise.resolve([done]);
    const client = fakeClient({
      fetchLifeAreas: () => Promise.resolve([work]),
      fetchAllTasks: () => allTasks(),
    });
    const store = createHomeStore(client, now);
    await store.getState().load();
    expect(store.getState().allTasks).toEqual([done]);

    allTasks = () => Promise.reject(new Error('offline'));
    await store.getState().load();
    expect(store.getState().state.kind).toBe('loaded');
    expect(store.getState().allTasks).toEqual([done]);

    const fresh = createHomeStore(
      fakeClient({
        fetchLifeAreas: () => Promise.resolve([work]),
        fetchAllTasks: () => Promise.reject(new Error('offline')),
      }),
      now,
    );
    await fresh.getState().load();
    expect(fresh.getState().state).toEqual({
      kind: 'loaded',
      counts: [{ lifeArea: work, openTaskCount: 0 }],
    });
    expect(fresh.getState().allTasks).toEqual([]);
  });

  it('empty data loads zero counts with one fetch each; either required fetch failing fails the screen; a retry recovers', async () => {
    const client = fakeClient({
      fetchLifeAreas: () => {
        client.calls.push('areas');
        return Promise.resolve([work]);
      },
    });
    const store = createHomeStore(client, now);
    await store.getState().load();
    expect(store.getState().state).toEqual({
      kind: 'loaded',
      counts: [{ lifeArea: work, openTaskCount: 0 }],
    });
    expect(client.calls.filter((c) => c === 'areas')).toHaveLength(1);
    expect(client.calls.filter((c) => c === 'open')).toHaveLength(1);

    const areasDown = createHomeStore(
      fakeClient({ fetchLifeAreas: () => Promise.reject(new Error('Network error')) }),
      now,
    );
    await areasDown.getState().load();
    expect(areasDown.getState().state).toEqual({ kind: 'failed', message: 'Network error' });

    const tasksDown = createHomeStore(
      fakeClient({ fetchOpenTasks: () => Promise.reject(new Error('Network error')) }),
      now,
    );
    await tasksDown.getState().load();
    expect(tasksDown.getState().state).toEqual({ kind: 'failed', message: 'Network error' });

    let areas: () => Promise<LifeArea[]> = () => Promise.reject(new Error('Network error'));
    const retry = createHomeStore(fakeClient({ fetchLifeAreas: () => areas() }), now);
    await retry.getState().load();
    expect(retry.getState().state.kind).toBe('failed');
    areas = () => Promise.resolve([work]);
    await retry.getState().load();
    expect(retry.getState().state).toEqual({
      kind: 'loaded',
      counts: [{ lifeArea: work, openTaskCount: 0 }],
    });
  });

  it('a reload over loaded content never flashes loading', async () => {
    const store = createHomeStore(fakeClient(), now);
    await store.getState().load();
    const kinds: string[] = [];
    const stop = store.subscribe((s) => kinds.push(s.state.kind));
    await store.getState().load();
    stop();
    expect(kinds).not.toContain('loading');
  });

  it('reorder builds the complete payload (active first, then archived), serialises and coalesces to the latest', async () => {
    const client = fakeClient({ fetchLifeAreas: () => Promise.resolve([work, play, old]) });
    const store = createHomeStore(client, now);
    await store.getState().load();
    await store.getState().submitReorder([play, work]);
    expect(client.orders).toEqual([['P', 'W', 'O']]);

    const gates: (() => void)[] = [];
    const blocking = fakeClient({
      reorder: (order) => {
        blocking.orders.push(order);
        return new Promise<void>((resolve) => gates.push(resolve));
      },
    });
    const serial = createHomeStore(blocking, now);
    const first = serial.getState().submitReorder([work, play]);
    await Promise.resolve();
    expect(blocking.orders).toHaveLength(1);
    await serial.getState().submitReorder([play, work]);
    await serial.getState().submitReorder([play]);
    expect(blocking.orders).toHaveLength(1);
    gates[0]!();
    await until(() => blocking.orders.length === 2);
    expect(blocking.orders[1]).toEqual(['P']);
    gates[1]!();
    await first;
    expect(blocking.orders).toHaveLength(2);
  });

  it('a rejected reorder surfaces the message and reloads the server order; moving an area shows the new order at once', async () => {
    const client = fakeClient({
      fetchLifeAreas: () => Promise.resolve([work, play]),
      reorder: () => Promise.reject(new Error('order is missing id(s)')),
    });
    const store = createHomeStore(client, now);
    await store.getState().load();
    await store.getState().moveActiveArea('P', -1);
    expect(store.getState().reorderErrorMessage).toBe('order is missing id(s)');
    expect(activeAreas(store.getState().lifeAreas).map((a) => a.id)).toEqual(['W', 'P']);

    const ok = fakeClient({ fetchLifeAreas: () => Promise.resolve([work, play]) });
    const moving = createHomeStore(ok, now);
    await moving.getState().load();
    let seenOrder: string[] = [];
    const stop = moving.subscribe((s) => {
      if (s.state.kind === 'loaded') seenOrder = s.state.counts.map((c) => c.lifeArea.id);
    });
    await moving.getState().moveActiveArea('P', -1);
    stop();
    expect(seenOrder).toEqual(['P', 'W']);
    expect(ok.orders).toEqual([['P', 'W']]);
    await moving.getState().moveActiveArea('P', -1);
    expect(ok.orders).toHaveLength(1);
  });

  it('close waits for the write then reloads; a failed write reports and leaves the task open', async () => {
    let status: string | undefined;
    const client = fakeClient({
      fetchOpenTasks: () => Promise.resolve(status === 'done' ? [] : [openWork]),
      setStatus: (_id, s) => {
        status = s;
        return Promise.resolve();
      },
    });
    const store = createHomeStore(client, now);
    await store.getState().load();
    expect(await store.getState().close(openWork)).toBe(true);
    expect(store.getState().openTasks).toEqual([]);
    expect(store.getState().closingTaskId).toBeUndefined();
    expect(await store.getState().reopen(openWork)).toBe(true);
    expect(store.getState().openTasks).toEqual([openWork]);

    const failing = createHomeStore(
      fakeClient({
        fetchOpenTasks: () => Promise.resolve([openWork]),
        setStatus: () => Promise.reject(new Error('denied')),
      }),
      now,
    );
    await failing.getState().load();
    expect(await failing.getState().close(openWork)).toBe(false);
    expect(failing.getState().mutationErrorMessage).toBe('denied');
    expect(failing.getState().openTasks).toEqual([openWork]);
  });

  it('side inputs: inbox and handled-today from captures, focus sessions; each failure keeps the last known', async () => {
    const cap = (id: string, clearedDaysAgo?: number): Capture => ({
      id,
      content: id,
      kind: 'note',
      processed: clearedDaysAgo !== undefined,
      createdAt: now(),
      ...(clearedDaysAgo !== undefined
        ? { clearedAt: new Date(now().getTime() - clearedDaysAgo * 86_400_000) }
        : {}),
    });
    let seenFails = false;
    const client = fakeClient({
      fetchUnprocessedCaptures: () => Promise.resolve([cap('a'), cap('b')]),
      fetchSeenCaptures: () =>
        seenFails ? Promise.reject(new Error('x')) : Promise.resolve([cap('s', 0)]),
      fetchProcessedCaptures: () => Promise.resolve([cap('p', 0), cap('q', 3)]),
    });
    const store = createHomeStore(client, now);
    await store.getState().load();
    const s = store.getState();
    expect(s.inbox.map((c) => c.id)).toEqual(['a', 'b']);
    expect(s.inboxHandledToday).toBe(2);
    expect(s.hasLoadedClearedCaptures).toBe(true);
    expect(s.state.kind).toBe('loaded');

    seenFails = true;
    await store.getState().load();
    expect(store.getState().hasLoadedClearedCaptures).toBe(false);
    expect(store.getState().inboxHandledToday).toBe(1);
  });
});
