/**
 * `Nudges/NudgeFirstRunMarker.swift`: whether an ACCOUNT has ever had a nudge, keyed by uid so a
 * second account in the same browser never inherits the first one's answer. Device-local on
 * purpose: a presentation hint, not user data.
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function nudgeFirstRunKey(uid: string): string {
  return `nudges.hasEverHadAny.${uid}`;
}

export function hasEverHadNudges(uid: string, storage: StorageLike | undefined): boolean {
  try {
    return storage?.getItem(nudgeFirstRunKey(uid)) === 'true';
  } catch {
    return false;
  }
}

/** Idempotent: callers latch on every appearance and on every change. */
export function markHasHadNudges(uid: string, storage: StorageLike | undefined): void {
  try {
    storage?.setItem(nudgeFirstRunKey(uid), 'true');
  } catch {
    // The harmless direction: the door shows once more than it needed to.
  }
}
