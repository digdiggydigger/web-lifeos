import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newId, newLog } from '@/data/codec';
import { firebase } from '@/data/firebase';
import { fetchCaptures } from '@/data/repos/capturesRepo';
import { fetchFocusSessions } from '@/data/repos/focusSessionsRepo';
import { appendLog, deleteLog, fetchLogs, fetchLogsForLifeArea } from '@/data/repos/logsRepo';

import { resetEmulators, signUpTestUser } from './support';

describe('logsRepo', () => {
  let uid = '';
  const area = newId();
  const tag = newId();

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('logs');
  });

  it('appends the exact iOS key set and reads back newest first', async () => {
    const { db } = firebase();
    const older = newLog(
      {
        body: 'Older',
        type: 'log',
        lifeAreaId: undefined,
        energyLevel: undefined,
        moodEmoji: undefined,
        tagIds: [],
      },
      new Date(2026, 7, 13, 9),
    );
    const newer = newLog(
      {
        body: 'Newer',
        type: 'journal',
        lifeAreaId: area,
        energyLevel: 'high',
        moodEmoji: '🔥',
        tagIds: [tag],
      },
      new Date(2026, 7, 14, 9),
    );
    await appendLog(db, uid, older);
    await appendLog(db, uid, newer);

    const raw = (await getDoc(doc(db, 'users', uid, 'logs', newer.id))).data()!;
    expect(Object.keys(raw).sort()).toEqual(
      [
        'body',
        'created_at',
        'energy_level',
        'entry_date',
        'id',
        'life_area_id',
        'mood_emoji',
        'tag_ids',
        'type',
      ].sort(),
    );
    expect(raw['entry_date']).toBeInstanceOf(Timestamp);
    expect(raw['tag_ids']).toEqual([tag]);
    const rawOlder = (await getDoc(doc(db, 'users', uid, 'logs', older.id))).data()!;
    expect(Object.keys(rawOlder).sort()).toEqual([
      'body',
      'created_at',
      'entry_date',
      'id',
      'type',
    ]);

    const list = await fetchLogs(db, uid);
    expect(list.items.map((l) => l.body)).toEqual(['Newer', 'Older']);
    expect(list.items[0]?.energyLevel).toBe('high');
    expect(list.items[0]?.tagIds).toEqual([tag]);
    expect((await fetchLogsForLifeArea(db, uid, area)).items.map((l) => l.body)).toEqual(['Newer']);
  });

  it('an unknown energy level decodes as absent, never as a skipped document', async () => {
    const { db } = firebase();
    const id = newId();
    await setDoc(doc(db, 'users', uid, 'logs', id), {
      id,
      type: 'journal',
      body: 'From a later build',
      entry_date: Timestamp.fromDate(new Date(2026, 7, 12, 9)),
      created_at: Timestamp.fromDate(new Date(2026, 7, 12, 9)),
      energy_level: 'transcendent',
    });
    const list = await fetchLogs(db, uid);
    expect(list.skipped).toHaveLength(0);
    expect(list.items.find((l) => l.id === id)?.energyLevel).toBeUndefined();
  });

  it('deletes one entry outright (the capture-triage undo path)', async () => {
    const { db } = firebase();
    const entry = newLog(
      {
        body: 'Take me back',
        type: 'log',
        lifeAreaId: undefined,
        energyLevel: undefined,
        moodEmoji: undefined,
        tagIds: [],
      },
      new Date(),
    );
    await appendLog(db, uid, entry);
    await deleteLog(db, uid, entry.id);
    expect((await getDoc(doc(db, 'users', uid, 'logs', entry.id))).exists()).toBe(false);
  });

  it('reads focus sessions newest first and captures without the soft-deleted ones', async () => {
    const { db } = firebase();
    const session = (id: string, endedAt: Date) => ({
      id,
      task_title: 'Draft',
      life_area_emoji: '💼',
      planned_seconds: 1500,
      focused_seconds: 1500,
      checkpoints_reached: 2,
      completed_naturally: true,
      started_at: Timestamp.fromDate(new Date(endedAt.getTime() - 1500 * 1000)),
      ended_at: Timestamp.fromDate(endedAt),
    });
    const s1 = newId();
    const s2 = newId();
    await setDoc(
      doc(db, 'users', uid, 'focus_sessions', s1),
      session(s1, new Date(2026, 7, 13, 10)),
    );
    await setDoc(
      doc(db, 'users', uid, 'focus_sessions', s2),
      session(s2, new Date(2026, 7, 14, 10)),
    );
    expect((await fetchFocusSessions(db, uid)).items.map((s) => s.id)).toEqual([s2, s1]);

    const c1 = newId();
    const c2 = newId();
    const captureDoc = (id: string, extra: Record<string, unknown>) => ({
      id,
      content: 'thought',
      kind: 'note',
      processed: false,
      created_at: Timestamp.fromDate(new Date()),
      ...extra,
    });
    await setDoc(doc(db, 'users', uid, 'captures', c1), captureDoc(c1, {}));
    await setDoc(
      doc(db, 'users', uid, 'captures', c2),
      captureDoc(c2, { deletedAt: Timestamp.fromDate(new Date()) }),
    );
    expect((await fetchCaptures(db, uid)).items.map((c) => c.id)).toEqual([c1]);
  });
});
