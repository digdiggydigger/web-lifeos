// Ports of FirestoreFieldPayloadsTests (task half), FirestoreTaskStatusPayloadTests and
// FirestoreFieldPayloadsSoftDeleteTests (task half). A wrong key raises nothing, so the wrong
// convention's spelling is asserted ABSENT as well as the right one present.
import { describe, expect, it } from 'vitest';

import { isFieldDelete, isServerTimestamp } from '../fields';
import { fromTimestamp } from '../time';
import { taskRestore, taskSoftDelete, taskStatus, taskUpdate } from './tasks';

const referenceDate = new Date(1_755_000_000_000);
const lifeAreaId = '7F3C2A10-1B2C-4D5E-8F90-1234567890AB';
const placeId = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D';

describe('taskUpdate: fully snake_cased', () => {
  it('writes nothing for an empty payload', () => {
    expect(taskUpdate({})).toEqual({});
  });

  it('sets only the fields present in the payload', () => {
    const fields = taskUpdate({ title: 'Draft the brief' });
    expect(Object.keys(fields)).toEqual(['title']);
    expect(fields['title']).toBe('Draft the brief');
  });

  it('writes priority as its raw value', () => {
    expect(taskUpdate({ priority: 'p1' })['priority']).toBe('p1');
  });

  it('snake_cases life_area_id; the camelCase spelling belongs to captures, not tasks', () => {
    const fields = taskUpdate({ lifeAreaId });
    expect(fields['life_area_id']).toBe(lifeAreaId);
    expect(fields).not.toHaveProperty('lifeAreaId');
  });

  it('writes due_date as a Timestamp', () => {
    const fields = taskUpdate({ dueDate: referenceDate });
    expect(fromTimestamp(fields['due_date'])).toEqual(referenceDate);
    expect(fields).not.toHaveProperty('dueDate');
  });

  it('snake_cases the focus config', () => {
    const fields = taskUpdate({ focusDurationSeconds: 1500, nudgesCount: 3 });
    expect(fields['focus_duration_seconds']).toBe(1500);
    expect(fields['nudges_count']).toBe(3);
    expect(fields).not.toHaveProperty('focusDurationSeconds');
    expect(fields).not.toHaveProperty('nudgesCount');
  });

  it('snake_cases at_place_id and clears it with a delete', () => {
    expect(taskUpdate({ atPlaceId: placeId })['at_place_id']).toBe(placeId);
    expect(isFieldDelete(taskUpdate({ atPlaceId: null })['at_place_id'])).toBe(true);
    expect(taskUpdate({ atPlaceId: placeId })).not.toHaveProperty('atPlaceId');
  });

  describe('the nested-optional clear convention', () => {
    it('does not write untouched nested optionals', () => {
      const fields = taskUpdate({ title: 'Draft the brief' });
      expect(fields).not.toHaveProperty('notes');
      expect(fields).not.toHaveProperty('life_area_id');
      expect(fields).not.toHaveProperty('due_date');
    });

    it('turns explicitly cleared fields into a delete', () => {
      const fields = taskUpdate({ notes: null, lifeAreaId: null, dueDate: null });
      expect(Object.keys(fields).sort()).toEqual(['due_date', 'life_area_id', 'notes']);
      expect(isFieldDelete(fields['notes'])).toBe(true);
      expect(isFieldDelete(fields['life_area_id'])).toBe(true);
      expect(isFieldDelete(fields['due_date'])).toBe(true);
    });

    it('a clear is a delete, not a server timestamp', () => {
      expect(isServerTimestamp(taskUpdate({ notes: null })['notes'])).toBe(false);
    });
  });
});

describe('taskStatus: status, completion stamp and location trio in one write', () => {
  it('completing stamps the CLIENT clock', () => {
    const fields = taskStatus('done', referenceDate);
    expect(fields['status']).toBe('done');
    expect(fromTimestamp(fields['completed_at'])).toEqual(referenceDate);
    expect(fields).not.toHaveProperty('completedAt');
  });

  it('reopening deletes the stamp', () => {
    const fields = taskStatus('open', referenceDate);
    expect(fields['status']).toBe('open');
    expect(isFieldDelete(fields['completed_at'])).toBe(true);
  });

  it('always writes the full field set together', () => {
    for (const status of ['open', 'done'] as const) {
      expect(Object.keys(taskStatus(status, referenceDate)).sort()).toEqual([
        'completed_at',
        'latitude',
        'longitude',
        'place_id',
        'status',
      ]);
    }
  });

  it('completing with a stamp writes the location trio, snake_cased', () => {
    const fields = taskStatus('done', referenceDate, {
      latitude: 51.5152,
      longitude: -0.1418,
      placeId,
    });
    expect(fields['place_id']).toBe(placeId);
    expect(fields['latitude']).toBe(51.5152);
    expect(fields['longitude']).toBe(-0.1418);
    expect(fields).not.toHaveProperty('placeId');
  });

  it('completing outside a named place keeps the coordinates and erases the place', () => {
    const fields = taskStatus('done', referenceDate, { latitude: 51.5152, longitude: -0.1418 });
    expect(isFieldDelete(fields['place_id'])).toBe(true);
    expect(fields['latitude']).toBe(51.5152);
    expect(fields['longitude']).toBe(-0.1418);
  });

  it('no stamp and reopening both erase the location trio', () => {
    for (const status of ['open', 'done'] as const) {
      const fields = taskStatus(status, referenceDate);
      for (const key of ['place_id', 'latitude', 'longitude']) {
        expect(isFieldDelete(fields[key]), `${key} erased for ${status}`).toBe(true);
      }
    }
  });

  it('a stamp on a reopen is ignored: a reopened task was not finished anywhere', () => {
    const fields = taskStatus('open', referenceDate, { latitude: 1, longitude: 2, placeId });
    expect(isFieldDelete(fields['place_id'])).toBe(true);
    expect(isFieldDelete(fields['latitude'])).toBe(true);
  });
});

describe('task soft delete', () => {
  it('stamps deleted_at (snake_case) and touches nothing else', () => {
    const fields = taskSoftDelete(referenceDate);
    expect(Object.keys(fields)).toEqual(['deleted_at']);
    expect(fromTimestamp(fields['deleted_at'])).toEqual(referenceDate);
    expect(fields).not.toHaveProperty('deletedAt');
  });

  it('restore erases the stamp rather than writing null', () => {
    const fields = taskRestore();
    expect(Object.keys(fields)).toEqual(['deleted_at']);
    expect(isFieldDelete(fields['deleted_at'])).toBe(true);
    expect(fields).not.toHaveProperty('deletedAt');
  });
});
