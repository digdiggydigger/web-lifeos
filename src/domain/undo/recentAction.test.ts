import { describe, expect, it } from 'vitest';

import { RECENT_ACTION_BUTTON, recentActionAnnouncement, recentActionVerb } from './recentAction';

describe('RecentAction copy', () => {
  it('has a verb per kind, one button, and an announcement', () => {
    expect(recentActionVerb('taskClosed')).toBe('Closed');
    expect(recentActionVerb('taskDeleted')).toBe('Deleted');
    expect(RECENT_ACTION_BUTTON).toBe('Undo');
    expect(recentActionAnnouncement({ kind: 'taskClosed', subject: 'Renew passport' })).toBe(
      'Closed. Renew passport. Undo available.',
    );
  });
});
