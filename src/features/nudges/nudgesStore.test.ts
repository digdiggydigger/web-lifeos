// Ports of NudgesServiceTests, NudgesServiceStreakTests, NudgesServiceNotificationTests (with the
// web's no-prompt-on-load rule) and UndoCapsuleNudgeRestoreTests.
import { describe, expect, it } from 'vitest';

import { encodeSchedule, parseSchedule } from '@/domain/nudges';
import type { NudgeSchedule } from '@/domain/nudges';
import type { Nudge } from '@/domain/types';
import type { RecentAction } from '@/domain/undo/recentAction';
import { createRecentActionStore } from '@/features/undo/recentActionStore';

import type { NudgeNotifier, NudgesClient } from './nudgesClient';
import { createNudgesStore, dueNudges, isNewNudgeValid, nudgesOf } from './nudgesStore';

const now = () => new Date(2026, 7, 14, 12, 0);
const noon = now();
const day = (n: number) => new Date(noon.getTime() - n * 86_400_000);
let seq = 0;
function nudge(o: Partial<Nudge> = {}): Nudge {
  seq += 1;
  return {
    id: `N${seq}`,
    label: 'Morning check-in',
    schedule: '0 9 * * *',
    active: true,
    createdAt: noon,
    updatedAt: noon,
    ...o,
  };
}

interface FakeClient extends NudgesClient {
  readonly calls: { create: number; update: number; markFired: number; unmarkFired: number };
  lastUpdate:
    | { id: string; payload: { label?: string; schedule?: NudgeSchedule; active?: boolean } }
    | undefined;
  lastUnmark:
    { previousLastFiredAt: Date | undefined; previousCompletionDates: readonly Date[] } | undefined;
  fetchResult: () => Promise<Nudge[]>;
  updateResult:
    | ((
        id: string,
        payload: { label?: string; schedule?: NudgeSchedule; active?: boolean },
      ) => Promise<Nudge>)
    | undefined;
  markFiredResult: ((id: string, existing: readonly Date[]) => Promise<Nudge>) | undefined;
  unmarkFiredResult: (() => Promise<Nudge>) | undefined;
}

function fakeClient(nudges: Nudge[] = []): FakeClient {
  const client: FakeClient = {
    calls: { create: 0, update: 0, markFired: 0, unmarkFired: 0 },
    lastUpdate: undefined,
    lastUnmark: undefined,
    fetchResult: () => Promise.resolve(nudges),
    updateResult: undefined,
    markFiredResult: undefined,
    unmarkFiredResult: undefined,
    fetchNudges: () => client.fetchResult(),
    createNudge: (input) => {
      client.calls.create += 1;
      return Promise.resolve(
        nudge({
          label: input.label,
          schedule: encodeSchedule(input.schedule),
        }),
      );
    },
    updateNudge: (id, payload) => {
      client.calls.update += 1;
      client.lastUpdate = { id, payload };
      if (client.updateResult) return client.updateResult(id, payload);
      const current = nudges.find((n) => n.id === id) ?? nudge({ id });
      return Promise.resolve({
        ...current,
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.schedule !== undefined ? { schedule: encodeSchedule(payload.schedule) } : {}),
        ...(payload.active !== undefined ? { active: payload.active } : {}),
      });
    },
    markFired: (id, existing) => {
      client.calls.markFired += 1;
      if (client.markFiredResult) return client.markFiredResult(id, existing);
      const current = nudges.find((n) => n.id === id) ?? nudge({ id });
      return Promise.resolve({
        ...current,
        lastFiredAt: noon,
        completionDates: [...existing, noon],
      });
    },
    unmarkFired: (id, previousLastFiredAt, previousCompletionDates) => {
      client.calls.unmarkFired += 1;
      client.lastUnmark = { previousLastFiredAt, previousCompletionDates };
      if (client.unmarkFiredResult) return client.unmarkFiredResult();
      const current = nudges.find((n) => n.id === id) ?? nudge({ id });
      const rest: Nudge = {
        id: current.id,
        label: current.label,
        schedule: current.schedule,
        active: current.active,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
      };
      return Promise.resolve({
        ...rest,
        ...(previousLastFiredAt ? { lastFiredAt: previousLastFiredAt } : {}),
        completionDates: [...previousCompletionDates],
      });
    },
  };
  return client;
}

