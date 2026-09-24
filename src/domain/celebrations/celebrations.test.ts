// Ports of CelebrationPolicyTests, CelebrationMotionTests, CelebrationQueueTests,
// ConfirmCelebrationTimingTests, ConfirmCelebrationDimTests and the CelebrationDayMarking cases.
// The CallSite tests grep Swift source and have no web equivalent.
import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_MILESTONES,
  CONFIRM_CELEBRATION_CLOCK,
  CONFIRM_CELEBRATION_DIM,
  CONFIRM_CELEBRATION_GLOW,
  CELEBRATION_QUEUE,
  addBurst,
  celebrationDayKey,
  celebrationOutcome,
  choreographyTime,
  confirmDimEnvelope,
  confirmGlowEnvelope,
  dimHoldUntil,
  dimGoneBy,
  everyConfirmLength,
  hasCelebratedToday,
  isFullScreen,
  lastSparkTime,
  markCelebratedToday,
  nextExpiry,
  pace,
  prunedBursts,
  burstLength,
  resolveCelebrationRendering,
  stackClearingLength,
  strongestDimEnvelope,
  strongestGlowEnvelope,
  surfaceDismissesItself,
  type CelebrationBurst,
  type CelebrationKind,
} from '.';

const launch = 1_800_000_000_000;
const at = (seconds: number) => launch + seconds * 1000;

function burst(ordinal: number, kind: CelebrationKind, start: number = launch): CelebrationBurst {
  return { ordinal, kind, surface: 'root', start, origin: null };
}
const confirm = (clearedStack = false): CelebrationKind => ({ kind: 'confirm', clearedStack });
const milestone = (m: (typeof CELEBRATION_MILESTONES)[number]): CelebrationKind => ({
  kind: 'milestone',
  milestone: m,
});
const pop: CelebrationKind = { kind: 'pop' };

describe('CelebrationPolicy', () => {
  it('a pop always plays in place, even with the switch off (E #3)', () => {
    expect(celebrationOutcome(pop, false)).toBe('inPlace');
    expect(celebrationOutcome(pop, true)).toBe('inPlace');
  });

  it('a confirm is full screen with the switch on and nothing at all with it off', () => {
    expect(celebrationOutcome(confirm(false), true)).toBe('fullScreen');
    expect(celebrationOutcome(confirm(true), false)).toBe('nothing');
  });

  it('a milestone is never downgraded by anything that played before it (no cooldown)', () => {
    for (const m of CELEBRATION_MILESTONES) {
      for (let i = 0; i < 3; i += 1) {
        expect(celebrationOutcome(milestone(m), true)).toBe('fullScreen');
      }
    }
  });

  it('a milestone with the switch off falls back to the in-place celebration (R-h)', () => {
    for (const m of CELEBRATION_MILESTONES) {
      expect(celebrationOutcome(milestone(m), false)).toBe('inPlace');
    }
  });

  it('the policy takes no clock', () => {
    expect(celebrationOutcome.length).toBe(2);
  });

  it('only the promote sheet dismisses itself', () => {
    expect(surfaceDismissesItself('promoteSheet')).toBe(true);
    expect(surfaceDismissesItself('root')).toBe(false);
    expect(surfaceDismissesItself('routineCover')).toBe(false);
    expect(surfaceDismissesItself('tasksSearch')).toBe(false);
  });
});

describe('CelebrationMotion', () => {
  it('a confirm plays in full with reduce motion on (E waived 7.2 for it)', () => {
    expect(resolveCelebrationRendering(true, confirm(false))).toBe('full');
    expect(resolveCelebrationRendering(true, confirm(true))).toBe('full');
  });

  it('every new kind fades under reduce motion', () => {
    for (const m of CELEBRATION_MILESTONES) {
      expect(resolveCelebrationRendering(true, milestone(m))).toBe('still');
    }
    expect(resolveCelebrationRendering(true, pop)).toBe('still');
  });

  it('nothing is reduced when the setting is off', () => {
    expect(resolveCelebrationRendering(false, pop)).toBe('full');
    expect(resolveCelebrationRendering(false, milestone('inboxZero'))).toBe('full');
    expect(resolveCelebrationRendering(false, confirm(false))).toBe('full');
  });
});

