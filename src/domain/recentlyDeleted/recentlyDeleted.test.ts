// Ports of RecentlyDeletedPresentationTests and RecentlyDeletedSurvivorChoiceTests.
import { describe, expect, it } from 'vitest';

import { isPurgeable, RETENTION_DAYS } from '@/domain/softDelete';

import {
  daysRemaining,
  DELETE_FOREVER_MESSAGE,
  deleteForeverTitle,
  EMPTY_BODY,
  kindWord,
  RECENTLY_DELETED_KINDS,
  recentlyDeletedContent,
  remainingPhrase,
  SECTION_CAPTION,
  survivorChoice,
  toolsRowSubtitle,
} from './index';
import type { RecentlyDeletedItem, RecentlyDeletedKind } from './index';

const now = new Date(1_800_000_000_000);
const day = 24 * 60 * 60 * 1000;
function item(
  title: string,
  daysAgo: number,
  kind: RecentlyDeletedKind = 'task',
): RecentlyDeletedItem {
  return {
    itemId: title.toUpperCase(),
    kind,
    title,
    deletedAt: new Date(now.getTime() - daysAgo * day),
  };
}

describe('time remaining', () => {
  it('a fresh delete has the whole window, a part day rounds up, the boundary is the last day and not purged', () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(daysRemaining(now, now)).toBe(30);
    expect(daysRemaining(new Date(now.getTime() - 2.5 * day), now)).toBe(28);
    const exactly = new Date(now.getTime() - 30 * day);
    expect(isPurgeable(exactly, now)).toBe(false);
    expect(daysRemaining(exactly, now)).toBe(0);
    expect(remainingPhrase(0)).toBe('Last day');
    const future = new Date(now.getTime() + 2 * day);
    expect(daysRemaining(future, now)).toBeGreaterThan(RETENTION_DAYS);
    expect(isPurgeable(future, now)).toBe(false);
    for (const daysAgo of [31, 40, 400]) {
      const stamp = new Date(now.getTime() - daysAgo * day);
      expect(isPurgeable(stamp, now)).toBe(true);
      expect(daysRemaining(stamp, now)).toBe(0);
    }
    expect(remainingPhrase(1)).toBe('1 day left');
    expect(remainingPhrase(9)).toBe('9 days left');
  });
});

describe('content', () => {
  it('orders newest first, names the kind and remaining time, gives distinct ids, and empty is its own state', () => {
    const content = recentlyDeletedContent(
      [item('Older', 3), item('Newest', 1), item('Middle', 2)],
      now,
    );
    expect(content.kind === 'rows' && content.rows.map((r) => r.title)).toEqual([
      'Newest',
      'Middle',
      'Older',
    ]);
    const one = recentlyDeletedContent([item('Ring the dentist', 3)], now);
    expect(one.kind === 'rows' && one.rows[0]).toMatchObject({
      title: 'Ring the dentist',
      subtitle: 'Task · 27 days left',
      glyph: 'task',
    });
    const cap = recentlyDeletedContent([item('Bike lock', 0, 'capture')], now);
    expect(cap.kind === 'rows' && cap.rows[0]?.subtitle).toBe('Capture · 30 days left');
    const shared = recentlyDeletedContent(
      [
        { itemId: 'SAME', kind: 'task', title: 'a', deletedAt: now },
        { itemId: 'SAME', kind: 'capture', title: 'b', deletedAt: now },
      ],
      now,
    );
    expect(shared.kind === 'rows' && new Set(shared.rows.map((r) => r.id)).size).toBe(2);
    expect(recentlyDeletedContent([], now)).toEqual({ kind: 'empty' });
  });
  it('copy interpolates the window, delete-forever names the kind, tools row names count and soonest departure', () => {
    for (const copy of [SECTION_CAPTION, EMPTY_BODY]) expect(copy).toContain('30');
    expect(DELETE_FOREVER_MESSAGE).toBe("This can't be undone.");
    expect(deleteForeverTitle('task')).toBe('Delete this task forever?');
    expect(deleteForeverTitle('capture')).toBe('Delete this capture forever?');
    expect(deleteForeverTitle('tag')).toBe('Delete this tag forever?');
    expect(toolsRowSubtitle([item('a', 29), item('b', 2)], now)).toBe('2 items · 1 day left');
    expect(toolsRowSubtitle([item('a', 2)], now)).toBe('1 item · 28 days left');
    expect(toolsRowSubtitle([], now)).toBe('Nothing waiting');
    expect(new Set(RECENTLY_DELETED_KINDS.map(kindWord)).size).toBe(3);
    expect(kindWord('tag')).toBe('Tag');
    for (const noun of ['Tasks', 'captures', 'tags']) expect(SECTION_CAPTION).toContain(noun);
  });
});

describe('survivor choice', () => {
  it('offers both spellings by name when they differ, one Merge when they match, and compares exactly', () => {
    const differ = survivorChoice('errand', 'Errand');
    expect(differ.keepRestoredTitle).toBe('Keep “errand”');
    expect(differ.keepLiveTitle).toBe('Keep “Errand”');
    expect(differ.title).toBe('“Errand” already exists');
    expect(differ.message).toContain('“errand”');
    expect(differ.message).toContain('one tag');
    expect(differ.cancelTitle).toBe('Cancel');
    const same = survivorChoice('errand', 'errand');
    expect(same.keepLiveTitle).toBeUndefined();
    expect(same.keepRestoredTitle).toBe('Merge');
    expect(survivorChoice('ERRAND', 'errand').keepLiveTitle).toBeDefined();
  });
});
