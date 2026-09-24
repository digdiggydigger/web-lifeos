import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  clear,
  isFieldDelete,
  isServerTimestamp,
  omitUndefined,
  serverNow,
  setNullable,
} from './fields';
import type { Fields } from './fields';
import { fromTimestamp, toTimestamp } from './time';

describe('field sentinels', () => {
  it('tells the delete sentinel apart from the server timestamp, both being FieldValues', () => {
    expect(isFieldDelete(clear())).toBe(true);
    expect(isServerTimestamp(clear())).toBe(false);
    expect(isServerTimestamp(serverNow())).toBe(true);
    expect(isFieldDelete(serverNow())).toBe(false);
    expect(isFieldDelete(null)).toBe(false);
    expect(isFieldDelete('deleteField')).toBe(false);
  });
});

describe('setNullable (the T?? delta convention)', () => {
  it('writes nothing for an untouched key, a delete for null, and the mapped value otherwise', () => {
    const fields: Fields = {};
    setNullable(fields, 'untouched', undefined);
    setNullable(fields, 'cleared', null);
    setNullable(fields, 'set', 'value');
    setNullable(fields, 'stamped', new Date(1_755_000_000_000), (d) => toTimestamp(d));

    expect(Object.keys(fields).sort()).toEqual(['cleared', 'set', 'stamped']);
    expect(isFieldDelete(fields['cleared'])).toBe(true);
    expect(fields['set']).toBe('value');
    expect(fromTimestamp(fields['stamped'])).toEqual(new Date(1_755_000_000_000));
  });
});

describe('time', () => {
  it('round-trips a Date through a Timestamp and refuses anything else', () => {
    const date = new Date('2025-08-12T12:00:00.000Z');
    expect(fromTimestamp(toTimestamp(date))).toEqual(date);
    expect(toTimestamp(date)).toBeInstanceOf(Timestamp);
    expect(fromTimestamp(date.toISOString())).toBeUndefined();
    expect(fromTimestamp(date.getTime())).toBeUndefined();
    expect(fromTimestamp(undefined)).toBeUndefined();
  });
});

describe('omitUndefined', () => {
  it('drops undefined keys and keeps null, false, 0 and empty strings', () => {
    expect(omitUndefined({ a: undefined, b: null, c: false, d: 0, e: '' })).toEqual({
      b: null,
      c: false,
      d: 0,
      e: '',
    });
  });
});
