// Ports of FocusSessionServiceTests, FocusSessionServiceWallClockTests, FocusSessionServiceCadenceTests,
// FocusSprintPersistenceTests, FocusCompletionStackServiceTests, FocusCompletionConfirmTests,
// FocusConfirmationStampTests and the FocusBarCollapseTests service cases (the mirror and location
// halves are the phone's), plus the notifier seam.
import { describe, expect, it } from 'vitest';

import type { PersistedFocusSprint, ScheduledFocusNotification } from '@/domain/focus';
import type { CompletedFocusSession } from '@/domain/types';

import { memoryFocusSprintStore } from './focusClient';
import type { FocusLogger, FocusNotifier } from './focusClient';
import { createFocusSessionStore, isSprintActive } from './focusSessionStore';

class TestClock {
  now = new Date(1_800_000_000_000);
  advance(seconds: number): void {
    this.now = new Date(this.now.getTime() + seconds * 1000);
  }
}

function fakeLogger(): FocusLogger & { logged: CompletedFocusSession[]; error: Error | undefined } {
  const logger = {
    logged: [] as CompletedFocusSession[],
    error: undefined as Error | undefined,
    logCompletedSession: (record: CompletedFocusSession) => {
      logger.logged.push(record);
      return logger.error ? Promise.reject(logger.error) : Promise.resolve();
    },
  };
  return logger;
}

function gatedLogger(): FocusLogger & {
  entered: boolean;
  logged: CompletedFocusSession[];
  release: () => void;
} {
  let gate: (() => void) | undefined;
  const logger = {
    entered: false,
    logged: [] as CompletedFocusSession[],
    logCompletedSession: (record: CompletedFocusSession) => {
      logger.logged.push(record);
      logger.entered = true;
      return new Promise<void>((resolve) => {
        gate = resolve;
      });
    },
    release: () => gate?.(),
  };
  return logger;
}

function fakeNotifier(
  granted = true,
): FocusNotifier & { requests: number; plans: (readonly ScheduledFocusNotification[])[] } {
  const n = {
    requests: 0,
    plans: [] as (readonly ScheduledFocusNotification[])[],
    requestAuthorizationIfNeeded: () => {
      n.requests += 1;
      return Promise.resolve(granted);
    },
    replaceScheduled: (plan: readonly ScheduledFocusNotification[]) => void n.plans.push(plan),
  };
  return n;
}

function makeSUT(
  extra: {
    store?: ReturnType<typeof memoryFocusSprintStore>;
    notifier?: FocusNotifier;
    logger?: FocusLogger;
  } = {},
) {
  const clock = new TestClock();
  const logger = fakeLogger();
  const store = extra.store;
  const service = createFocusSessionStore({
    logger: extra.logger ?? logger,
    ...(store ? { sprintStore: store } : {}),
    ...(extra.notifier ? { notifier: extra.notifier } : {}),
    now: () => clock.now,
    tickIntervalMs: 0,
  });
  return { service, clock, logger, store };
}

const drain = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

function startSprint(
  service: ReturnType<typeof createFocusSessionStore>,
  o: { title?: string; duration?: number; count?: number } = {},
) {
  service.getState().start({
    taskId: 'T',
    taskTitle: o.title ?? 'Draft the review',
    lifeAreaEmoji: '💼',
    durationSeconds: o.duration ?? 100,
    cadence: { kind: 'count', count: o.count ?? 1 },
  });
}

