import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import { fetchFocusSessions, saveFocusSession } from '@/data/repos/focusSessionsRepo';
import { confirmedRecord } from '@/domain/focus';
import type { CompletedFocusSession } from '@/domain/types';

import { resetEmulators, signUpTestUser } from './support';

function record(title: string, endedAt: Date): CompletedFocusSession {
  return {
    id: newId(),
    taskId: newId(),
    taskTitle: title,
    lifeAreaEmoji: '💼',
    plannedSeconds: 900,
    focusedSeconds: 600,
    checkpointsReached: 1,
    completedNaturally: false,
    startedAt: new Date(endedAt.getTime() - 600_000),
    endedAt,
  };
}

describe('focusSessionsRepo', () => {
  let uid = '';

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('focus');
  });

  it('saves the exact iOS key set, reads newest first, and a confirmation upserts the same row', async () => {
    const { db } = firebase();
    const older = record('Older', new Date(2026, 7, 13, 10));
    const newer = record('Newer', new Date(2026, 7, 14, 10));
    await saveFocusSession(db, uid, older);
    await saveFocusSession(db, uid, newer);

    const raw = (await getDoc(doc(db, 'users', uid, 'focus_sessions', newer.id))).data()!;
    expect(Object.keys(raw).sort()).toEqual([
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
    const list = await fetchFocusSessions(db, uid);
    expect(list.items.map((s) => s.taskTitle)).toEqual(['Newer', 'Older']);
    expect(list.items[0]?.confirmedAt).toBeUndefined();

    const confirmedAt = new Date(2026, 7, 14, 10, 5);
    await saveFocusSession(db, uid, confirmedRecord(newer, confirmedAt));
    const all = await getDocs(collection(db, 'users', uid, 'focus_sessions'));
    expect(all.size).toBe(2);
    const again = await fetchFocusSessions(db, uid);
    expect(again.items[0]?.id).toBe(newer.id);
    expect(again.items[0]?.confirmedAt).toEqual(confirmedAt);
    expect(again.items[0]?.taskId).toBe(newer.taskId);
  });
});