interface FakeNotifier extends NudgeNotifier {
  authorized: boolean;
  grantOnRequest: boolean;
  readonly scheduled: { id: string; label: string; schedule: NudgeSchedule }[];
  readonly cancelled: string[];
  requests: number;
}

function fakeNotifier(authorized = true): FakeNotifier {
  const n: FakeNotifier = {
    authorized,
    grantOnRequest: false,
    scheduled: [],
    cancelled: [],
    requests: 0,
    isAuthorized: () => n.authorized,
    requestAuthorizationIfNeeded: () => {
      n.requests += 1;
      if (n.grantOnRequest) n.authorized = true;
      return Promise.resolve(n.authorized);
    },
    schedule: (id, label, schedule) => void n.scheduled.push({ id, label, schedule }),
    cancel: (id) => void n.cancelled.push(id),
  };
  return n;
}

describe('nudgesStore: list and composer', () => {
  it('starts loading; loads; a failed fetch fails; a reload never flashes loading', async () => {
    const one = nudge();
    const store = createNudgesStore(fakeClient([one]), { notifier: fakeNotifier(), now });
    expect(store.getState().state).toEqual({ kind: 'loading' });
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'loaded', nudges: [one] });
    const kinds: string[] = [];
    const stop = store.subscribe((s) => kinds.push(s.state.kind));
    await store.getState().load();
    stop();
    expect(kinds).not.toContain('loading');

    const failing = fakeClient();
    failing.fetchResult = () => Promise.reject(new Error('Network error'));
    const failed = createNudgesStore(failing, { notifier: fakeNotifier(), now });
    await failed.getState().load();
    expect(failed.getState().state).toEqual({ kind: 'failed', message: 'Network error' });
  });

  it('create: rejects an empty label or no days without a network call; success appends and resets the label', async () => {
    const client = fakeClient();
    const store = createNudgesStore(client, { notifier: fakeNotifier(), now });
    store.getState().setNewLabel('   ');
    expect(isNewNudgeValid(store.getState())).toBe(false);
    expect(await store.getState().createNudge()).toBe(false);
    expect(client.calls.create).toBe(0);
    expect(store.getState().createErrorMessage).toBe('Nudge label must not be empty.');

    store.getState().setNewLabel('Drink water');
    store.getState().setNewSchedule({ hour: 9, minute: 0, weekdays: new Set() });
    expect(await store.getState().createNudge()).toBe(false);
    expect(client.calls.create).toBe(0);

    await store.getState().load();
    store.getState().setNewSchedule({ hour: 9, minute: 0, weekdays: new Set([1]) });
    expect(isNewNudgeValid(store.getState())).toBe(true);
    expect(await store.getState().createNudge()).toBe(true);
    expect(client.calls.create).toBe(1);
    expect(nudgesOf(store.getState()).map((n) => n.label)).toEqual(['Drink water']);
    expect(store.getState().newLabel).toBe('');
    expect(store.getState().isCreating).toBe(false);
  });

  it('dismiss stamps the firing and removes it from the due list; update sends only the delta; toggle flips active; not-found surfaces', async () => {
    const due = nudge({ createdAt: new Date(0) });
    const client = fakeClient([due]);
    const store = createNudgesStore(client, { notifier: fakeNotifier(), now });
    await store.getState().load();
    expect(dueNudges(nudgesOf(store.getState()), now())).toHaveLength(1);
    expect(await store.getState().dismiss(due)).toBe(true);
    expect(client.calls.markFired).toBe(1);
    expect(dueNudges(nudgesOf(store.getState()), now())).toHaveLength(0);

    const original = nudge({ label: 'Original' });
    const editing = fakeClient([original]);
    const edits = createNudgesStore(editing, { notifier: fakeNotifier(), now });
    await edits.getState().load();
    expect(
      await edits.getState().update(original, 'Updated', parseSchedule(original.schedule)!),
    ).toBe(true);
    expect(editing.lastUpdate?.payload).toEqual({ label: 'Updated' });
    expect(nudgesOf(edits.getState())[0]?.label).toBe('Updated');
    expect(
      await edits.getState().update(original, 'Updated', parseSchedule(original.schedule)!),
    ).toBe(true);
    expect(editing.calls.update).toBe(2);
    expect(await edits.getState().toggleActive(original)).toBe(true);
    expect(editing.lastUpdate?.payload).toEqual({ active: false });
    expect(nudgesOf(edits.getState())[0]?.active).toBe(false);

    editing.updateResult = () => Promise.reject(new Error('This nudge no longer exists.'));
    expect(
      await edits.getState().update(original, 'Again', parseSchedule(original.schedule)!),
    ).toBe(false);
    expect(edits.getState().errorMessage).toBe('This nudge no longer exists.');
  });
});