describe('focusSessionStore: the countdown', () => {
  it('start populates the session and checkpoints, clamps to the floor, and falls back to the target emoji', () => {
    const { service } = makeSUT();
    startSprint(service);
    const s = service.getState();
    expect(isSprintActive(s)).toBe(true);
    expect(s.session?.durationSeconds).toBe(100);
    expect(s.session?.remainingSeconds).toBe(100);
    expect(s.session?.nudgeCheckpoints).toEqual([50]);
    expect(s.session?.isPaused).toBe(false);
    startSprint(service, { duration: 5 });
    expect(service.getState().session?.durationSeconds).toBe(30);
    service
      .getState()
      .start({ taskTitle: 'Unassigned work', lifeAreaEmoji: '', durationSeconds: 60 });
    expect(service.getState().session?.lifeAreaEmoji).toBe('🎯');
  });

  it('ticks from the wall clock, drift-free, and fires each checkpoint banner exactly once', async () => {
    const { service, clock } = makeSUT();
    startSprint(service);
    clock.advance(30);
    await service.getState().tick();
    expect(service.getState().session?.remainingSeconds).toBe(70);
    clock.advance(10);
    await service.getState().tick();
    expect(service.getState().session?.remainingSeconds).toBe(60);

    const banner = makeSUT();
    startSprint(banner.service);
    banner.clock.advance(49);
    await banner.service.getState().tick();
    expect(banner.service.getState().checkpointBanner).toBeUndefined();
    banner.clock.advance(2);
    await banner.service.getState().tick();
    expect(banner.service.getState().checkpointBanner).toBeDefined();
    expect([...banner.service.getState().session!.triggeredCheckpointIndices]).toEqual([0]);
    banner.clock.advance(5);
    await banner.service.getState().tick();
    expect([...banner.service.getState().session!.triggeredCheckpointIndices]).toEqual([0]);
  });

  it('pause freezes the countdown; resume re-anchors; extending never rewrites work done', async () => {
    const { service, clock } = makeSUT();
    startSprint(service);
    clock.advance(20);
    await service.getState().tick();
    service.getState().togglePause();
    clock.advance(60);
    await service.getState().tick();
    expect(service.getState().session?.isPaused).toBe(true);
    expect(service.getState().session?.remainingSeconds).toBe(80);
    service.getState().togglePause();
    clock.advance(10);
    await service.getState().tick();
    expect(service.getState().session?.isPaused).toBe(false);
    expect(service.getState().session?.remainingSeconds).toBe(70);

    const ext = makeSUT();
    startSprint(ext.service);
    ext.clock.advance(40);
    await ext.service.getState().tick();
    ext.service.getState().addSeconds(30);
    expect(ext.service.getState().session?.remainingSeconds).toBe(90);
    expect(ext.service.getState().session?.durationSeconds).toBe(130);
    const idle = makeSUT();
    idle.service.getState().addSeconds(30);
    expect(isSprintActive(idle.service.getState())).toBe(false);
  });

  it('stop logs the partial sprint; running out completes naturally; a failed log still ends it; a no-op stop logs nothing', async () => {
    const { service, clock, logger } = makeSUT();
    startSprint(service);
    clock.advance(35);
    await service.getState().tick();
    await service.getState().stop();
    expect(isSprintActive(service.getState())).toBe(false);
    expect(logger.logged).toHaveLength(1);
    expect(logger.logged[0]).toMatchObject({
      focusedSeconds: 35,
      plannedSeconds: 100,
      completedNaturally: false,
      taskTitle: 'Draft the review',
      taskId: 'T',
    });

    const natural = makeSUT();
    startSprint(natural.service);
    natural.clock.advance(100);
    await natural.service.getState().tick();
    expect(isSprintActive(natural.service.getState())).toBe(false);
    expect(natural.logger.logged[0]).toMatchObject({
      completedNaturally: true,
      focusedSeconds: 100,
      checkpointsReached: 1,
    });

    const failing = makeSUT();
    failing.logger.error = new Error('offline');
    startSprint(failing.service);
    await failing.service.getState().stop();
    expect(isSprintActive(failing.service.getState())).toBe(false);
    expect(failing.service.getState().logErrorMessage).toBe('offline');
    expect(failing.service.getState().completedSprintCount).toBe(1);

    const none = makeSUT();
    await none.service.getState().stop();
    expect(none.logger.logged).toEqual([]);
    expect(none.service.getState().completedSprintCount).toBe(0);
  });

  it('starting over a running sprint keeps the new one alive and logs the replaced one exactly once', async () => {
    const { service, clock, logger } = makeSUT();
    startSprint(service);
    clock.advance(40);
    await service.getState().tick();
    service.getState().start({
      taskId: 'U',
      taskTitle: 'The replacement',
      lifeAreaEmoji: '📚',
      durationSeconds: 200,
    });
    await drain();
    expect(service.getState().session?.taskTitle).toBe('The replacement');
    expect(service.getState().session?.remainingSeconds).toBe(200);
    expect(logger.logged).toHaveLength(1);
    expect(logger.logged[0]).toMatchObject({
      taskTitle: 'Draft the review',
      focusedSeconds: 40,
      completedNaturally: false,
    });
    expect(service.getState().completedSprintCount).toBe(1);
    await service.getState().stop(true);
    expect(service.getState().completedSprintCount).toBe(2);
  });
});

