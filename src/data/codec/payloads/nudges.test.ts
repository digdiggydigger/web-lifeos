// Ports of the nudge halves of FirestoreFieldPayloadsTests, UndoCapsuleNudgeRestoreTests (payload
// cases) and NudgeCompletionCodingTests.
import { describe, expect, it } from 'vitest';

import { EVERY_DAY } from '@/domain/nudges';

import { newId } from '../ids';

import { isFieldDelete, isServerTimestamp } from '../fields';
import { decodeNudge, encodeNudge } from '../schemas';
import { fromTimestamp } from '../time';
import { newNudge, nudgeFired, nudgeUnfired, nudgeUpdate } from './nudges';

const previous = new Date(1_700_000_000_000);
const now = new Date(1_700_009_999_000);

describe('nudgeUpdate', () => {
  it('writes nothing for an empty payload, otherwise the delta plus a server updated_at', () => {
    expect(nudgeUpdate({})).toEqual({});
    const fields = nudgeUpdate({ label: 'Hydrate' });
    expect(Object.keys(fields).sort()).toEqual(['label', 'updated_at']);
    expect(isServerTimestamp(fields['updated_at'])).toBe(true);
    expect(nudgeUpdate({ active: false })['active']).toBe(false);
    expect(
      nudgeUpdate({ schedule: { hour: 8, minute: 0, weekdays: new Set([4, 2]) } })['schedule'],
    ).toBe('0 8 * * 2,4');
  });
});

describe('nudgeFired / nudgeUnfired', () => {
  it('a firing stamps both fields with the same client instant and the full completion array', () => {
    const fields = nudgeFired(now, [previous, now]);
    expect(Object.keys(fields).sort()).toEqual(['completion_dates', 'last_fired_at', 'updated_at']);
    expect(fromTimestamp(fields['last_fired_at'])).toEqual(now);
    expect(fromTimestamp(fields['updated_at'])).toEqual(now);
    expect((fields['completion_dates'] as unknown[]).map(fromTimestamp)).toEqual([previous, now]);
    expect(fields).not.toHaveProperty('lastFiredAt');
    expect(fields).not.toHaveProperty('completionDates');
  });
  it('an undo restores both stamps in the stored spellings, pinned client-side', () => {
    const fields = nudgeUnfired(previous, [previous], now);
    expect(Object.keys(fields).sort()).toEqual(['completion_dates', 'last_fired_at', 'updated_at']);
    expect(fromTimestamp(fields['last_fired_at'])).toEqual(previous);
    expect(fromTimestamp(fields['updated_at'])).toEqual(now);
    expect((fields['completion_dates'] as unknown[]).map(fromTimestamp)).toEqual([previous]);
    expect(fields).not.toHaveProperty('lastFiredAt');
    expect(isServerTimestamp(fields['updated_at'])).toBe(false);
  });
  it('a nudge that had never fired has its stamp deleted rather than written', () => {
    const fields = nudgeUnfired(undefined, [], now);
    expect(isFieldDelete(fields['last_fired_at'])).toBe(true);
    expect(fields['completion_dates']).toEqual([]);
  });
});

describe('newNudge and the codec', () => {
  it('a new nudge is active, never fired, stamped once; completion_dates round-trips snake_cased and may be absent', () => {
    const id = newId();
    const nudge = newNudge(
      { label: 'Hydrate', schedule: { hour: 9, minute: 0, weekdays: EVERY_DAY } },
      now,
      id,
    );
    expect(nudge).toEqual({
      id,
      label: 'Hydrate',
      schedule: '0 9 * * 0,1,2,3,4,5,6',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const encoded = encodeNudge({ ...nudge, lastFiredAt: now, completionDates: [previous, now] });
    expect(Object.keys(encoded).sort()).toEqual([
      'active',
      'completion_dates',
      'created_at',
      'id',
      'label',
      'last_fired_at',
      'schedule',
      'updated_at',
    ]);
    expect(decodeNudge(encoded).completionDates).toEqual([previous, now]);
    const bare = encodeNudge(nudge);
    expect(bare).not.toHaveProperty('completion_dates');
    expect(bare).not.toHaveProperty('last_fired_at');
    expect(decodeNudge(bare).completionDates).toBeUndefined();
  });
});
