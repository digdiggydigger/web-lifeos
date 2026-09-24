// Ports of CelebrationCenterTests, CelebrationCenterHeldBurstTests, CelebrationCaptureFanHoldTests
// and CelebrationUnknownSheetHoldTests. The injected clock, probe and hold-watch scheduler stand in
// for the Swift `now`, `PresentationProbing` and `sleep` seams.
import { describe, expect, it } from 'vitest';

import type { CelebrationKind } from '@/domain/celebrations';
import { isFullScreen } from '@/domain/celebrations';

import { CELEBRATION_HELD_LIFETIME, createCelebrationCenter } from './celebrationCenter';

const launch = 1_800_000_000_000;
const confirm = (clearedStack = false): CelebrationKind => ({ kind: 'confirm', clearedStack });
const pop: CelebrationKind = { kind: 'pop' };
const inboxZero: CelebrationKind = { kind: 'milestone', milestone: 'inboxZero' };
const dailyGoal: CelebrationKind = { kind: 'milestone', milestone: 'dailyGoal' };
const streakSeven: CelebrationKind = { kind: 'milestone', milestone: 'streakSeven' };
const routineFinished: CelebrationKind = { kind: 'milestone', milestone: 'routineFinished' };

function makeSUT(
  opts: {
    celebrationsEnabled?: boolean;
    presented?: boolean;
  } = {},
) {
  let now = launch;
  const probe = { presented: opts.presented ?? false };
  const chimed: CelebrationKind[] = [];
  const felt: string[] = [];
  let tick: (() => void) | undefined;
  const center = createCelebrationCenter({
    now: () => now,
    celebrationsGate: () => opts.celebrationsEnabled ?? true,
    chime: (kind) => chimed.push(kind),
    feel: (f) => felt.push(f),
    probe: () => probe.presented,
    schedule: (fn) => {
      tick = fn;
      return () => {
        tick = undefined;
      };
    },
  });
  return {
    center,
    probe,
    chimed,
    felt,
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
    /** One tick of the hold watch, as the real 250 ms interval would fire it. */
    tickWatch: () => tick?.(),
    watchRunning: () => tick !== undefined,
    bursts: () => center.store.getState().bursts,
    held: () => center.store.getState().held,
  };
}

describe('CelebrationCenter — requesting', () => {
  it('a confirm enqueues one full-screen burst and reports it as such', () => {
    const { center, bursts } = makeSUT();
    expect(center.request(confirm(true), null)).toBe('fullScreen');
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.kind).toEqual(confirm(true));
    expect(bursts()[0]?.start).toBe(launch);
  });

  it('with the switch off a confirm enqueues nothing at all', () => {
    const { center, bursts } = makeSUT({ celebrationsEnabled: false });
    expect(center.request(confirm(false), null)).toBe('nothing');
    expect(bursts()).toEqual([]);
  });

  it('with the switch off a pop is still enqueued', () => {
    const { center, bursts } = makeSUT({ celebrationsEnabled: false });
    expect(center.request(pop, { x: 10, y: 20 })).toBe('inPlace');
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.origin).toEqual({ x: 10, y: 20 });
  });

  it('a downgraded milestone plays as a pop', () => {
    const { center, bursts } = makeSUT({ celebrationsEnabled: false });
    expect(center.request(inboxZero, null)).toBe('inPlace');
    expect(bursts()[0]?.kind).toEqual(pop);
  });

  it('every burst gets its own ordinal whatever kind it is', () => {
    const { center, bursts } = makeSUT();
    center.request(pop, { x: 0, y: 0 });
    center.request(confirm(false), null);
    center.request(pop, { x: 0, y: 0 });
    expect(bursts().map((b) => b.ordinal)).toEqual([1, 2, 3]);
  });

  it('a burst is tagged with whichever surface is frontmost', () => {
    const { center, bursts } = makeSUT();
    center.surfacePresented('routineCover');
    center.request(routineFinished, null);
    expect(bursts()[0]?.surface).toBe('routineCover');
    expect(center.burstsOn('routineCover')).toHaveLength(1);
    expect(center.burstsOn('root')).toEqual([]);
  });

  it('presenting the root surface never changes the frontmost', () => {
    const { center } = makeSUT();
    center.surfacePresented('tasksSearch');
    center.surfacePresented('root');
    expect(center.frontmost()).toBe('tasksSearch');
  });

  it('dismissing a surface puts the one beneath it back in front', () => {
    const { center } = makeSUT();
    center.surfacePresented('tasksSearch');
    center.surfacePresented('promoteSheet');
    center.surfaceDismissed('promoteSheet');
    expect(center.frontmost()).toBe('tasksSearch');
    center.surfaceDismissed('tasksSearch');
    expect(center.frontmost()).toBe('root');
  });
});