describe('focusSessionStore: the wall clock after a suspended gap', () => {
  it('pause, stop, extend and sync all read the deadline, and a countdown that ran out completes', async () => {
    const paused = makeSUT();
    startSprint(paused.service);
    paused.clock.advance(40);
    paused.service.getState().togglePause();
    expect(paused.service.getState().session?.remainingSeconds).toBe(60);

    const expired = makeSUT();
    startSprint(expired.service);
    expired.clock.advance(120);
    expired.service.getState().togglePause();
    await drain();
    expect(isSprintActive(expired.service.getState())).toBe(false);
    expect(expired.logger.logged[0]).toMatchObject({
      completedNaturally: true,
      focusedSeconds: 100,
    });

    const stopped = makeSUT();
    startSprint(stopped.service);
    stopped.clock.advance(40);
    await stopped.service.getState().stop();
    expect(stopped.logger.logged[0]?.focusedSeconds).toBe(40);

    const late = makeSUT();
    startSprint(late.service);
    late.clock.advance(120);
    await late.service.getState().stop();
    expect(late.logger.logged[0]).toMatchObject({ completedNaturally: true, focusedSeconds: 100 });

    const extended = makeSUT();
    startSprint(extended.service);
    extended.clock.advance(40);
    extended.service.getState().addSeconds(30);
    expect(extended.service.getState().session?.remainingSeconds).toBe(90);
    expect(extended.service.getState().session?.durationSeconds).toBe(130);

    const synced = makeSUT();
    startSprint(synced.service);
    synced.clock.advance(180);
    synced.service.getState().syncNow();
    await drain();
    expect(isSprintActive(synced.service.getState())).toBe(false);
    expect(synced.logger.logged[0]).toMatchObject({
      completedNaturally: true,
      focusedSeconds: 100,
    });

    const mid = makeSUT();
    startSprint(mid.service);
    mid.clock.advance(40);
    mid.service.getState().syncNow();
    expect(mid.service.getState().session?.remainingSeconds).toBe(60);

    const frozen = makeSUT();
    startSprint(frozen.service);
    frozen.clock.advance(30);
    frozen.service.getState().togglePause();
    frozen.clock.advance(600);
    frozen.service.getState().syncNow();
    expect(frozen.service.getState().session).toMatchObject({
      isPaused: true,
      remainingSeconds: 70,
    });

    const idle = makeSUT();
    idle.service.getState().syncNow();
    expect(isSprintActive(idle.service.getState())).toBe(false);
    expect(idle.logger.logged).toEqual([]);
  });
});

