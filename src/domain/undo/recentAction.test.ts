// Port of UndoCapsulePresentationTests (the pure half).
import { describe, expect, it } from 'vitest';

import {
  recentActionAnnouncement,
  recentActionButtonLabel,
  recentActionTint,
  recentActionVerb,
} from './recentAction';
import type { RecentActionKind } from './recentAction';

const ALL: readonly RecentActionKind[] = [
  'taskClosed',
  'nudgeDismissed',
  'captureSorted',
  'captureSkipped',
  'captureJournalled',
  'draftKeptInInbox',
  'taskDeleted',
  'captureDeleted',
  'tagDeleted',
];

describe('recent action presentation', () => {
  it('each kind names what happened in one verb; sorting names the area', () => {
    expect(recentActionVerb('taskClosed')).toBe('Closed');
    expect(recentActionVerb('nudgeDismissed')).toBe('Done for now');
    expect(recentActionVerb('captureSkipped')).toBe('Skipped');
    expect(recentActionVerb('captureJournalled')).toBe('Journalled');
    expect(recentActionVerb('taskDeleted')).toBe('Deleted');
    expect(recentActionVerb('captureDeleted')).toBe('Deleted');
    expect(recentActionVerb('tagDeleted')).toBe('Deleted');
    expect(recentActionVerb('captureSorted', '💼 Work')).toBe('Sorted to 💼 Work');
    expect(recentActionVerb('captureSorted')).toBe('Sorted');
    expect(recentActionVerb('draftKeptInInbox')).toBe('Kept in your inbox');
  });
  it('only the filed draft offers Reopen; its announcement says so', () => {
    for (const kind of ALL) {
      expect(recentActionButtonLabel(kind)).toBe(kind === 'draftKeptInInbox' ? 'Reopen' : 'Undo');
    }
    expect(recentActionAnnouncement({ kind: 'draftKeptInInbox', subject: 'Half a thought' })).toBe(
      'Kept in your inbox. Half a thought. Reopen available.',
    );
    expect(
      recentActionAnnouncement({ kind: 'captureSorted', subject: 'x', areaLabel: '💼 Work' }),
    ).toBe('Sorted to 💼 Work. x. Undo available.');
    expect(recentActionAnnouncement({ kind: 'taskClosed', subject: 'Pay the bill' })).toBe(
      'Closed. Pay the bill. Undo available.',
    );
  });
  it('tints: completions go, filing verbs accent, skip and deletes quiet', () => {
    expect(recentActionTint('taskClosed')).toBe('completion');
    expect(recentActionTint('nudgeDismissed')).toBe('completion');
    expect(recentActionTint('captureSorted')).toBe('accent');
    expect(recentActionTint('captureJournalled')).toBe('accent');
    expect(recentActionTint('draftKeptInInbox')).toBe('accent');
    expect(recentActionTint('captureSkipped')).toBe('secondary');
    expect(recentActionTint('taskDeleted')).toBe('secondary');
    expect(recentActionTint('captureDeleted')).toBe('secondary');
  });
});
