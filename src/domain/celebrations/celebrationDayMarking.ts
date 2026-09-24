/**
 * `Celebrations/CelebrationDayMarking.swift`: which milestones have been celebrated TODAY, for the
 * one that is once per day (the daily goal, F7: "no replay after an undo-and-recross").
 *
 * Keyed by uid so a second account in the same browser never inherits the first one's mark; one
 * key per (milestone, account) holding the start-of-day epoch, overwritten each day. Device-local:
 * a presentation hint, not user data.
 */
import { startOfDay } from '@/domain/time/calendar';

import type { CelebrationMilestone } from './celebrationModels';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function celebrationDayKey(milestone: CelebrationMilestone, uid: string): string {
  return `celebrations.lastCelebratedDay.${milestone}.${uid}`;
}

function dayStamp(now: Date): string {
  return String(startOfDay(now).getTime() / 1000);
}

export function hasCelebratedToday(
  milestone: CelebrationMilestone,
  uid: string,
  now: Date,
  storage: StorageLike | undefined,
): boolean {
  try {
    return storage?.getItem(celebrationDayKey(milestone, uid)) === dayStamp(now);
  } catch {
    return false;
  }
}

/** Idempotent: the caller marks whenever it celebrates and never has to check first. */
export function markCelebratedToday(
  milestone: CelebrationMilestone,
  uid: string,
  now: Date,
  storage: StorageLike | undefined,
): void {
  try {
    storage?.setItem(celebrationDayKey(milestone, uid), dayStamp(now));
  } catch {
    // The harmless direction: the goal celebrates once more after an undo-and-recross.
  }
}