describe('focusSessionStore: cadence', () => {
  it('records the cadence, re-spaces only upcoming checkpoints, leaves the countdown and a pause alone, resyncs first', async () => {
    const { service, clock } = makeSUT();
    startSprint(service, { duration: 900, count: 3 });
    expect(service.getState().cadence).toEqual({ kind: 'count', count: 3 });
    clock.advance(300);
    await service.getState().tick();
    service.getState().updateCadence({ kind: 'interval', seconds: 120 });
    expect(service.getState().cadence).toEqual({ kind: 'interval', seconds: 120 });
    expect(service.getState().session?.nudgeCheckpoints).toEqual([225, 360, 480, 600, 720, 840]);
    expect([...service.getState().session!.triggeredCheckpointIndices]).toEqual([0]);
    service.getState().updateCadence({ kind: 'count', count: 5 });
    expect(service.getState().session?.remainingSeconds).toBe(600);
    expect(service.getState().session?.durationSeconds).toBe(900);

    const paused = makeSUT();
    startSprint(paused.service, { duration: 900, count: 3 });
    paused.clock.advance(300);
    await paused.service.getState().tick();
    paused.service.getState().togglePause();
    paused.clock.advance(120);
    paused.service.getState().updateCadence({ kind: 'count', count: 1 });
    expect(paused.service.getState().session).toMatchObject({
      isPaused: true,
      remainingSeconds: 600,
    });
    expect(paused.service.getState().session?.nudgeCheckpoints).toEqual([225, 450]);

    const resync = makeSUT();
    startSprint(resync.service, { duration: 900, count: 3 });
    resync.clock.advance(500);
    resync.service.getState().updateCadence({ kind: 'interval', seconds: 300 });
    expect(resync.service.getState().session?.remainingSeconds).toBe(400);
    expect(resync.service.getState().session?.nudgeCheckpoints).toEqual([225, 450, 600]);
    expect([...resync.service.getState().session!.triggeredCheckpointIndices]).toEqual([0, 1]);

    const idle = makeSUT();
    idle.service.getState().updateCadence({ kind: 'count', count: 4 });
    expect(idle.service.getState().session).toBeUndefined();
  });
});

function persisted(
  clock: TestClock,
  o: {
    duration?: number;
    startedSecondsAgo?: number;
    deadlineIn?: number | null;
    pausedRemaining?: number;
    checkpoints?: number[];
    triggered?: number[];
  } = {},
): PersistedFocusSprint {
  const deadlineIn = o.deadlineIn === undefined ? 500 : o.deadlineIn;
  return {
    taskId: 'T',
    taskTitle: 'Draft the review',
    lifeAreaEmoji: '💼',
    durationSeconds: o.duration ?? 600,
    nudgeCheckpoints: o.checkpoints ?? [60, 300],
    triggeredCheckpointIndices: o.triggered ?? [],
    startedAt: new Date(clock.now.getTime() - (o.startedSecondsAgo ?? 100) * 1000),
    deadline: deadlineIn === null ? undefined : new Date(clock.now.getTime() + deadlineIn * 1000),
    pausedRemainingSeconds: o.pausedRemaining,
    cadenceCount: 2,
    cadenceIntervalSeconds: undefined,
  };
}

