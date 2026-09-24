// Port of FirestoreFieldPayloadsSoftDeleteTests (tag half).
import { describe, expect, it } from 'vitest';

import { isFieldDelete } from '../fields';
import { fromTimestamp } from '../time';
import { tagIdsRemove, tagIdsUnion, tagRename, tagRestore, tagSoftDelete } from './tags';

const stamp = new Date(1_755_000_000_000);

describe('tag soft delete', () => {
  it('stamps deleted_at (snake_case, siding with tasks) and ONLY the stamp', () => {
    const fields = tagSoftDelete(stamp);
    expect(Object.keys(fields)).toEqual(['deleted_at']);
    expect(fromTimestamp(fields['deleted_at'])).toEqual(stamp);
    expect(fields).not.toHaveProperty('deletedAt');
  });

  it('restore erases the stamp rather than writing null', () => {
    const fields = tagRestore();
    expect(Object.keys(fields)).toEqual(['deleted_at']);
    expect(isFieldDelete(fields['deleted_at'])).toBe(true);
    expect(fields).not.toHaveProperty('deletedAt');
  });

  it('neither tag payload ever names tag_ids: the links are stripped only by the purge', () => {
    for (const fields of [tagSoftDelete(stamp), tagRestore()]) {
      expect(fields).not.toHaveProperty('tag_ids');
    }
  });

  it('rename writes only the name', () => {
    expect(tagRename('errand')).toEqual({ name: 'errand' });
  });

  it('spells membership as tag_ids on both parents, never tagIds', () => {
    for (const fields of [
      tagIdsUnion('7F3C2A10-1B2C-4D5E-8F90-1234567890AB'),
      tagIdsRemove('7F3C2A10-1B2C-4D5E-8F90-1234567890AB'),
    ]) {
      expect(Object.keys(fields)).toEqual(['tag_ids']);
      expect(fields).not.toHaveProperty('tagIds');
    }
  });
});