describe('CelebrationQueue', () => {
  it('a pop is on screen for one second', () => {
    expect(burstLength(burst(1, pop))).toBeCloseTo(1.0, 4);
  });

  it('a milestone is on screen for exactly the every-confirm length (F8)', () => {
    expect(burstLength(burst(1, milestone('inboxZero')))).toBeCloseTo(everyConfirmLength(), 4);
    expect(burstLength(burst(2, confirm(false)))).toBeCloseTo(everyConfirmLength(), 4);
  });

  it('a stack-clearing confirm keeps its stretched fireworks length', () => {
    expect(burstLength(burst(1, confirm(true)))).toBeCloseTo(stackClearingLength(), 4);
    expect(burstLength(burst(1, confirm(true)))).toBeGreaterThan(
      burstLength(burst(2, confirm(false))),
    );
  });

  it('pops run on raw seconds while full screens run on the stretched clock', () => {
    expect(choreographyTime(burst(1, pop), at(1))).toBeCloseTo(1.0, 4);
    expect(choreographyTime(burst(2, confirm(false)), at(1))).toBeCloseTo(pace(), 4);
  });

  it('a fourth live full screen drops the oldest', () => {
    let live: CelebrationBurst[] = [];
    for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
      live = addBurst(burst(ordinal, milestone('inboxZero')), live, launch);
    }
    expect(live).toHaveLength(CELEBRATION_QUEUE.fullScreenCap);
    expect(live.map((b) => b.ordinal)).toEqual([2, 3, 4]);
  });

  it('the caps are counted per family, so pops never evict a full screen', () => {
    let live = addBurst(burst(1, confirm(false)), [], launch);
    for (let ordinal = 2; ordinal <= 10; ordinal += 1) {
      live = addBurst(burst(ordinal, pop), live, launch);
    }
    expect(live.filter(isFullScreen).map((b) => b.ordinal)).toEqual([1]);
    expect(live.filter((b) => !isFullScreen(b))).toHaveLength(CELEBRATION_QUEUE.popCap);
    expect(live.filter((b) => !isFullScreen(b)).map((b) => b.ordinal)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('a finished burst is pruned and the next expiry is the soonest', () => {
    const p = burst(1, pop);
    const m = burst(2, milestone('dailyGoal'));
    const live = [p, m];
    expect(nextExpiry(live)).toEqual(at(burstLength(p)));
    expect(prunedBursts(live, at(burstLength(p) + 0.001)).map((b) => b.ordinal)).toEqual([2]);
    expect(prunedBursts(live, at(burstLength(m) + 0.001))).toEqual([]);
    expect(nextExpiry([])).toBeNull();
  });

  it('adding prunes what has already ended', () => {
    const stale = burst(1, pop);
    expect(addBurst(burst(2, pop), [stale], at(2)).map((b) => b.ordinal)).toEqual([2]);
  });
});

describe('ConfirmCelebrationTiming', () => {
  const confirmAfter = (ordinal: number, seconds = 0, clearedStack = false) =>
    burst(ordinal, confirm(clearedStack), at(seconds));

  it('the glow swells, holds and fades on the record’s envelope', () => {
    expect(confirmGlowEnvelope(-0.1)).toBeCloseTo(0, 9);
    expect(confirmGlowEnvelope(0)).toBeCloseTo(0, 9);
    expect(confirmGlowEnvelope(0.15)).toBeCloseTo(0.5, 9);
    expect(confirmGlowEnvelope(0.3)).toBeCloseTo(1, 9);
    expect(confirmGlowEnvelope(0.9)).toBeCloseTo(1, 9);
    expect(confirmGlowEnvelope(1.65)).toBeCloseTo(0.5, 9);
    expect(confirmGlowEnvelope(2.4)).toBeCloseTo(0, 9);
    expect(confirmGlowEnvelope(3)).toBeCloseTo(0, 9);
    expect(CONFIRM_CELEBRATION_GLOW).toMatchObject({
      colorName: 'state-go',
      peakOpacity: 0.32,
      radius: 760,
    });
  });

  it('overlapping confirms share one glow at the strongest', () => {
    const older = confirmAfter(1);
    const newer = confirmAfter(2, 1.2 / pace());
    expect(strongestGlowEnvelope([older, newer], at(1.25 / pace()))).toBeCloseTo(1 - 0.35 / 1.5, 6);
    expect(strongestGlowEnvelope([], launch)).toBe(0);
  });

  it('a pop never glows', () => {
    expect(strongestGlowEnvelope([burst(1, pop)], at(0.5))).toBe(0);
  });

  it('the celebration runs the extra seconds E asked for, stretched evenly', () => {
    const c = confirmAfter(1);
    expect(CONFIRM_CELEBRATION_CLOCK.extraLength).toBeCloseTo(1.2, 9);
    expect(everyConfirmLength()).toBeCloseTo(5.4, 9);
    expect(choreographyTime(c, at(5.4))).toBeCloseTo(4.2, 6);
    expect(choreographyTime(c, at(2.7))).toBeCloseTo(2.1, 6);
  });

  it('a fourth quick confirm drops the oldest burst', () => {
    let bursts: CelebrationBurst[] = [];
    for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
      const next = confirmAfter(ordinal, 0.2 * ordinal);
      bursts = addBurst(next, bursts, next.start);
    }
    expect(bursts.map((b) => b.ordinal)).toEqual([2, 3, 4]);
  });

  it('a burst is gone once its length has passed', () => {
    const first = confirmAfter(1);
    expect(prunedBursts([first], at(5.39)).map((b) => b.ordinal)).toEqual([1]);
    expect(prunedBursts([first], at(5.41))).toHaveLength(0);
    const later = confirmAfter(2, 6);
    expect(addBurst(later, [first], later.start).map((b) => b.ordinal)).toEqual([2]);
    const expiry = nextExpiry([first, confirmAfter(3, 1)]);
    expect(((expiry ?? 0) - launch) / 1000).toBeCloseTo(5.4, 6);
    expect(nextExpiry([])).toBeNull();
  });

  it('a stack-clearing confirm plays its fireworks on the same stretch', () => {
    const cleared = confirmAfter(1, 0, true);
    expect(CONFIRM_CELEBRATION_CLOCK.stackClearingChoreographyLength).toBeCloseTo(5.0, 9);
    expect(burstLength(cleared)).toBeCloseTo(5.0 / pace(), 9);
    expect(Math.abs(burstLength(cleared) - 6.43)).toBeLessThan(0.005);
    expect(burstLength(confirmAfter(1))).toBeCloseTo(5.4, 9);
    expect(choreographyTime(cleared, at(burstLength(cleared)))).toBeCloseTo(5.0, 6);
  });

  it('a stack-clearing burst outlives its last spark and its dim', () => {
    expect(lastSparkTime()).toBeLessThanOrEqual(
      CONFIRM_CELEBRATION_CLOCK.stackClearingChoreographyLength,
    );
    expect(dimGoneBy()).toBeLessThanOrEqual(
      CONFIRM_CELEBRATION_CLOCK.stackClearingChoreographyLength,
    );
    expect(dimGoneBy()).toBeGreaterThan(4.9);
    const cleared = confirmAfter(1, 0, true);
    expect(prunedBursts([cleared], at(6.42))).toHaveLength(1);
    expect(prunedBursts([cleared], at(6.44))).toHaveLength(0);
    const expiry = nextExpiry([cleared, confirmAfter(2)]);
    expect(((expiry ?? 0) - launch) / 1000).toBeCloseTo(5.4, 6);
  });
});

describe('ConfirmCelebrationDim', () => {
  it('is the scrim token at 85%', () => {
    expect(CONFIRM_CELEBRATION_DIM.colorName).toBe('scrim');
    expect(CONFIRM_CELEBRATION_DIM.peakOpacity).toBeCloseTo(0.85, 9);
  });

  it('comes in, holds for the fireworks and lifts as the last spark dies', () => {
    expect(confirmDimEnvelope(-0.1)).toBeCloseTo(0, 9);
    expect(confirmDimEnvelope(0)).toBeCloseTo(0, 9);
    expect(confirmDimEnvelope(0.175)).toBeCloseTo(0.5, 9);
    expect(confirmDimEnvelope(0.35)).toBeCloseTo(1, 9);
    expect(confirmDimEnvelope(2.6)).toBeCloseTo(1, 9);
    expect(confirmDimEnvelope(4.39)).toBeCloseTo(1, 9);
    expect(confirmDimEnvelope(4.69)).toBeCloseTo(0.5, 9);
    expect(confirmDimEnvelope(4.99)).toBeCloseTo(0, 9);
    expect(confirmDimEnvelope(5.5)).toBeCloseTo(0, 9);
  });

  it('its hold is tied to the last spark', () => {
    expect(dimHoldUntil()).toBeCloseTo(lastSparkTime() - 0.4, 9);
    expect(dimHoldUntil()).toBeCloseTo(4.39, 6);
    expect(dimGoneBy()).toBeCloseTo(4.99, 6);
  });

  it('only stack-clearing confirms dim, and overlapping ones share the strongest', () => {
    const every = burst(1, confirm(false), launch);
    const cleared = burst(2, confirm(true), at(1));
    expect(strongestDimEnvelope([every], at(1))).toBe(0);
    expect(strongestDimEnvelope([every, cleared], at(1 + 0.175 / pace()))).toBeCloseTo(0.5, 6);
    const halfLifted = at(4.69 / pace());
    const older = burst(3, confirm(true), launch);
    const newer = burst(4, confirm(true), halfLifted);
    expect(strongestDimEnvelope([older, newer], halfLifted)).toBeCloseTo(0.5, 6);
    const newerComingIn = halfLifted + (0.175 / pace()) * 1000;
    expect(strongestDimEnvelope([older, newer], newerComingIn)).toBeCloseTo(0.5, 6);
    expect(strongestDimEnvelope([], launch)).toBe(0);
  });
});

describe('CelebrationDayMarking', () => {
  function memoryStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      map,
    };
  }

  it('is keyed by milestone and uid', () => {
    expect(celebrationDayKey('dailyGoal', 'U1')).toBe(
      'celebrations.lastCelebratedDay.dailyGoal.U1',
    );
  });

  it('an unwritten key has never celebrated', () => {
    expect(hasCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 24, 10), memoryStorage())).toBe(
      false,
    );
  });

  it('marks today, and tomorrow is a new day', () => {
    const storage = memoryStorage();
    markCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 24, 10), storage);
    expect(hasCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 24, 23), storage)).toBe(true);
    expect(hasCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 25, 0, 1), storage)).toBe(false);
  });

  it('a second account in the same browser does not inherit the first one’s mark', () => {
    const storage = memoryStorage();
    markCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 24, 10), storage);
    expect(hasCelebratedToday('dailyGoal', 'U2', new Date(2026, 8, 24, 11), storage)).toBe(false);
  });

  it('one key per (milestone, account), overwritten each day', () => {
    const storage = memoryStorage();
    markCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 24, 10), storage);
    markCelebratedToday('dailyGoal', 'U1', new Date(2026, 8, 25, 10), storage);
    expect(storage.map.size).toBe(1);
  });

  it('a storage that throws reads as never celebrated and swallows the write', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => markCelebratedToday('dailyGoal', 'U1', new Date(), throwing)).not.toThrow();
    expect(hasCelebratedToday('dailyGoal', 'U1', new Date(), throwing)).toBe(false);
  });
});
