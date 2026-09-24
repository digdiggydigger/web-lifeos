// Port of FirebaseLifeAreaEditorClientAdapterTests + reorder semantics against the emulator.
import { doc, getDoc } from 'firebase/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

import { firebase } from '@/data/firebase';
import {
  createLifeArea,
  fetchLifeAreas,
  reorderLifeAreas,
  setLifeAreaArchived,
  updateLifeArea,
} from '@/data/repos/lifeAreasRepo';

import { resetEmulators, signUpTestUser } from './support';

describe('life areas editor writes', () => {
  let uid = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await resetEmulators();
    uid = await signUpTestUser('areas-editor');
  });

  it('create starts sort_order at zero, then appends, writes no palette, and refuses a case-insensitive clash', async () => {
    const { db } = firebase();
    const first = await createLifeArea(db, uid, 'Work', '💼');
    expect(first.kind).toBe('ok');
    ids['work'] = (first as { id: string }).id;
    const second = await createLifeArea(db, uid, 'Health', '🫀');
    ids['health'] = (second as { id: string }).id;
    const raw = (await getDoc(doc(db, 'users', uid, 'life_areas', ids['health']))).data()!;
    expect(raw).toEqual({
      id: ids['health'],
      name: 'Health',
      colour: '🫀',
      sort_order: 1,
      archived: false,
    });
    const clash = await createLifeArea(db, uid, ' work ', '💼');
    expect(clash).toMatchObject({
      kind: 'nameConflict',
      conflict: { id: ids['work'], archived: false },
    });
  });

  it('update writes only the given keys; a rename onto another name conflicts; a same-name rename of itself is fine', async () => {
    const { db } = firebase();
    expect(
      await updateLifeArea(db, uid, ids['work']!, { colour: '🧑‍💻', palette: { kind: 'unchanged' } }),
    ).toEqual({ kind: 'ok' });
    let raw = (await getDoc(doc(db, 'users', uid, 'life_areas', ids['work']!))).data()!;
    expect(raw['colour']).toBe('🧑‍💻');
    expect(raw['name']).toBe('Work');
    expect(
      await updateLifeArea(db, uid, ids['work']!, {
        name: 'HEALTH',
        palette: { kind: 'unchanged' },
      }),
    ).toMatchObject({ kind: 'nameConflict' });
    expect(
      await updateLifeArea(db, uid, ids['work']!, {
        name: 'Work',
        palette: { kind: 'set', key: 'growth' },
      }),
    ).toEqual({ kind: 'ok' });
    raw = (await getDoc(doc(db, 'users', uid, 'life_areas', ids['work']!))).data()!;
    expect(raw['palette']).toBe('growth');
    await updateLifeArea(db, uid, ids['work']!, { palette: { kind: 'automatic' } });
    raw = (await getDoc(doc(db, 'users', uid, 'life_areas', ids['work']!))).data()!;
    expect(raw).not.toHaveProperty('palette');
  });

  it('archiving writes the boolean both ways and a create clashing with an archived area reports it archived', async () => {
    const { db } = firebase();
    await setLifeAreaArchived(db, uid, ids['health']!, true);
    expect((await fetchLifeAreas(db, uid)).items.map((a) => a.name)).toEqual(['Work']);
    expect(await createLifeArea(db, uid, 'health', '🫀')).toMatchObject({
      kind: 'nameConflict',
      conflict: { archived: true },
    });
    await setLifeAreaArchived(db, uid, ids['health']!, false);
    const raw = (await getDoc(doc(db, 'users', uid, 'life_areas', ids['health']!))).data()!;
    expect(raw['archived']).toBe(false);
  });

  it('reorder writes index → sort_order over the complete order in one batch', async () => {
    const { db } = firebase();
    await reorderLifeAreas(db, uid, [ids['health']!, ids['work']!]);
    expect((await fetchLifeAreas(db, uid)).items.map((a) => [a.name, a.sortOrder])).toEqual([
      ['Health', 0],
      ['Work', 1],
    ]);
  });
});