describe('nudgesStore: the streak milestone', () => {
  const run = (days: number) => Array.from({ length: days }, (_, i) => day(i + 1));
  async function dismissing(completions: Date[], fail = false): Promise<string[]> {
    const milestones: string[] = [];
    const waiting = nudge({ label: 'Stretch', completionDates: completions });
    const client = fakeClient([waiting]);
    if (fail)
      client.markFiredResult = () => Promise.reject(new Error('This nudge no longer exists.'));
    const store = createNudgesStore(client, {
      notifier: fakeNotifier(),
      now,
      celebrate: (m) => milestones.push(m),
    });
    await store.getState().load();
    await store.getState().dismiss(waiting);
    return milestones;
  }
  it('celebrates exactly the seventh consecutive Done for now', async () => {
    expect(await dismissing(run(6))).toEqual(['streakSeven']);
    expect(await dismissing(run(5))).toEqual([]);
    expect(await dismissing(run(7))).toEqual([]);
    expect(await dismissing([])).toEqual([]);
    expect(await dismissing([...run(6), noon])).toEqual([]);
    expect(await dismissing([2, 3, 4, 5, 6, 7].map(day))).toEqual([]);
    expect(await dismissing(run(6), true)).toEqual([]);
  });
});

describe('nudgesStore: notifications', () => {
  it('create schedules an active nudge and cancels an inactive one; a refused prompt still creates but warns', async () => {
    const client = fakeClient();
    const notifier = fakeNotifier();
    const store = createNudgesStore(client, { notifier, now });
    store.getState().setNewLabel('Drink water');
    store.getState().setNewSchedule({ hour: 9, minute: 0, weekdays: new Set([1]) });
    expect(await store.getState().createNudge()).toBe(true);
    expect(notifier.scheduled).toHaveLength(1);
    expect(notifier.scheduled[0]?.label).toBe('Drink water');
    expect(store.getState().createErrorMessage).toBeUndefined();

    const inactiveClient = fakeClient();
    inactiveClient.createNudge = () => Promise.resolve(nudge({ active: false }));
    const inactiveNotifier = fakeNotifier();
    const inactive = createNudgesStore(inactiveClient, { notifier: inactiveNotifier, now });
    inactive.getState().setNewLabel('Drink water');
    await inactive.getState().createNudge();
    expect(inactiveNotifier.scheduled).toHaveLength(0);
    expect(inactiveNotifier.cancelled).toHaveLength(1);

    const denied = fakeNotifier(false);
    const refused = createNudgesStore(fakeClient(), { notifier: denied, now });
    refused.getState().setNewLabel('Drink water');
    expect(await refused.getState().createNudge()).toBe(true);
    expect(denied.requests).toBe(1);
    expect(denied.scheduled).toHaveLength(0);
    expect(refused.getState().createErrorMessage).toBe(
      'Nudge created, but notifications permission was denied — nudge notifications were not scheduled.',
    );
  });

  it('load reconciles: schedules active and cancels inactive when authorised, never prompts, and stays silent when undecided', async () => {
    const active = nudge({ label: 'Active' });
    const inactive = nudge({ label: 'Inactive', active: false });
    const notifier = fakeNotifier();
    const store = createNudgesStore(fakeClient([active, inactive]), { notifier, now });
    await store.getState().load();
    expect(notifier.scheduled.map((s) => s.id)).toEqual([active.id]);
    expect(notifier.cancelled).toContain(inactive.id);
    expect(notifier.requests).toBe(0);

    const undecided = fakeNotifier(false);
    const quiet = createNudgesStore(fakeClient([active]), { notifier: undecided, now });
    await quiet.getState().load();
    expect(undecided.scheduled).toHaveLength(0);
    expect(undecided.requests).toBe(0);
    expect(quiet.getState().errorMessage).toBeUndefined();
  });

  it('update reschedules; toggling off cancels; toggling on schedules (prompting once); dismiss touches nothing', async () => {
    const active = nudge({ active: true });
    const notifier = fakeNotifier();
    const store = createNudgesStore(fakeClient([active]), { notifier, now });
    await store.getState().load();
    const newSchedule = { hour: 18, minute: 30, weekdays: new Set([1, 2]) };
    await store.getState().update(active, active.label, newSchedule);
    expect(notifier.scheduled).toHaveLength(2);
    expect(notifier.scheduled[1]?.schedule).toEqual(newSchedule);
    await store.getState().toggleActive(active);
    expect(notifier.cancelled).toEqual([active.id]);

    const paused = nudge({ active: false });
    const asking = fakeNotifier(false);
    asking.grantOnRequest = true;
    const on = createNudgesStore(fakeClient([paused]), { notifier: asking, now });
    await on.getState().load();
    await on.getState().toggleActive(paused);
    expect(asking.requests).toBe(1);
    expect(asking.scheduled.map((s) => s.id)).toEqual([paused.id]);

    const refusing = fakeNotifier(false);
    const off = createNudgesStore(fakeClient([paused]), { notifier: refusing, now });
    await off.getState().load();
    expect(await off.getState().toggleActive(paused)).toBe(true);
    expect(off.getState().errorMessage).toBe(
      'Notifications permission denied — nudge notifications were not scheduled.',
    );

    const due = nudge({ createdAt: new Date(0) });
    const quiet = fakeNotifier();
    const dismissing = createNudgesStore(fakeClient([due]), { notifier: quiet, now });
    await dismissing.getState().load();
    const before = quiet.scheduled.length + quiet.cancelled.length;
    await dismissing.getState().dismiss(due);
    expect(quiet.scheduled.length + quiet.cancelled.length).toBe(before);
  });
});

