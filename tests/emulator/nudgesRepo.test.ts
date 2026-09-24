import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { newNudge } from '@/data/codec/payloads/nudges';
import { firebase } from '@/data/firebase';
import {
  createNudge,
  fetchNudge,
  fetchNudges,
  markNudgeFired,
  NudgeNotFoundError,
  unmarkNudgeFired,
  updateNudge,
} from '@/data/repos/nudgesRepo';
import { EVERY_DAY } from '@/domain/nudges';

import { resetEmulators, signUpTestUser } from './support';

describe('nudgesRepo', () => {
  let uid = '';
  const created = new Date(2026, 7, 12, 9);

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('nudges');
  });

  it('creates the exact iOS key set, ordered by created_at, and reads the schedule as the cron string', async () => {
    const { db } = firebase();
    const first = newNudge(
      { label: 'Hydrate', schedule: { hour: 9, minute: 0, weekdays: EVERY_DAY } },
      created,
    );
    const second = newNudge(
      { label: 'Stretch', schedule: { hour: 18, minute: 30, weekdays: new Set([1, 3]) } },
      new Date(created.getTime() + 60_000),
    );
    await createNudge(db, uid, second);
    await createNudge(db, uid, first);

    const raw = (await getDoc(doc(db, 'users', uid, 'nudges', first.id))).data()!;
    expect(Object.keys(raw).sort()).toEqual([
      'active',
      'created_at',
      'id',
      'label',
      'schedule',
      'updated_at',
    ]);
    expect(raw['schedule']).toBe('0 9 * * 0,1,2,3,4,5,6');
    const list = await fetchNudges(db, uid);
    expect(list.items.map((n) => n.label)).toEqual(['Hydrate', 'Stretch']);
    expect(list.skipped).toHaveLength(0);
  });

  it('update writes the delta with a server updated_at, then re-reads; an empty payload writes nothing', async () => {
    const { db } = firebase();
    const nudge = newNudge(
      { label: 'Meds', schedule: { hour: 8, minute: 0, weekdays: EVERY_DAY } },
      created,
    );
    await createNudge(db, uid, nudge);
    const updated = await updateNudge(db, uid, nudge.id, { label: 'Take the meds', active: false });
    expect(updated.label).toBe('Take the meds');
    expect(updated.active).toBe(false);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.getTime());
    const untouched = await updateNudge(db, uid, nudge.id, {});
    expect(untouched).toEqual(updated);
    await expect(updateNudge(db, uid, 'MISSING', { label: 'x' })).rejects.toBeInstanceOf(
      NudgeNotFoundError,
    );
    await expect(fetchNudge(db, uid, 'MISSING')).rejects.toBeInstanceOf(NudgeNotFoundError);
  });

  it('a firing round-trips both stamps and the completion array; an undo restores or clears exactly', async () => {
    const { db } = firebase();
    const nudge = newNudge(
      { label: 'Walk', schedule: { hour: 7, minute: 0, weekdays: EVERY_DAY } },
      created,
    );
    await createNudge(db, uid, nudge);
    const firedAt = new Date(2026, 7, 14, 7, 5);
    const fired = await markNudgeFired(db, uid, nudge.id, [], firedAt);
    expect(fired.lastFiredAt).toEqual(firedAt);
    expect(fired.updatedAt).toEqual(firedAt);
    expect(fired.completionDates).toEqual([firedAt]);

    const again = new Date(2026, 7, 15, 7, 5);
    const twice = await markNudgeFired(db, uid, nudge.id, fired.completionDates ?? [], again);
    expect(twice.completionDates).toEqual([firedAt, again]);

    const restored = await unmarkNudgeFired(
      db,
      uid,
      nudge.id,
      firedAt,
      [firedAt],
      new Date(2026, 7, 15, 7, 6),
    );
    expect(restored.lastFiredAt).toEqual(firedAt);
    expect(restored.completionDates).toEqual([firedAt]);

    const never = await unmarkNudgeFired(
      db,
      uid,
      nudge.id,
      undefined,
      [],
      new Date(2026, 7, 15, 7, 7),
    );
    expect(never.lastFiredAt).toBeUndefined();
    expect(never.completionDates).toEqual([]);
    const raw = (await getDoc(doc(db, 'users', uid, 'nudges', nudge.id))).data()!;
    expect(raw).not.toHaveProperty('last_fired_at');
  });
});
