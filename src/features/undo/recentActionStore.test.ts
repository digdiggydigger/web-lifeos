import { describe, expect, it } from 'vitest';

import { createRecentActionStore } from './recentActionStore';

describe('recentActionStore', () => {
  it('holds one slot, newest replaces, undo clears first and restores on failure', async () => {
    const store = createRecentActionStore();
    store
      .getState()
      .record({ kind: 'taskClosed', subject: 'A', undo: () => Promise.resolve(true) });
    let restored = false;
    store.getState().record({
      kind: 'taskDeleted',
      subject: 'B',
      undo: () => Promise.resolve((restored = true)),
    });
    expect(store.getState().current?.subject).toBe('B');
    expect(await store.getState().undo()).toBe(true);
    expect(restored).toBe(true);
    expect(store.getState().current).toBeUndefined();

    store
      .getState()
      .record({ kind: 'taskClosed', subject: 'C', undo: () => Promise.reject(new Error('x')) });
    expect(await store.getState().undo()).toBe(false);
    expect(store.getState().current?.subject).toBe('C');
    store.getState().dismiss();
    expect(store.getState().current).toBeUndefined();
    expect(await store.getState().undo()).toBe(false);
  });
});
