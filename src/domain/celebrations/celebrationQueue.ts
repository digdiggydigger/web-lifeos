/**
 * `Celebrations/CelebrationBurst.swift` (the live list), the Confirm clock, glow and dim from
 * `Focus/ConfirmCelebrationRecipe.swift` and `ConfirmFireworksDrawing.swift`.
 *
 * Quick celebrations OVERLAP rather than restart, at most three full-screen at once (oldest
 * dropped) and eight pops, counted per family so a pop can never evict a Confirm.
 */
import { clearedStack, isFullScreen, type CelebrationBurst } from './celebrationModels';
import { lastSparkTime } from './fireworks';

export const CONFIRM_CELEBRATION_CLOCK = {
  /** The prototype's choreography E chose from. */
  choreographyLength: 4.2,
  /** E, 2026-09-11: "extend the animation length by 1.2 seconds" — a STRETCH, not a tail. */
  extraLength: 1.2,
  /** The stack-clearing choreography: the dim has lifted by 4.99 s. "Same stretch". */
  stackClearingChoreographyLength: 5.0,
} as const;

/** How long an every-Confirm (and, since F8, every milestone) is on screen: 5.4 s. */
export function everyConfirmLength(): number {
  return CONFIRM_CELEBRATION_CLOCK.choreographyLength + CONFIRM_CELEBRATION_CLOCK.extraLength;
}

/** How fast the choreography plays against the wall clock (~78%). */
export function pace(): number {
  return CONFIRM_CELEBRATION_CLOCK.choreographyLength / everyConfirmLength();
}

/** How long a stack-clearing celebration is on screen: 5.0 / pace ≈ 6.43 s. */
export function stackClearingLength(): number {
  return CONFIRM_CELEBRATION_CLOCK.stackClearingChoreographyLength / pace();
}

export const CELEBRATION_QUEUE = {
  fullScreenCap: 3,
  popCap: 8,
  /** E's F6: "lives 0.7–1.0 s"; the layer draws a pop for one second. */
  popLength: 1.0,
} as const;

/** Seconds a burst stays on screen. */
export function burstLength(burst: CelebrationBurst): number {
  switch (burst.kind.kind) {
    case 'pop':
      return CELEBRATION_QUEUE.popLength;
    case 'confirm':
      return burst.kind.clearedStack ? stackClearingLength() : everyConfirmLength();
    case 'milestone':
      return everyConfirmLength();
  }
}

function secondsSince(start: number, now: number): number {
  return (now - start) / 1000;
}

/** Full-screen bursts are drawn on the stretched clock; a pop runs on raw seconds. */
export function choreographyTime(burst: CelebrationBurst, now: number): number {
  const elapsed = secondsSince(burst.start, now);
  return isFullScreen(burst) ? elapsed * pace() : elapsed;
}

function endOf(burst: CelebrationBurst): number {
  return burst.start + burstLength(burst) * 1000;
}

/** Only the bursts still in the air at `now`. A burst ends exactly at its length. */
export function prunedBursts(bursts: readonly CelebrationBurst[], now: number): CelebrationBurst[] {
  return bursts.filter((b) => now < endOf(b));
}

/** When the soonest-ending live burst ends (epoch ms), or `null` with nothing live. */
export function nextExpiry(bursts: readonly CelebrationBurst[]): number | null {
  if (bursts.length === 0) return null;
  return Math.min(...bursts.map(endOf));
}

/** Adds `burst` after pruning what has ended, capping each family and keeping issue order. */
export function addBurst(
  burst: CelebrationBurst,
  bursts: readonly CelebrationBurst[],
  now: number,
): CelebrationBurst[] {
  const all = [...prunedBursts(bursts, now), burst];
  const keep = new Set([
    ...all
      .filter(isFullScreen)
      .slice(-CELEBRATION_QUEUE.fullScreenCap)
      .map((b) => b.ordinal),
    ...all
      .filter((b) => !isFullScreen(b))
      .slice(-CELEBRATION_QUEUE.popCap)
      .map((b) => b.ordinal),
  ]);
  return all.filter((b) => keep.has(b.ordinal));
}

/** The done-green wash that swells from the bottom edge on every full-screen celebration. */
export const CONFIRM_CELEBRATION_GLOW = {
  colorName: 'state-go',
  peakOpacity: 0.32,
  radius: 760,
  fadeIn: 0.3,
  holdUntil: 0.9,
  goneBy: 2.4,
} as const;

export function confirmGlowEnvelope(time: number): number {
  const g = CONFIRM_CELEBRATION_GLOW;
  if (time <= 0) return 0;
  if (time < g.fadeIn) return time / g.fadeIn;
  if (time <= g.holdUntil) return 1;
  return Math.max(0, 1 - (time - g.holdUntil) / (g.goneBy - g.holdUntil));
}

/** Overlapping full-screens share ONE glow at the strongest envelope. A pop never glows. */
export function strongestGlowEnvelope(bursts: readonly CelebrationBurst[], now: number): number {
  return Math.max(
    0,
    ...bursts.filter(isFullScreen).map((b) => confirmGlowEnvelope(choreographyTime(b, now))),
  );
}

/** E, by video: in LIGHT appearance the screen dims to 85% under the fireworks. Dark never dims. */
export const CONFIRM_CELEBRATION_DIM = {
  colorName: 'scrim',
  peakOpacity: 0.85,
  fadeIn: 0.35,
  holdMargin: 0.4,
  fadeOut: 0.6,
} as const;

export function dimHoldUntil(): number {
  return lastSparkTime() - CONFIRM_CELEBRATION_DIM.holdMargin;
}

export function dimGoneBy(): number {
  return dimHoldUntil() + CONFIRM_CELEBRATION_DIM.fadeOut;
}

export function confirmDimEnvelope(time: number): number {
  const d = CONFIRM_CELEBRATION_DIM;
  if (time <= 0) return 0;
  if (time < d.fadeIn) return time / d.fadeIn;
  const hold = dimHoldUntil();
  if (time <= hold) return 1;
  return Math.max(0, 1 - (time - hold) / d.fadeOut);
}

/** Only stack-clearing bursts dim, sharing ONE dim at the strongest envelope. */
export function strongestDimEnvelope(bursts: readonly CelebrationBurst[], now: number): number {
  return Math.max(
    0,
    ...bursts.filter(clearedStack).map((b) => confirmDimEnvelope(choreographyTime(b, now))),
  );
}