describe('CelebrationCenter — chime and feel', () => {
  it('the chime fires for a full screen and never for a pop', () => {
    const { center, chimed } = makeSUT();
    center.request(pop, { x: 0, y: 0 });
    expect(chimed).toEqual([]);
    center.request(confirm(false), null);
    expect(chimed).toEqual([confirm(false)]);
  });

  it('a refused celebration never chimes', () => {
    const { center, chimed } = makeSUT({ celebrationsEnabled: false });
    center.request(confirm(false), null);
    expect(chimed).toEqual([]);
  });

  it('the centre plays the success feel for the daily goal, even downgraded', () => {
    const on = makeSUT();
    on.center.request(dailyGoal, null);
    expect(on.felt).toEqual(['success']);
    const off = makeSUT({ celebrationsEnabled: false });
    expect(off.center.request(dailyGoal, null)).toBe('inPlace');
    expect(off.felt).toEqual(['success']);
  });

  it('the other milestones get no feel from the centre', () => {
    const { center, felt } = makeSUT();
    center.request(inboxZero, null);
    center.request(streakSeven, null);
    center.request(pop, { x: 0, y: 0 });
    expect(felt).toEqual([]);
  });
});

describe('CelebrationCenter — expiry', () => {
  it('pruning removes only what has finished', () => {
    const { center, advance, bursts } = makeSUT();
    center.request(pop, { x: 0, y: 0 });
    advance(0.5);
    center.request(confirm(false), null);
    advance(0.6);
    center.prune(launch + 1100);
    expect(bursts().map((b) => b.ordinal)).toEqual([2]);
  });
});

describe('CelebrationCenter — held behind a self-dismissing sheet', () => {
  it('is held until the sheet closes, then released onto the root', () => {
    const { center, advance, bursts } = makeSUT();
    center.surfacePresented('promoteSheet');
    expect(center.request(inboxZero, null)).toBe('fullScreen');
    expect(bursts()).toEqual([]);
    advance(0.5);
    center.surfaceDismissed('promoteSheet');
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.surface).toBe('root');
  });

  it('starts when it is released rather than when it was requested', () => {
    const { center, advance, bursts } = makeSUT();
    center.surfacePresented('promoteSheet');
    center.request(inboxZero, null);
    advance(0.45);
    center.surfaceDismissed('promoteSheet');
    expect(bursts()[0]?.start).toBe(launch + 450);
  });

  it('older than a minute is dropped rather than released, and never chimes', () => {
    const { center, advance, bursts, chimed } = makeSUT();
    center.surfacePresented('promoteSheet');
    center.request(inboxZero, null);
    advance(CELEBRATION_HELD_LIFETIME + 0.01);
    center.surfaceDismissed('promoteSheet');
    expect(bursts()).toEqual([]);
    expect(chimed).toEqual([]);
  });

  it('chimes when it plays and not while it waits', () => {
    const { center, advance, chimed } = makeSUT();
    center.surfacePresented('promoteSheet');
    center.request(inboxZero, null);
    expect(chimed).toEqual([]);
    advance(0.45);
    center.surfaceDismissed('promoteSheet');
    expect(chimed).toEqual([inboxZero]);
  });

  it('a full screen on a surface that stays open is not held', () => {
    const { center, bursts } = makeSUT();
    center.surfacePresented('routineCover');
    center.request(routineFinished, null);
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.surface).toBe('routineCover');
  });

  it('two held milestones are both released', () => {
    const { center, advance, bursts } = makeSUT();
    center.surfacePresented('promoteSheet');
    expect(center.request(inboxZero, null)).toBe('fullScreen');
    advance(0.2);
    expect(center.request(dailyGoal, null)).toBe('fullScreen');
    center.surfaceDismissed('promoteSheet');
    expect(bursts().filter(isFullScreen)).toHaveLength(2);
  });
});

