/**
 * The soft-delete rule (`RecentlyDeleted/SoftDelete.swift`). One function decides liveness for
 * every list and the purge, because the rule has a subtlety a hand-rolled copy gets wrong: a stamp
 * in the FUTURE is a delete that has not yet aged.
 */

export const RETENTION_DAYS = 30;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Absent stamp = live. Every document written before soft delete existed has no key at all. */
export function isLive(deletedAt: Date | undefined): boolean {
  return deletedAt === undefined;
}

/** A live item is never purgeable, whatever the clock says; a future stamp is kept. */
export function isPurgeable(deletedAt: Date | undefined, now: Date): boolean {
  if (deletedAt === undefined) return false;
  return now.getTime() - deletedAt.getTime() > RETENTION_MS;
}

export function live<T extends { readonly deletedAt?: Date }>(items: readonly T[]): T[] {
  return items.filter((item) => isLive(item.deletedAt));
}

export function deleted<T extends { readonly deletedAt?: Date }>(items: readonly T[]): T[] {
  return items.filter((item) => !isLive(item.deletedAt));
}

export class ItemIsDeletedError extends Error {
  constructor() {
    super("That's in Recently Deleted. Restore it from Tools to open it.");
    this.name = 'ItemIsDeletedError';
  }
}

/** The single-document read's guard: throws rather than opening a deleted item as if it were live. */
export function requireLive<T extends { readonly deletedAt?: Date }>(item: T): T {
  if (!isLive(item.deletedAt)) throw new ItemIsDeletedError();
  return item;
}
