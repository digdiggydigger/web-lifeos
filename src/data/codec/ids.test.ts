import { describe, expect, it } from 'vitest';

import { assertDocumentId, isDocumentId, newId, storageObjectName } from './ids';

describe('document ids', () => {
  it('generates uppercase UUIDs', () => {
    const id = newId();
    expect(isDocumentId(id)).toBe(true);
    expect(id).toBe(id.toUpperCase());
    expect(newId()).not.toBe(id);
  });

  it('rejects lowercase and non-UUID strings, because Firestore queries are exact-match', () => {
    expect(isDocumentId('7f3c2a10-1b2c-4d5e-8f90-1234567890ab')).toBe(false);
    expect(isDocumentId('7F3C2A10-1B2C-4D5E-8F90-1234567890AB')).toBe(true);
    expect(isDocumentId('not-a-uuid')).toBe(false);
    expect(isDocumentId(42)).toBe(false);
    expect(() => assertDocumentId('7f3c2a10-1b2c-4d5e-8f90-1234567890ab', 'life_area_id')).toThrow(
      /life_area_id must be an uppercase UUID/,
    );
  });

  it('names Storage objects with the lowercase id, matching the iOS upload target', () => {
    expect(storageObjectName('7F3C2A10-1B2C-4D5E-8F90-1234567890AB', 'jpg')).toBe(
      '7f3c2a10-1b2c-4d5e-8f90-1234567890ab.jpg',
    );
  });
});
