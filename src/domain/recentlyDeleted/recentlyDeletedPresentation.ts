/** `RecentlyDeleted/RecentlyDeletedItem.swift` + `RecentlyDeletedPresentation.swift`. */
import { isPurgeable, RETENTION_DAYS, RETENTION_MS } from '@/domain/softDelete';

export type RecentlyDeletedKind = 'task' | 'capture' | 'tag';
export const RECENTLY_DELETED_KINDS: readonly RecentlyDeletedKind[] = ['task', 'capture', 'tag'];

export interface NameCollision {
  readonly liveId: string;
  readonly liveName: string;
}

export interface RecentlyDeletedItem {
  readonly itemId: string;
  readonly kind: RecentlyDeletedKind;
  readonly title: string;
  readonly deletedAt: Date;
  /** Tags only: a live tag took the name while this one was deleted. */
  readonly collision?: NameCollision | undefined;
}

/** A row's identity includes its collection: a task and a capture can share a UUID space. */
export function recentlyDeletedId(item: Pick<RecentlyDeletedItem, 'kind' | 'itemId'>): string {
  return `${item.kind}-${item.itemId}`;
}

export { isPurgeable, RETENTION_DAYS };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rounds a part day UP: something the purge would take is never shown time remaining. */
export function daysRemaining(deletedAt: Date, now: Date): number {
  const remaining = RETENTION_MS - (now.getTime() - deletedAt.getTime());
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

export function remainingPhrase(days: number): string {
  if (days === 0) return 'Last day';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export const SCREEN_TITLE = 'Recently Deleted';
export const SECTION_TITLE = 'Recently Deleted';
export const RESTORE_TITLE = 'Restore';
export const DELETE_FOREVER_TITLE = 'Delete Forever';
export const SECTION_CAPTION = `Tasks, captures and tags you delete wait ${RETENTION_DAYS} days before they're gone for good.`;
export const EMPTY_HEADLINE = 'Nothing deleted';
export const EMPTY_BODY = `Anything you delete waits here for ${RETENTION_DAYS} days, so a slip is never the end of it. Nothing is waiting right now.`;
export const TOOLS_ROW_LOADING_SUBTITLE = 'Restore something you deleted by mistake';

export function deleteForeverTitle(kind: RecentlyDeletedKind): string {
  return {
    task: 'Delete this task forever?',
    capture: 'Delete this capture forever?',
    tag: 'Delete this tag forever?',
  }[kind];
}
export const DELETE_FOREVER_MESSAGE = "This can't be undone.";
export const DELETE_FOREVER_CONFIRM = DELETE_FOREVER_TITLE;
export const DELETE_FOREVER_CANCEL = 'Keep it';

export interface SurvivorChoice {
  readonly title: string;
  readonly message: string;
  readonly keepRestoredTitle: string;
  /** Absent when both spellings match: one action, not two identical ones. */
  readonly keepLiveTitle: string | undefined;
  readonly cancelTitle: string;
}

/** The choice is shaped by an EXACT comparison; the collision itself folds case. */
export function survivorChoice(restoredName: string, liveName: string): SurvivorChoice {
  if (restoredName === liveName) {
    return {
      title: `“${restoredName}” already exists`,
      message: `A tag named “${restoredName}” was made while this one was deleted. Restoring makes them one tag, on every item either of them is on.`,
      keepRestoredTitle: 'Merge',
      keepLiveTitle: undefined,
      cancelTitle: 'Cancel',
    };
  }
  return {
    title: `“${liveName}” already exists`,
    message: `A tag named “${liveName}” was made while “${restoredName}” was deleted. Restoring makes them one tag — which spelling should it keep?`,
    keepRestoredTitle: `Keep “${restoredName}”`,
    keepLiveTitle: `Keep “${liveName}”`,
    cancelTitle: 'Cancel',
  };
}

export interface RecentlyDeletedRow {
  readonly id: string;
  readonly item: RecentlyDeletedItem;
  readonly glyph: RecentlyDeletedKind;
  readonly title: string;
  readonly subtitle: string;
}

export type RecentlyDeletedContent =
  | { readonly kind: 'rows'; readonly rows: readonly RecentlyDeletedRow[] }
  | { readonly kind: 'empty' };

export function kindWord(kind: RecentlyDeletedKind): string {
  return { task: 'Task', capture: 'Capture', tag: 'Tag' }[kind];
}

export function recentlyDeletedContent(
  items: readonly RecentlyDeletedItem[],
  now: Date,
): RecentlyDeletedContent {
  if (items.length === 0) return { kind: 'empty' };
  const rows = [...items]
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
    .map((item) => ({
      id: recentlyDeletedId(item),
      item,
      glyph: item.kind,
      title: item.title,
      subtitle: `${kindWord(item.kind)} · ${remainingPhrase(daysRemaining(item.deletedAt, now))}`,
    }));
  return { kind: 'rows', rows };
}

/** The Tools door's subtitle: the count and the soonest departure. */
export function toolsRowSubtitle(items: readonly RecentlyDeletedItem[], now: Date): string {
  if (items.length === 0) return 'Nothing waiting';
  const soonest = Math.min(...items.map((i) => daysRemaining(i.deletedAt, now)));
  const count = items.length === 1 ? '1 item' : `${items.length} items`;
  return `${count} · ${remainingPhrase(soonest)}`;
}