describe('focusSessionStore: persistence', () => {
  it('start, pause/resume, stop and checkpoint crossings all persist', async () => {
    const store = memoryFocusSprintStore();
    const { service, clock } = makeSUT({ store });
    service.getState().start({
      taskTitle: 'Draft',
      lifeAreaEmoji: '💼',
      durationSeconds: 600,
      cadence: { kind: 'count', count: 2 },
    });
    expect(store.stored).toMatchObject({
      taskTitle: 'Draft',
      durationSeconds: 600,
      cadenceCount: 2,
      pausedRemainingSeconds: undefined,
    });
    expect(store.stored?.deadline).toEqual(new Date(clock.now.getTime() + 600_000));
    clock.advance(100);
    service.getState().togglePause();
    expect(store.stored?.deadline).toBeUndefined();
    expect(store.stored?.pausedRemainingSeconds).toBe(500);
    clock.advance(1000);
    service.getState().togglePause();
    expect(store.stored?.deadline).toEqual(new Date(clock.now.getTime() + 500_000));
    expect(store.stored?.pausedRemainingSeconds).toBeUndefined();
    await service.getState().stop();
    expect(store.stored).toBeUndefined();
    expect(store.clearCount).toBeGreaterThan(0);

    const crossing = memoryFocusSprintStore();
    const c = makeSUT({ store: crossing });
    c.service.getState().start({
      taskTitle: 'Draft',
      lifeAreaEmoji: '💼',
      durationSeconds: 600,
      cadence: { kind: 'count', count: 2 },
    });
    c.clock.advance(250);
    await c.service.getState().tick();
    expect(crossing.stored?.triggeredCheckpointIndices).toEqual([0]);
  });

  it('restores a running sprint from the deadline, a paused one frozen, and completes an expired one with the offline summary', async () => {
    const store = memoryFocusSprintStore();
    const { service, clock } = makeSUT({ store });
    store.stored = persisted(clock);
    await service.getState().restorePersistedSprint();
    expect(service.getState().session).toMatchObject({
      taskTitle: 'Draft the review',
      remainingSeconds: 500,
      isPaused: false,
    });
    expect([...service.getState().session!.triggeredCheckpointIndices]).toEqual([0]);
    expect(service.getState().checkpointBanner).toBeUndefined();
    expect(service.getState().deadline).toEqual(new Date(clock.now.getTime() + 500_000));
    expect(service.getState().offlineCompletionSummary).toBeUndefined();

    const pausedStore = memoryFocusSprintStore();
    const paused = makeSUT({ store: pausedStore });
    pausedStore.stored = persisted(paused.clock, { deadlineIn: null, pausedRemaining: 240 });
    await paused.service.getState().restorePersistedSprint();
    expect(paused.service.getState().session).toMatchObject({
      isPaused: true,
      remainingSeconds: 240,
    });
    expect(paused.service.getState().deadline).toBeUndefined();

    const expiredStore = memoryFocusSprintStore();
    const expired = makeSUT({ store: expiredStore });
    expiredStore.stored = persisted(expired.clock, { deadlineIn: -30 });
    await expired.service.getState().restorePersistedSprint();
    expect(expired.service.getState().session).toBeUndefined();
    expect(expired.logger.logged).toHaveLength(1);
    expect(expired.logger.logged[0]).toMatchObject({
      completedNaturally: true,
      focusedSeconds: 600,
    });
    expect(expiredStore.stored).toBeUndefined();
    expect(expired.service.getState().offlineCompletionSummary?.taskTitle).toBe('Draft the review');
    expect(expiredStore.unacknowledged).toEqual(
      expired.service.getState().offlineCompletionSummary,
    );
    expect(expired.service.getState().unconfirmedCompletions).toEqual([]);

    const relaunch = makeSUT({ store: expiredStore });
    await relaunch.service.getState().restorePersistedSprint();
    expect(relaunch.service.getState().offlineCompletionSummary).toEqual(
      expiredStore.unacknowledged,
    );
    relaunch.service.getState().acknowledgeOfflineCompletion();
    expect(relaunch.service.getState().offlineCompletionSummary).toBeUndefined();
    expect(expiredStore.unacknowledged).toBeUndefined();

    const nothing = makeSUT({ store: memoryFocusSprintStore() });
    await nothing.service.getState().restorePersistedSprint();
    expect(nothing.service.getState().session).toBeUndefined();
  });
});

