/**
 * `NudgesClientAdapting` and `NudgeNotificationSchedulingAdapting`, plus their web implementations:
 * Firestore through the repo, and the in-tab Notification API (there is no OS scheduler on the web,
 * so a timer walks the schedule while a tab is open; the phone remains the real trigger source).
 */
import type { Firestore } from 'firebase/firestore';

import { newNudge } from '@/data/codec/payloads/nudges';
import * as repo from '@/data/repos/nudgesRepo';
import { nextFireTime } from '@/domain/nudges';
import type {
  NormalizedCreateNudgeInput,
  NudgeSchedule,
  NudgeUpdatePayload,
} from '@/domain/nudges';
import type { Nudge } from '@/domain/types';

export interface NudgesClient {
  fetchNudges(): Promise<Nudge[]>;
  createNudge(input: NormalizedCreateNudgeInput): Promise<Nudge>;
  updateNudge(id: string, payload: NudgeUpdatePayload): Promise<Nudge>;
  /** Appends the firing instant to `existingCompletionDates` and writes the whole array. */
  markFired(id: string, existingCompletionDates: readonly Date[]): Promise<Nudge>;
  /** Takes a "Done for now" back with the values held BEFORE it. */
  unmarkFired(
    id: string,
    previousLastFiredAt: Date | undefined,
    previousCompletionDates: readonly Date[],
  ): Promise<Nudge>;
}

export interface NudgeNotifier {
  /** Already granted; scheduling needs no prompt. */
  isAuthorized(): boolean;
  /** Prompts only while undecided; a browser needs a user gesture for this, so it is called from Save, never from load. */
  requestAuthorizationIfNeeded(): Promise<boolean>;
  schedule(nudgeId: string, label: string, schedule: NudgeSchedule): void;
  cancel(nudgeId: string): void;
}

export function firebaseNudgesClient(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): NudgesClient {
  return {
    fetchNudges: async () => (await repo.fetchNudges(db, uid)).items.slice(),
    createNudge: async (input) => {
      const nudge = newNudge(input, now());
      await repo.createNudge(db, uid, nudge);
      return nudge;
    },
    updateNudge: (id, payload) => repo.updateNudge(db, uid, id, payload),
    markFired: (id, existing) => repo.markNudgeFired(db, uid, id, existing, now()),
    unmarkFired: (id, previousLastFiredAt, previousCompletionDates) =>
      repo.unmarkNudgeFired(db, uid, id, previousLastFiredAt, previousCompletionDates, now()),
  };
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function browserNudgeNotifier(): NudgeNotifier {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const supported = () => typeof Notification !== 'undefined';

  function arm(nudgeId: string, label: string, schedule: NudgeSchedule): void {
    const next = nextFireTime(schedule, new Date());
    if (!next) return;
    const delay = Math.min(Math.max(next.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
    timers.set(
      nudgeId,
      setTimeout(() => {
        timers.delete(nudgeId);
        if (Date.now() < next.getTime()) {
          arm(nudgeId, label, schedule);
          return;
        }
        try {
          new Notification(label, { tag: `nudge-${nudgeId}` });
        } catch {
          // A notification that cannot be shown is not a failed nudge.
        }
        arm(nudgeId, label, schedule);
      }, delay),
    );
  }

  return {
    isAuthorized: () => supported() && Notification.permission === 'granted',
    requestAuthorizationIfNeeded: async () => {
      if (!supported()) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      try {
        return (await Notification.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    },
    schedule: (nudgeId, label, schedule) => {
      const existing = timers.get(nudgeId);
      if (existing !== undefined) clearTimeout(existing);
      timers.delete(nudgeId);
      if (supported() && Notification.permission === 'granted') arm(nudgeId, label, schedule);
    },
    cancel: (nudgeId) => {
      const existing = timers.get(nudgeId);
      if (existing !== undefined) clearTimeout(existing);
      timers.delete(nudgeId);
    },
  };
}
