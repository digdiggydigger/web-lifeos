// Port of RecentActionCenterTests.
import { describe, expect, it } from 'vitest';

import type { RecentAction } from '@/domain/undo/recentAction';

import { createRecentActionStore } from './recentActionStore';

function action(
  kind: RecentAction['kind'],
  subject: string,
  undo: () => Promise<boolean> = () => Promise.resolve(true),
): RecentAction {
  return { kind, subject, undo };
}

describe('recentActionStore', () => {
  it('records into the one slot; the newest replaces whatever kind was there', () => {
    const store = createRecentActionStore();
    expect(store.getState().current).toBeUndefined();
    store.getState().record(action('taskClosed', 'Pay the council tax instalment'));
    expect(store.getState().current).toMatchObject({
      kind: 'taskClosed',
      subject: 'Pay the council tax instalment',
    });
    store.getState().record(action('captureSkipped', 'Old one'));
    store.getState().record(action('taskClosed', 'Call Mum back'));
    expect(store.getState().current).toMatchObject({
      kind: 'taskClosed',
      subject: 'Call Mum back',
    });
  });
  it('undo runs only the newest reversal, empties the slot, and is spent once used', async () => {
    const store = createRecentActionStore();
    let first = 0;
    let second = 0;
    store
      .getState()
      .record(action('captureSkipped', 'Old one', () => Promise.resolve(++first > 0)));
    store.getState().record(action('taskClosed', 'New one', () => Promise.resolve(++second > 0)));
    await store.getState().undo();
    expect([first, second]).toEqual([0, 1]);
    expect(store.getState().current).toBeUndefined();
    await store.getState().undo();
    expect(second).toBe(1);
    expect(await createRecentActionStore().getState().undo()).toBe(false);
  });
  it('a reversal that declines or throws puts the offer back, unless something newer took the slot meanwhile', async () => {
    const store = createRecentActionStore();
    const declined = action('taskClosed', 'x', () => Promise.resolve(false));
    store.getState().record(declined);
    expect(await store.getState().undo()).toBe(false);
    expect(store.getState().current).toBe(declined);
    const throwing = action('taskClosed', 'y', () => Promise.reject(new Error('down')));
    store.getState().record(throwing);
    expect(await store.getState().undo()).toBe(false);
    expect(store.getState().current).toBe(throwing);
    const slow = action('taskClosed', 'slow', () => {
      store.getState().record(action('taskClosed', 'Closed meanwhile'));
      return Promise.resolve(false);
    });
    store.getState().record(slow);
    await store.getState().undo();
    expect(store.getState().current?.subject).toBe('Closed meanwhile');
  });
  it('dismiss empties the slot without running the reversal; two recordings of one kind are distinct', () => {
    const store = createRecentActionStore();
    let reversals = 0;
    store
      .getState()
      .record(action('taskClosed', 'Call Mum back', () => Promise.resolve(++reversals > 0)));
    store.getState().dismiss();
    expect(store.getState().current).toBeUndefined();
    expect(reversals).toBe(0);
    store.getState().record(action('taskClosed', 'One'));
    const first = store.getState().current;
    store.getState().record(action('taskClosed', 'One'));
    expect(store.getState().current).not.toBe(first);
  });
});