describe('CelebrationCenter — the capture composer', () => {
  it('a full screen asked for while the composer is open is held', () => {
    for (const kind of [dailyGoal, confirm(true)]) {
      const { center, bursts, held } = makeSUT();
      center.captureChanged(true);
      expect(center.request(kind, null)).toBe('fullScreen');
      expect(bursts()).toEqual([]);
      expect(held()).toHaveLength(1);
    }
  });

  it('with the composer closed the same celebration plays at once', () => {
    const { center, bursts, held } = makeSUT();
    center.captureChanged(false);
    center.request(dailyGoal, null);
    expect(bursts()).toHaveLength(1);
    expect(held()).toEqual([]);
  });

  it('a pop while the composer is open is not held', () => {
    const { center, bursts, held } = makeSUT();
    center.captureChanged(true);
    expect(center.request(pop, { x: 10, y: 20 })).toBe('inPlace');
    expect(bursts()).toHaveLength(1);
    expect(held()).toEqual([]);
  });

  it('closing the composer plays the held celebration from the start', () => {
    const { center, advance, bursts, held, chimed, watchRunning } = makeSUT();
    center.captureChanged(true);
    center.request(dailyGoal, null);
    expect(chimed).toEqual([]);
    advance(4);
    center.captureChanged(false);
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.start).toBe(launch + 4000);
    expect(chimed).toEqual([dailyGoal]);
    expect(held()).toEqual([]);
    expect(watchRunning()).toBe(false);
  });

  it('the hold watch releases it when the composer closed while something else still blocked', () => {
    const { center, probe, bursts, tickWatch, watchRunning } = makeSUT();
    center.captureChanged(true);
    center.request(dailyGoal, null);
    expect(watchRunning()).toBe(true);
    probe.presented = true;
    center.captureChanged(false);
    expect(bursts()).toEqual([]);
    probe.presented = false;
    tickWatch();
    expect(bursts()).toHaveLength(1);
    expect(watchRunning()).toBe(false);
  });

  it('opening and closing with nothing held plays nothing', () => {
    const { center, bursts, held, watchRunning } = makeSUT();
    center.captureChanged(true);
    center.captureChanged(false);
    expect(bursts()).toEqual([]);
    expect(held()).toEqual([]);
    expect(watchRunning()).toBe(false);
  });

  it('a celebration already playing when the composer opens keeps playing, and does not replay', () => {
    const { center, advance, bursts, held, chimed } = makeSUT();
    center.request(confirm(true), null);
    const playing = bursts();
    advance(1);
    center.captureChanged(true);
    expect(bursts()).toEqual(playing);
    expect(held()).toEqual([]);
    center.captureChanged(false);
    expect(bursts()).toEqual(playing);
    expect(chimed).toHaveLength(1);
  });

  it('held behind a composer left open past sixty seconds is dropped', () => {
    const { center, advance, bursts, held, chimed, watchRunning } = makeSUT();
    center.captureChanged(true);
    center.request(dailyGoal, null);
    advance(CELEBRATION_HELD_LIFETIME + 0.01);
    center.captureChanged(false);
    expect(bursts()).toEqual([]);
    expect(held()).toEqual([]);
    expect(chimed).toEqual([]);
    expect(watchRunning()).toBe(false);
  });

  it('the composer flag does not hold a celebration on a cover with its own layer', () => {
    const { center, bursts } = makeSUT();
    center.captureChanged(true);
    center.surfacePresented('routineCover');
    center.request(routineFinished, null);
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.surface).toBe('routineCover');
  });
});

