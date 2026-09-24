// Ports of FocusCompletionRecordTests (the coding cases) and TaskFocusFieldsCodingTests' spelling rule for focus_sessions.
import { describe, expect, it } from 'vitest';

import type { CompletedFocusSession } from '@/domain/types';

import { newId } from '../ids';
import { fromTimestamp } from '../time';
import { decodeFocusSession, encodeFocusSession } from './focusSession';

const record: CompletedFocusSession = {
  id: newId(),
  taskId: newId(),
  taskTitle: 'Draft the quarterly review',
  lifeAreaEmoji: '💼',
  plannedSeconds: 1500,
  focusedSeconds: 1530,
  checkpointsReached: 2,
  completedNaturally: true,
  startedAt: new Date(1_800_000_000_000),
  endedAt: new Date(1_800_001_530_000),
};

describe('focus session codec', () => {
  it('a provisional record writes the exact iOS key set with no confirmed_at', () => {
    const fields = encodeFocusSession(record);
    expect(Object.keys(fields).sort()).toEqual([
      'checkpoints_reached',
      'completed_naturally',
      'ended_at',
      'focused_seconds',
      'id',
      'life_area_emoji',
      'planned_seconds',
      'started_at',
      'task_id',
      'task_title',
    ]);
    expect(fromTimestamp(fields['started_at'])).toEqual(record.startedAt);
    expect(decodeFocusSession(fields)).toEqual(record);
    expect(decodeFocusSession(fields).confirmedAt).toBeUndefined();
  });
  it('confirmed_at round-trips under its snake_case key, never camelCased; a taskless record omits task_id', () => {
    const confirmedAt = new Date(1_800_002_000_000);
    const fields = encodeFocusSession({ ...record, confirmedAt });
    expect(fromTimestamp(fields['confirmed_at'])).toEqual(confirmedAt);
    expect(fields).not.toHaveProperty('confirmedAt');
    expect(decodeFocusSession(fields).confirmedAt).toEqual(confirmedAt);
    const { taskId: _dropped, ...taskless } = record;
    void _dropped;
    expect(encodeFocusSession(taskless)).not.toHaveProperty('task_id');
    expect(encodeFocusSession(taskless)).not.toHaveProperty('taskId');
  });
});
