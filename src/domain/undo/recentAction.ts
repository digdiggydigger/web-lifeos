/**
 * `RecentAction` (`Undo/RecentAction.swift`), the kinds M1.1 needs. One slot app-wide; the newest
 * action replaces the previous one; no timeout. M1.5 completes the port.
 */
export type RecentActionKind = 'taskClosed' | 'taskDeleted';

export interface RecentAction {
  readonly kind: RecentActionKind;
  readonly subject: string;
  /** Reverses the action through the normal write paths. Resolves true when it landed. */
  readonly undo: () => Promise<boolean>;
}

export function recentActionVerb(kind: RecentActionKind): string {
  return kind === 'taskClosed' ? 'Closed' : 'Deleted';
}

export const RECENT_ACTION_BUTTON = 'Undo';

export function recentActionAnnouncement(action: Pick<RecentAction, 'kind' | 'subject'>): string {
  return `${recentActionVerb(action.kind)}. ${action.subject}. Undo available.`;
}