describe('nudgesStore: the undo capsule', () => {
  const fired = new Date(1_700_000_000_000);
  async function loaded(before: Nudge) {
    const client = fakeClient([before]);
    const centre = createRecentActionStore();
    const store = createNudgesStore(client, {
      notifier: fakeNotifier(),
      now,
      record: (a: RecentAction) => centre.getState().record(a),
    });
    await store.getState().load();
    return { store, client, centre };
  }
  it('dismissing records an undo named after the nudge that restores the stamps it had before', async () => {
    const before = nudge({ label: 'Take the meds', lastFiredAt: fired, completionDates: [fired] });
    const env = await loaded(before);
    await env.store.getState().dismiss(before);
    expect(env.centre.getState().current?.kind).toBe('nudgeDismissed');
    expect(env.centre.getState().current?.subject).toBe('Take the meds');
    expect(await env.centre.getState().undo()).toBe(true);
    expect(env.client.calls.unmarkFired).toBe(1);
    expect(env.client.lastUnmark).toEqual({
      previousLastFiredAt: fired,
      previousCompletionDates: [fired],
    });
    expect(nudgesOf(env.store.getState())[0]?.lastFiredAt).toEqual(fired);
  });
  it('a never-fired nudge hands over no previous moment; a failed restore surfaces its error and keeps the offer', async () => {
    const never = nudge({ label: 'Take the meds' });
    const env = await loaded(never);
    await env.store.getState().dismiss(never);
    await env.centre.getState().undo();
    expect(env.client.lastUnmark).toEqual({
      previousLastFiredAt: undefined,
      previousCompletionDates: [],
    });

    const failing = await loaded(never);
    failing.client.unmarkFiredResult = () =>
      Promise.reject(new Error('This nudge no longer exists.'));
    await failing.store.getState().dismiss(never);
    expect(await failing.centre.getState().undo()).toBe(false);
    expect(failing.store.getState().errorMessage).toBe('This nudge no longer exists.');
    expect(failing.centre.getState().current?.kind).toBe('nudgeDismissed');
  });
});
