/**
 * `Celebrations/CelebrationCenter.swift`: the app's one celebration owner. Every site asks it; it
 * applies the policy, tags the burst with whichever surface is in front, and publishes the live
 * list the layer draws.
 *
 * **Held full-screens.** A full-screen celebration asked for while it would be drawn where nobody
 * can see it — the frontmost surface closes itself (the promote sheet), or the root has the capture
 * composer or any native `<dialog open>` over it (modal dialogs sit in the browser's top layer,
 * above any z-index) — is held, released over whatever is in front once the way is clear, restarted
 * at release, dropped after 60 s, and chimes only when it plays.
 *
 * Everything reads an injected clock, probe and scheduler, so the rules are testable without real
 * seconds.
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  addBurst,
  celebrationOutcome,
  prunedBursts,
  surfaceDismissesItself,
  type CelebrationBurst,
  type CelebrationKind,
  type CelebrationOutcome,
  type CelebrationSurface,
  type Point,
} from '@/domain/celebrations';

/** R-g: a burst held longer than this is stale and is dropped rather than released. Seconds. */
export const CELEBRATION_HELD_LIFETIME = 60;
/** How often the hold watch asks whether the way is clear. Runs only while something is held. */
export const CELEBRATION_HOLD_POLL_MS = 250;

export type CelebrationFeel = 'success';

export interface CelebrationCenterState {
  /** What is on screen, across every surface. */
  readonly bursts: readonly CelebrationBurst[];
  /** Full-screens waiting for the way to clear. */
  readonly held: readonly CelebrationBurst[];
}

export interface CelebrationCenterOptions {
  /** Epoch milliseconds. */
  readonly now?: () => number;
  /** E's Settings switch, read at FIRE time so flipping it takes effect on the next celebration. */
  readonly celebrationsGate: () => boolean;
  /** F5: one chime over full-screen celebrations only. */
  readonly chime?: (kind: CelebrationKind) => void;
  /** R-d's success feel for the daily goal. No haptics on the web; the seam stays for the rule. */
  readonly feel?: (feel: CelebrationFeel) => void;
  /** Whether anything the centre was never told about is presented (an open `<dialog>`). */
  readonly probe?: () => boolean;
  /** Starts the repeating hold watch; returns its cancel. */
  readonly schedule?: (tick: () => void, intervalMs: number) => () => void;
}

/** The door a site sees: ask, and tell the centre when a surface comes and goes. */
export interface CelebrationRequester {
  request(kind: CelebrationKind, origin: Point | null): CelebrationOutcome;
  surfacePresented(surface: CelebrationSurface): void;
  surfaceDismissed(surface: CelebrationSurface): void;
}

export interface CelebrationCenter extends CelebrationRequester {
  readonly store: StoreApi<CelebrationCenterState>;
  frontmost(): CelebrationSurface;
  burstsOn(surface: CelebrationSurface): CelebrationBurst[];
  captureChanged(isOpen: boolean): void;
  /** One tick of the hold watch: R-g first, then play if the way is clear. */
  pollHeldBursts(): void;
  /** Removes every burst that has finished by `now` (epoch ms). */
  prune(now: number): void;
}

function defaultSchedule(tick: () => void, intervalMs: number): () => void {
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}

export function createCelebrationCenter(options: CelebrationCenterOptions): CelebrationCenter {
  const now = options.now ?? (() => Date.now());
  const chime = options.chime ?? (() => undefined);
  const feel = options.feel ?? (() => undefined);
  const probe = options.probe ?? (() => false);
  const schedule = options.schedule ?? defaultSchedule;

  const store = createStore<CelebrationCenterState>(() => ({ bursts: [], held: [] }));
  /** Presented surfaces, innermost last. The root is the base and is never on it. */
  let presented: CelebrationSurface[] = [];
  let captureIsOpen = false;
  /** One counter for every burst, so ids and confetti seeds never collide between kinds. */
  let ordinal = 0;
  let stopWatch: (() => void) | undefined;

  const frontmost = (): CelebrationSurface => presented[presented.length - 1] ?? 'root';

  /** The one predicate behind both the hold and the release. The probe is read only from the root. */
  function isBlocked(): boolean {
    const front = frontmost();
    if (surfaceDismissesItself(front)) return true;
    if (front !== 'root') return false;
    return captureIsOpen || probe();
  }

  /** The one place a burst begins, so a held release and a direct enqueue cannot disagree. */
  function start(burst: CelebrationBurst, at: number): void {
    if (burst.kind.kind !== 'pop') chime(burst.kind);
    store.setState({ bursts: addBurst(burst, store.getState().bursts, at) });
  }

  function stopHoldWatch(): void {
    stopWatch?.();
    stopWatch = undefined;
  }

  function beginHoldWatch(): void {
    if (stopWatch) return;
    stopWatch = schedule(releaseHeldIfClear, CELEBRATION_HOLD_POLL_MS);
  }

  /** A held burst plays over whatever is in front NOW, starting NOW. */
  function releaseHeldIfClear(): void {
    const { held } = store.getState();
    if (held.length === 0) return;
    const moment = now();
    const fresh = held.filter((b) => (moment - b.start) / 1000 <= CELEBRATION_HELD_LIFETIME);
    if (fresh.length === 0) {
      store.setState({ held: [] });
      stopHoldWatch();
      return;
    }
    if (isBlocked()) {
      if (fresh.length !== held.length) store.setState({ held: fresh });
      return;
    }
    store.setState({ held: [] });
    stopHoldWatch();
    for (const burst of fresh) {
      start({ ...burst, surface: frontmost(), start: moment }, moment);
    }
  }

  return {
    store,
    frontmost,
    burstsOn: (surface) => store.getState().bursts.filter((b) => b.surface === surface),

    request(kind, origin) {
      const moment = now();
      // The gate is read BEFORE anything is enqueued.
      const outcome = celebrationOutcome(kind, options.celebrationsGate());
      if (outcome === 'nothing') return 'nothing';
      // R-d: fires at request time, held or downgraded, because the ring has no site of its own.
      if (kind.kind === 'milestone' && kind.milestone === 'dailyGoal') feel('success');

      ordinal += 1;
      const burst: CelebrationBurst = {
        ordinal,
        // A downgraded milestone plays as the same pop every other in-place moment gets.
        kind: outcome === 'fullScreen' ? kind : { kind: 'pop' },
        surface: frontmost(),
        start: moment,
        origin,
      };
      if (outcome === 'fullScreen' && isBlocked()) {
        store.setState({ held: [...store.getState().held, burst] });
        beginHoldWatch();
        return outcome;
      }
      start(burst, moment);
      return outcome;
    },

    surfacePresented(surface) {
      if (surface === 'root') return;
      presented = [...presented.filter((s) => s !== surface), surface];
    },

    surfaceDismissed(surface) {
      presented = presented.filter((s) => s !== surface);
      releaseHeldIfClear();
    },

    captureChanged(isOpen) {
      captureIsOpen = isOpen;
      if (!isOpen) releaseHeldIfClear();
    },

    pollHeldBursts: releaseHeldIfClear,

    prune(at) {
      const { bursts } = store.getState();
      const remaining = prunedBursts(bursts, at);
      if (remaining.length !== bursts.length) store.setState({ bursts: remaining });
    },
  };
}
