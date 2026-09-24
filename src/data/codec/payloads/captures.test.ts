// Ports of FirestoreFieldPayloadsTests (capture half) and FirestoreFieldPayloadsSoftDeleteTests
// (capture half + the disjoint-spelling pin).
import { describe, expect, it } from 'vitest';

import { isFieldDelete } from '../fields';
import { fromTimestamp } from '../time';
import {
  captureProcessed,
  captureRestore,
  captureSoftDelete,
  captureUnprocessed,
  captureUpdate,
  newCapture,
} from './captures';
import { taskSoftDelete } from './tasks';

const stamp = new Date(1_755_000_000_000);
const lifeAreaId = '7F3C2A10-1B2C-4D5E-8F90-1234567890AB';

describe('captureUpdate: the mixed-case schema', () => {
  it('writes nothing for empty changes', () => {
    expect(captureUpdate({})).toEqual({});
  });

  it('keeps lifeAreaId camelCased; the snake_case spelling belongs to tasks, not captures', () => {
    const fields = captureUpdate({ lifeAreaId });
    expect(fields['lifeAreaId']).toBe(lifeAreaId);
    expect(fields).not.toHaveProperty('life_area_id');
  });

  it('clearing the life area becomes a delete', () => {
    const fields = captureUpdate({ lifeAreaId: null });
    expect(Object.keys(fields)).toEqual(['lifeAreaId']);
    expect(isFieldDelete(fields['lifeAreaId'])).toBe(true);
  });

  it('does not write an untouched life area', () => {
    expect(Object.keys(captureUpdate({ title: 'Dentist' }))).toEqual(['title']);
  });

  it('a title-only update touches neither processed nor the retired status field', () => {
    const fields = captureUpdate({ title: 'Dentist' });
    expect(Object.keys(fields)).toEqual(['title']);
    expect(fields).not.toHaveProperty('processed');
    expect(fields).not.toHaveProperty('status');
  });

  it('marking seen writes ONLY seen, never processed', () => {
    const fields = captureUpdate({ seen: true });
    expect(Object.keys(fields)).toEqual(['seen']);
    expect(fields['seen']).toBe(true);
  });

  it('undoing seen writes an explicit false, not a delete', () => {
    const fields = captureUpdate({ seen: false });
    expect(Object.keys(fields)).toEqual(['seen']);
    expect(fields['seen']).toBe(false);
    expect(isFieldDelete(fields['seen'])).toBe(false);
  });

  it('notes: writes the annotation, clears with a delete, leaves untouched alone', () => {
    expect(captureUpdate({ notes: 'Read this later' })).toEqual({ notes: 'Read this later' });
    const cleared = captureUpdate({ notes: null });
    expect(Object.keys(cleared)).toEqual(['notes']);
    expect(isFieldDelete(cleared['notes'])).toBe(true);
    expect(captureUpdate({ seen: true })).not.toHaveProperty('notes');
  });

  it('clearedAt writes a Timestamp and clears with a delete', () => {
    const fields = captureUpdate({ clearedAt: stamp });
    expect(Object.keys(fields)).toEqual(['clearedAt']);
    expect(fromTimestamp(fields['clearedAt'])).toEqual(stamp);
    expect(isFieldDelete(captureUpdate({ clearedAt: null })['clearedAt'])).toBe(true);
  });
});

describe('captureProcessed / captureUnprocessed', () => {
  it('writes the processed flag and clearedAt together, and never re-mints status', () => {
    const fields = captureProcessed(stamp);
    expect(Object.keys(fields).sort()).toEqual(['clearedAt', 'processed']);
    expect(fields['processed']).toBe(true);
    expect(fields).not.toHaveProperty('status');
    expect(fromTimestamp(fields['clearedAt'])).toEqual(stamp);
  });

  it('the inverse clears the flag and DELETES the exit stamp', () => {
    const fields = captureUnprocessed();
    expect(Object.keys(fields).sort()).toEqual(['clearedAt', 'processed']);
    expect(fields['processed']).toBe(false);
    expect(isFieldDelete(fields['clearedAt'])).toBe(true);
    expect(fields).not.toHaveProperty('status');
  });
});

describe('capture soft delete', () => {
  it('stamps deletedAt (camelCase) and touches nothing else', () => {
    const fields = captureSoftDelete(stamp);
    expect(Object.keys(fields)).toEqual(['deletedAt']);
    expect(fromTimestamp(fields['deletedAt'])).toEqual(stamp);
    expect(fields).not.toHaveProperty('deleted_at');
  });

  it('restore erases the stamp rather than writing null', () => {
    const fields = captureRestore();
    expect(Object.keys(fields)).toEqual(['deletedAt']);
    expect(isFieldDelete(fields['deletedAt'])).toBe(true);
    expect(fields).not.toHaveProperty('deleted_at');
  });

  it('the two soft-delete payloads never share a spelling', () => {
    const task = new Set(Object.keys(taskSoftDelete(stamp)));
    const capture = Object.keys(captureSoftDelete(stamp));
    expect(capture.some((key) => task.has(key))).toBe(false);
  });
});

describe('newCapture + encodeCapture', () => {
  it('writes the camelCase key set with created_at, no tag_ids, no nulls, no snake_case', async () => {
    const { encodeCapture } = await import('../schemas');
    const fields = encodeCapture(
      newCapture(
        {
          content: 'Buy milk',
          kind: 'note',
          title: undefined,
          lifeAreaId,
          mediaKey: undefined,
          mediaContentType: undefined,
        },
        stamp,
        undefined,
        'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
      ),
    );
    expect(Object.keys(fields).sort()).toEqual([
      'content',
      'created_at',
      'id',
      'kind',
      'lifeAreaId',
      'processed',
    ]);
    expect(fields['processed']).toBe(false);
    expect(fields).not.toHaveProperty('life_area_id');
    expect(fields).not.toHaveProperty('status');
    expect(Object.values(fields)).not.toContain(null);
    const photo = encodeCapture(
      newCapture(
        {
          content: '',
          kind: 'photo',
          title: undefined,
          lifeAreaId: undefined,
          mediaKey: 'users/u/captures/x.jpg',
          mediaContentType: 'image/jpeg',
        },
        stamp,
        'https://example.com/x.jpg',
      ),
    );
    expect(photo['mediaURL']).toBe('https://example.com/x.jpg');
    expect(photo['mediaContentType']).toBe('image/jpeg');
    expect(photo).not.toHaveProperty('media_url');
  });
});
