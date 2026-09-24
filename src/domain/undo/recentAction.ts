/** `Undo/RecentAction.swift`: the kinds, their verbs, and the one-slot announcement. */
export type RecentActionKind =
  | 'taskClosed'
  | 'nudgeDismissed'
  | 'captureSorted'
  | 'captureSkipped'
  | 'captureJournalled'
  | 'draftKeptInInbox'
  | 'taskDeleted'
  | 'captureDeleted'
  | 'tagDeleted';

export interface RecentAction {
  readonly kind: RecentActionKind;
  readonly subject: string;
  /** `captureSorted` names where it went, when the area resolved. */
  readonly areaLabel?: string | undefined;
  /** Reverses (or, for a kept draft, reopens) through the normal paths. Resolves true when it landed. */
  readonly undo: () => Promise<boolean>;
}

export function recentActionVerb(kind: RecentActionKind, areaLabel?: string): string {
  switch (kind) {
    case 'taskClosed':
      return 'Closed';
    case 'nudgeDismissed':
      return 'Done for now';
    case 'captureSorted':
      return areaLabel ? `Sorted to ${areaLabel}` : 'Sorted';
    case 'captureSkipped':
      return 'Skipped';
    case 'captureJournalled':
      return 'Journalled';
    case 'draftKeptInInbox':
      return 'Kept in your inbox';
    case 'taskDeleted':
    case 'captureDeleted':
    case 'tagDeleted':
      return 'Deleted';
  }
}

export function recentActionButtonLabel(kind: RecentActionKind): string {
  return kind === 'draftKeptInInbox' ? 'Reopen' : 'Undo';
}

/** @deprecated the button label depends on the kind; kept for the M1.1 call sites. */
export const RECENT_ACTION_BUTTON = 'Undo';

export type RecentActionTint = 'completion' | 'accent' | 'secondary';

export function recentActionTint(kind: RecentActionKind): RecentActionTint {
  switch (kind) {
    case 'taskClosed':
    case 'nudgeDismissed':
      return 'completion';
    case 'captureSorted':
    case 'captureJournalled':
    case 'draftKeptInInbox':
      return 'accent';
    default:
      return 'secondary';
  }
}

export function recentActionAnnouncement(
  action: Pick<RecentAction, 'kind' | 'subject' | 'areaLabel'>,
): string {
  return `${recentActionVerb(action.kind, action.areaLabel)}. ${action.subject}. ${recentActionButtonLabel(action.kind)} available.`;
}
