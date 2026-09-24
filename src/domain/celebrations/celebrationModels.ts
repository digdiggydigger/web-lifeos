/**
 * `Celebrations/CelebrationRequesting.swift`, `CelebrationPolicy.swift`, `CelebrationMotion.swift`:
 * the vocabulary every celebration site speaks, the one rule that decides what a request GETS, and
 * which rendering it gets under reduced motion.
 *
 * **A site asks; it never decides.** The policy has no clock: E removed the milestone cooldown on
 * 2026-09-12 ("Remove the cooldown entirely"), so a milestone plays every time, like a Confirm.
 */

/** The four moments E chose as full-screen milestones. `routineFinished` is Phase 3 on the web. */
export const CELEBRATION_MILESTONES = [
  'inboxZero',
  'routineFinished',
  'streakSeven',
  'dailyGoal',
] as const;
export type CelebrationMilestone = (typeof CELEBRATION_MILESTONES)[number];

export type CelebrationKind =
  | { readonly kind: 'confirm'; readonly clearedStack: boolean }
  | { readonly kind: 'milestone'; readonly milestone: CelebrationMilestone }
  | { readonly kind: 'pop' };

/** Every surface that can be in front of the user with a celebration site on it. */
export type CelebrationSurface = 'root' | 'routineCover' | 'tasksSearch' | 'promoteSheet';

/**
 * The promote sheet closes ITSELF after a successful promote, so a 5.4 s celebration requested
 * from it would be cut off. The centre holds it until the surface goes.
 */
export function surfaceDismissesItself(surface: CelebrationSurface): boolean {
  return surface === 'promoteSheet';
}

export type CelebrationOutcome = 'fullScreen' | 'inPlace' | 'nothing';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** One celebration on screen. `ordinal` is both its identity and the seed its paper is drawn from. */
export interface CelebrationBurst {
  readonly ordinal: number;
  readonly kind: CelebrationKind;
  readonly surface: CelebrationSurface;
  /** Epoch milliseconds, fractional allowed (a `Date` would truncate the choreography clock). */
  readonly start: number;
  /** Where a pop was tapped, in viewport coordinates; `null` for a full-screen celebration. */
  readonly origin: Point | null;
}

/** Full-screen celebrations and pops are capped and timed differently. */
export function isFullScreen(burst: CelebrationBurst): boolean {
  return burst.kind.kind !== 'pop';
}

/** The one Confirm that earns the fireworks and the light-mode dim. */
export function clearedStack(burst: CelebrationBurst): boolean {
  return burst.kind.kind === 'confirm' && burst.kind.clearedStack;
}

/**
 * `CelebrationPolicy.outcome`. E's #3: the Celebrations switch turns off every FULL-SCREEN
 * celebration; in-place feedback stays. R-h: with the switch off a milestone still gets its
 * fallback pop. A Confirm with the switch off gets nothing (it is not swapped for a smaller one).
 */
export function celebrationOutcome(
  kind: CelebrationKind,
  celebrationsEnabled: boolean,
): CelebrationOutcome {
  switch (kind.kind) {
    case 'pop':
      return 'inPlace';
    case 'confirm':
      return celebrationsEnabled ? 'fullScreen' : 'nothing';
    case 'milestone':
      return celebrationsEnabled ? 'fullScreen' : 'inPlace';
  }
}

export type CelebrationRendering = 'full' | 'still';

/**
 * `CelebrationMotion.resolve`. E waived §7.2 for Confirm by name ("B AND C"): with reduced motion
 * it still rains. Every other kind fades (E's #7, "Fade everywhere new"). The Confirm branch is
 * answered before the setting is read.
 */
export function resolveCelebrationRendering(
  reduceMotion: boolean,
  kind: CelebrationKind,
): CelebrationRendering {
  if (kind.kind === 'confirm') return 'full';
  return reduceMotion ? 'still' : 'full';
}
