import { doc, setDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { encodeLifeArea, newId } from '@/data/codec';
import { firebase } from '@/data/firebase';
import { fetchLifeAreas, watchLifeAreas } from '@/data/repos/lifeAreasRepo';

import { resetEmulators, signUpTestUser } from './support';

describe('lifeAreasRepo', () => {
  let uid = '';

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('areas');
    const { db } = firebase();
    const write = (id: string, data: Record<string, unknown>) =>
      setDoc(doc(db, 'users', uid, 'life_areas', id), data);
    const b = newId();
    const a = newId();
    const archived = newId();
    await write(
      b,
      encodeLifeArea({ id: b, name: 'Second', colour: '💼', sortOrder: 1, archived: false }),
    );
    await write(
      a,
      encodeLifeArea({ id: a, name: 'First', colour: '🫀', sortOrder: 0, archived: false }),
    );
    await write(
      archived,
      encodeLifeArea({ id: archived, name: 'Old', colour: '📦', sortOrder: 2, archived: true }),
    );
    // A document the iOS decoder would choke on (lowercase id): the web must skip and count it.
    // (A document with NO sort_order never comes back from the orderBy query at all, on either client.)
    await write(newId(), {
      id: newId().toLowerCase(),
      name: 'Broken',
      colour: '💥',
      sort_order: 9,
    });
  });

  it('orders by sort_order, hides archived areas by default, and counts a bad document instead of blanking', async () => {
    const { db } = firebase();
    const list = await fetchLifeAreas(db, uid);
    expect(list.items.map((a) => a.name)).toEqual(['First', 'Second']);
    expect(list.skipped).toHaveLength(1);
    const all = await fetchLifeAreas(db, uid, { includeArchived: true });
    expect(all.items.map((a) => a.name)).toEqual(['First', 'Second', 'Old']);
  });

  it('watches live and delivers a new area without a refetch', async () => {
    const { db } = firebase();
    const seen: string[][] = [];
    await new Promise<void>((resolve, reject) => {
      const stop = watchLifeAreas(db, uid, {
        onData: (list) => {
          seen.push(list.items.map((a) => a.name));
          if (seen.length === 1) {
            const id = newId();
            void setDoc(
              doc(db, 'users', uid, 'life_areas', id),
              encodeLifeArea({ id, name: 'Third', colour: '🌱', sortOrder: 3, archived: false }),
            );
          }
          if (seen.length >= 2 && seen[seen.length - 1]?.includes('Third')) {
            stop();
            resolve();
          }
        },
        onError: reject,
      });
    });
    expect(seen[0]).toEqual(['First', 'Second']);
    expect(seen[seen.length - 1]).toEqual(['First', 'Second', 'Third']);
  });
});