describe('focusSessionStore: the completion stack and confirm', () => {
  async function finish(
    service: ReturnType<typeof createFocusSessionStore>,
    title: string,
  ): Promise<void> {
    startSprint(service, { title });
    await service.getState().stop(true);
  }

  it('only a natural completion produces a card; the newest is in front; the stack survives a relaunch', async () => {
    const store = memoryFocusSprintStore();
    const { service, clock, logger } = makeSUT({ store });
    await finish(service, 'Draft the review');
    expect(service.getState().unconfirmedCompletions).toHaveLength(1);
    expect(service.getState().unconfirmedCompletions[0]?.confirmedAt).toBeUndefined();

    startSprint(service, { duration: 600 });
    clock.advance(60);
    await service.getState().stop();
    expect(logger.logged).toHaveLength(2);
    expect(service.getState().unconfirmedCompletions).toHaveLength(1);

    startSprint(service, { duration: 100 });
    clock.advance(200);
    await service.getState().stop();
    expect(service.getState().unconfirmedCompletions).toHaveLength(2);

    startSprint(service, { title: 'First', duration: 600 });
    clock.advance(60);
    startSprint(service, { title: 'Second', duration: 600 });
    await drain();
    expect(service.getState().unconfirmedCompletions).toHaveLength(2);
    expect(service.getState().session?.taskTitle).toBe('Second');
    await service.getState().stop(true);
    expect(service.getState().unconfirmedCompletions[0]?.taskTitle).toBe('Second');

    const relaunched = makeSUT({ store });
    await relaunched.service.getState().restorePersistedSprint();
    expect(relaunched.service.getState().unconfirmedCompletions.map((r) => r.taskTitle)[0]).toBe(
      'Second',
    );
  });

  it('the push lands before the log await; the offline restore path pushes nothing to the stack', async () => {
    const logger = gatedLogger();
    const store = memoryFocusSprintStore();
    const clock = new TestClock();
    const service = createFocusSessionStore({
      logger,
      sprintStore: store,
      now: () => clock.now,
      tickIntervalMs: 0,
    });
    startSprint(service);
    const stopping = service.getState().stop(true);
    await drain();
    expect(logger.entered).toBe(true);
    expect(service.getState().unconfirmedCompletions).toHaveLength(1);
    expect(store.unconfirmed).toHaveLength(1);
    logger.release();
    await stopping;

    const offline = memoryFocusSprintStore();
    const o = makeSUT({ store: offline });
    offline.stored = persisted(o.clock, {
      startedSecondsAgo: 900,
      deadlineIn: -300,
      checkpoints: [300],
    });
    await o.service.getState().restorePersistedSprint();
    expect(o.service.getState().offlineCompletionSummary).toBeDefined();
    expect(o.service.getState().unconfirmedCompletions).toEqual([]);
  });

  it('confirm removes, re-persists, logs a confirmed copy with the same id, and reveals the next card', async () => {
    const store = memoryFocusSprintStore();
    const { service, logger } = makeSUT({ store });
    await finish(service, 'A, the older');
    await finish(service, 'B, the newer');
    const front = service.getState().unconfirmedCompletions[0]!;
    expect(front.taskTitle).toBe('B, the newer');
    await service.getState().confirmCompletion(front);
    expect(logger.logged).toHaveLength(3);
    expect(logger.logged[2]).toMatchObject({ id: front.id, taskTitle: 'B, the newer' });
    expect(logger.logged[2]?.confirmedAt).toBeDefined();
    expect(service.getState().unconfirmedCompletions.map((r) => r.taskTitle)).toEqual([
      'A, the older',
    ]);
    expect(store.unconfirmed.map((r) => r.taskTitle)).toEqual(['A, the older']);
  });

  it('confirmation stamps: each confirm advances the ordinal, the last clears, repeats and strangers celebrate nothing', async () => {
    const { service } = makeSUT({ store: memoryFocusSprintStore() });
    await finish(service, 'Only');
    expect(service.getState().latestConfirmation).toBeUndefined();
    const card = service.getState().unconfirmedCompletions[0]!;
    const before = service.getState().latestConfirmableCompletion;
    await service.getState().confirmCompletion(card);
    expect(service.getState().latestConfirmation).toEqual({ ordinal: 1, clearedStack: true });
    expect(service.getState().latestConfirmableCompletion).toEqual(before);
    await service.getState().confirmCompletion(card);
    expect(service.getState().latestConfirmation?.ordinal).toBe(1);

    const two = makeSUT({ store: memoryFocusSprintStore() });
    await finish(two.service, 'Older');
    await finish(two.service, 'Newer');
    await two.service
      .getState()
      .confirmCompletion(two.service.getState().unconfirmedCompletions[0]!);
    expect(two.service.getState().latestConfirmation).toEqual({ ordinal: 1, clearedStack: false });
    await two.service
      .getState()
      .confirmCompletion(two.service.getState().unconfirmedCompletions[0]!);
    expect(two.service.getState().latestConfirmation).toEqual({ ordinal: 2, clearedStack: true });

    const stranger = makeSUT();
    await stranger.service.getState().confirmCompletion(card);
    expect(stranger.service.getState().latestConfirmation).toBeUndefined();

    const manual = makeSUT({ store: memoryFocusSprintStore() });
    startSprint(manual.service);
    await manual.service.getState().stop();
    expect(manual.service.getState().latestConfirmation).toBeUndefined();
  });

  it('the confirmation stamp lands before the log await', async () => {
    const logger = gatedLogger();
    const store = memoryFocusSprintStore();
    const record: CompletedFocusSession = {
      id: 'R',
      taskTitle: 'Waiting',
      lifeAreaEmoji: '💼',
      plannedSeconds: 1500,
      focusedSeconds: 1500,
      checkpointsReached: 1,
      completedNaturally: true,
      startedAt: new Date(1_799_998_500_000),
      endedAt: new Date(1_800_000_000_000),
    };
    store.unconfirmed = [record];
    const service = createFocusSessionStore({ logger, sprintStore: store, tickIntervalMs: 0 });
    await service.getState().restorePersistedSprint();
    const confirming = service.getState().confirmCompletion(record);
    await drain();
    expect(logger.entered).toBe(true);
    expect(service.getState().latestConfirmation?.ordinal).toBe(1);
    logger.release();
    await confirming;
  });

  it('collapse: sticky across a stop, persisted and restored, reset only by a confirm with nothing running', async () => {
    const store = memoryFocusSprintStore();
    const { service } = makeSUT({ store });
    expect(service.getState().isCardCollapsed).toBe(false);
    startSprint(service);
    service.getState().setCardCollapsed(true);
    await service.getState().stop();
    startSprint(service, { title: 'Second sprint' });
    expect(service.getState().isCardCollapsed).toBe(true);
    expect(store.cardCollapsed).toBe(true);
    await service.getState().stop(true);
    const relaunched = makeSUT({ store });
    await relaunched.service.getState().restorePersistedSprint();
    expect(relaunched.service.getState().isCardCollapsed).toBe(true);
    await relaunched.service
      .getState()
      .confirmCompletion(relaunched.service.getState().unconfirmedCompletions[0]!);
    expect(relaunched.service.getState().isCardCollapsed).toBe(false);
    expect(store.cardCollapsed).toBe(false);

    const running = makeSUT({ store: memoryFocusSprintStore() });
    await finish(running.service, 'Finished');
    const waiting = running.service.getState().unconfirmedCompletions[0]!;
    startSprint(running.service, { title: 'Started by a routine', duration: 600 });
    running.service.getState().setCardCollapsed(true);
    await running.service.getState().confirmCompletion(waiting);
    expect(running.service.getState().isCardCollapsed).toBe(true);
    expect(running.service.getState().unconfirmedCompletions).toEqual([]);

    const bare = createFocusSessionStore({ tickIntervalMs: 0 });
    bare.getState().setCardCollapsed(true);
    expect(bare.getState().isCardCollapsed).toBe(true);
  });
});

describe('focusSessionStore: notifications', () => {
  it('start asks once and arms the plan; pause, stop and a refused prompt clear it', async () => {
    const notifier = fakeNotifier();
    const { service } = makeSUT({ notifier });
    startSprint(service, { duration: 900, count: 3 });
    await drain();
    expect(notifier.requests).toBe(1);
    expect(notifier.plans[notifier.plans.length - 1]).toHaveLength(4);
    service.getState().togglePause();
    expect(notifier.plans[notifier.plans.length - 1]).toEqual([]);
    service.getState().togglePause();
    expect(notifier.plans[notifier.plans.length - 1]).toHaveLength(4);
    await service.getState().stop();
    expect(notifier.plans[notifier.plans.length - 1]).toEqual([]);

    const refused = fakeNotifier(false);
    const r = makeSUT({ notifier: refused });
    startSprint(r.service);
    await drain();
    expect(refused.plans[refused.plans.length - 1]).toEqual([]);
    expect(isSprintActive(r.service.getState())).toBe(true);
  });
});