describe('CelebrationCenter — an open dialog the centre was never told about', () => {
  it('a milestone requested behind an open dialog is held rather than drawn under it', () => {
    const { center, bursts, held } = makeSUT({ presented: true });
    expect(center.request(inboxZero, null)).toBe('fullScreen');
    expect(bursts()).toEqual([]);
    expect(held()).toHaveLength(1);
  });

  it('with nothing open it is drawn at once', () => {
    const { center, bursts, held } = makeSUT({ presented: false });
    expect(center.request(inboxZero, null)).toBe('fullScreen');
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.surface).toBe('root');
    expect(held()).toEqual([]);
  });

  it('a pop behind an open dialog is still drawn', () => {
    const { center, bursts, held } = makeSUT({ presented: true });
    expect(center.request(pop, { x: 10, y: 20 })).toBe('inPlace');
    expect(bursts()).toHaveLength(1);
    expect(held()).toEqual([]);
  });

  it('a surface with its own layer draws without consulting the probe', () => {
    const { center, bursts, held } = makeSUT({ presented: true });
    center.surfacePresented('routineCover');
    center.request(routineFinished, null);
    expect(bursts()).toHaveLength(1);
    expect(held()).toEqual([]);
  });

  it('the daily-goal feel still fires at request time behind a dialog', () => {
    const { center, felt, bursts } = makeSUT({ presented: true });
    center.request(dailyGoal, null);
    expect(felt).toEqual(['success']);
    expect(bursts()).toEqual([]);
  });

  it('does not chime until it plays', () => {
    const { center, probe, advance, chimed } = makeSUT({ presented: true });
    center.request(inboxZero, null);
    expect(chimed).toEqual([]);
    probe.presented = false;
    advance(0.4);
    center.pollHeldBursts();
    expect(chimed).toEqual([inboxZero]);
  });

  it('is released once the dialog has gone, starting then', () => {
    const { center, probe, advance, bursts, held } = makeSUT({ presented: true });
    center.request(inboxZero, null);
    advance(0.4);
    center.pollHeldBursts();
    expect(bursts()).toEqual([]);
    probe.presented = false;
    advance(0.2);
    center.pollHeldBursts();
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.surface).toBe('root');
    expect(bursts()[0]?.start).toBeCloseTo(launch + 600, 6);
    expect(held()).toEqual([]);
  });

  it('the hold watch releases the burst with no surface dismissal at all', () => {
    const { center, probe, bursts, tickWatch, watchRunning } = makeSUT({ presented: true });
    center.request(inboxZero, null);
    expect(watchRunning()).toBe(true);
    probe.presented = false;
    tickWatch();
    expect(bursts()).toHaveLength(1);
    expect(watchRunning()).toBe(false);
  });

  it('no watch runs when nothing is held', () => {
    const { center, watchRunning } = makeSUT({ presented: false });
    center.request(inboxZero, null);
    expect(watchRunning()).toBe(false);
  });

  it('behind a dialog that stays up it is dropped at sixty seconds', () => {
    const { center, advance, bursts, held, chimed, watchRunning } = makeSUT({ presented: true });
    center.request(inboxZero, null);
    advance(CELEBRATION_HELD_LIFETIME + 0.01);
    center.pollHeldBursts();
    expect(held()).toEqual([]);
    expect(bursts()).toEqual([]);
    expect(chimed).toEqual([]);
    expect(watchRunning()).toBe(false);
  });

  it('a tracked surface closing does not release while another dialog is still up', () => {
    const { center, probe, advance, bursts, held } = makeSUT({ presented: true });
    center.surfacePresented('promoteSheet');
    center.request(inboxZero, null);
    advance(0.3);
    center.surfaceDismissed('promoteSheet');
    expect(bursts()).toEqual([]);
    expect(held()).toHaveLength(1);
    probe.presented = false;
    center.pollHeldBursts();
    expect(bursts()).toHaveLength(1);
  });
});
