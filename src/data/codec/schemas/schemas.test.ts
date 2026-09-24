// Ports of SoftDeleteCodecTests plus the strictness pins the assessment calls for: iOS decodes
// strictly, so the web writes only what iOS can read, and reads what iOS wrote.
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { isLive } from '@/domain/softDelete';
import type { Capture, LifeArea, Log, Tag } from '@/domain/types';

import {
  decodeCapture,
  decodeLifeArea,
  decodeLog,
  decodeProfile,
  decodeTag,
  decodeTask,
  encodeCapture,
  encodeLifeArea,
  encodeLog,
  encodeTag,
  encodeTask,
} from './index';
import type { NewTask } from './index';

const stamp = new Date(1_700_000_000_000);

function without(fields: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...fields };
  delete copy[key];
  return copy;
}
const id = '7F3C2A10-1B2C-4D5E-8F90-1234567890AB';
const otherId = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D';

const task: NewTask = {
  id,
  title: 'Renew the passport',
  status: 'open',
  priority: 'p3',
  createdAt: stamp,
};

describe('tasks: snake_case', () => {
  it('encodes the stamp as deleted_at, never deletedAt, and decodes it back', () => {
    const fields = encodeTask({ ...task, deletedAt: stamp });
    expect(fields).toHaveProperty('deleted_at');
    expect(fields).not.toHaveProperty('deletedAt');
    expect(decodeTask(fields).deletedAt).toEqual(stamp);
  });

  it('omits the key entirely when live: absent, never null', () => {
    const fields = encodeTask(task);
    expect(fields).not.toHaveProperty('deleted_at');
    expect(Object.values(fields)).not.toContain(null);
  });

  it('decodes a document written before the field existed as live', () => {
    const fields = encodeTask(task);
    delete fields['deleted_at'];
    const decoded = decodeTask(fields);
    expect(decoded.deletedAt).toBeUndefined();
    expect(isLive(decoded.deletedAt)).toBe(true);
  });

  it('round-trips every field with the iOS spelling', () => {
    const full: NewTask = {
      ...task,
      lifeAreaId: otherId,
      notes: 'Bring the old one',
      dueDate: stamp,
      focusDurationSeconds: 1500,
      nudgesCount: 2,
      completedAt: stamp,
      atPlaceId: otherId,
      placeId: otherId,
      latitude: 51.5,
      longitude: -0.1,
    };
    const fields = encodeTask(full);
    expect(Object.keys(fields).sort()).toEqual([
      'at_place_id',
      'completed_at',
      'created_at',
      'due_date',
      'focus_duration_seconds',
      'id',
      'latitude',
      'life_area_id',
      'longitude',
      'notes',
      'nudges_count',
      'place_id',
      'priority',
      'status',
      'title',
    ]);
    expect(fields['created_at']).toBeInstanceOf(Timestamp);
    expect(decodeTask(fields)).toEqual(full);
  });

  it('never encodes tag_ids at create: membership is arrayUnion only', () => {
    expect(encodeTask({ ...task, tagIds: [otherId] })).not.toHaveProperty('tag_ids');
    expect(decodeTask({ ...encodeTask(task), tag_ids: [otherId] }).tagIds).toEqual([otherId]);
  });

  it('fails a document iOS would fail: unknown enum, missing title, lowercase id, string date', () => {
    const fields = encodeTask(task);
    expect(() => decodeTask({ ...fields, priority: 'high' })).toThrow();
    expect(() => decodeTask({ ...fields, status: 'todo' })).toThrow();
    expect(() => decodeTask(without(fields, 'title'))).toThrow();
    expect(() => decodeTask({ ...fields, id: id.toLowerCase() })).toThrow();
    expect(() => decodeTask({ ...fields, created_at: stamp.toISOString() })).toThrow();
    expect(() => decodeTask({ ...fields, due_date: stamp.getTime() })).toThrow();
  });

  it('ignores keys it does not know, as Swift Codable does', () => {
    expect(decodeTask({ ...encodeTask(task), future_field: 1 })).toEqual(task);
  });
});

describe('captures: camelCase apart from created_at and tag_ids', () => {
  const capture: Capture = {
    id,
    content: 'Draft from the note composer',
    kind: 'note',
    processed: false,
    createdAt: stamp,
  };

  it('encodes the stamp as deletedAt, never deleted_at', () => {
    const fields = encodeCapture({ ...capture, deletedAt: stamp });
    expect(fields).toHaveProperty('deletedAt');
    expect(fields).not.toHaveProperty('deleted_at');
    expect(decodeCapture(fields).deletedAt).toEqual(stamp);
  });

  it('omits the key entirely when live', () => {
    expect(encodeCapture(capture)).not.toHaveProperty('deletedAt');
  });

  it('spells created_at and tag_ids snake_case and everything else camelCase', () => {
    const fields = encodeCapture({
      ...capture,
      lifeAreaId: otherId,
      clearedAt: stamp,
      mediaURL: 'https://example.com/x.jpg',
      mediaContentType: 'image/jpeg',
      placeId: otherId,
    });
    expect(Object.keys(fields).sort()).toEqual([
      'clearedAt',
      'content',
      'created_at',
      'id',
      'kind',
      'lifeAreaId',
      'mediaContentType',
      'mediaURL',
      'placeId',
      'processed',
    ]);
    expect(fields).not.toHaveProperty('life_area_id');
    expect(fields).not.toHaveProperty('createdAt');
  });

  it('never mints the retired status field and never encodes tag_ids at create', () => {
    const fields = encodeCapture({ ...capture, tagIds: [otherId] });
    expect(fields).not.toHaveProperty('status');
    expect(fields).not.toHaveProperty('tag_ids');
    expect(decodeCapture({ ...fields, tag_ids: [otherId] }).tagIds).toEqual([otherId]);
  });

  it('requires created_at and processed and a known kind', () => {
    const fields = encodeCapture(capture);
    expect(() => decodeCapture(without(fields, 'created_at'))).toThrow();
    expect(() => decodeCapture(without(fields, 'processed'))).toThrow();
    expect(() => decodeCapture({ ...fields, kind: 'audio' })).toThrow();
    // The camelCase spelling of the one snake_case exception is NOT the field: without created_at it fails.
    expect(() =>
      decodeCapture(without({ ...fields, createdAt: fields['created_at'] }, 'created_at')),
    ).toThrow();
  });

  it('reads an absent seen as absent (meaning false) rather than failing', () => {
    expect(decodeCapture(encodeCapture(capture)).seen).toBeUndefined();
    expect(decodeCapture({ ...encodeCapture(capture), seen: true }).seen).toBe(true);
  });
});

describe('tags: snake_case, siding with tasks', () => {
  const tag: Tag = { id, name: 'errand' };

  it('encodes the stamp as deleted_at, never deletedAt', () => {
    const fields = encodeTag({ ...tag, deletedAt: stamp });
    expect(fields).toHaveProperty('deleted_at');
    expect(fields).not.toHaveProperty('deletedAt');
    expect(decodeTag(fields).deletedAt).toEqual(stamp);
  });

  it('omits the key when live and decodes a pre-field document as live', () => {
    const fields = encodeTag(tag);
    expect(fields).toEqual({ id, name: 'errand' });
    expect(isLive(decodeTag(fields).deletedAt)).toBe(true);
  });
});

describe('life areas', () => {
  const area: LifeArea = { id, name: 'Health', colour: '🫀', sortOrder: 0, archived: false };

  it('writes every field on save (iOS setData without merge) and reads archived as false when absent', () => {
    expect(encodeLifeArea(area)).toEqual({
      id,
      name: 'Health',
      colour: '🫀',
      sort_order: 0,
      archived: false,
    });
    expect(decodeLifeArea({ id, name: 'Health', colour: '🫀', sort_order: 0 })).toEqual(area);
  });

  it('carries the palette override when set and leaves it absent for automatic', () => {
    expect(encodeLifeArea({ ...area, palette: 'health' })['palette']).toBe('health');
    expect(encodeLifeArea(area)).not.toHaveProperty('palette');
    expect(decodeLifeArea({ ...encodeLifeArea(area), palette: 'work' }).palette).toBe('work');
  });

  it('requires sort_order: the list query orders by it', () => {
    expect(() => decodeLifeArea({ id, name: 'Health', colour: '🫀' })).toThrow();
  });
});

describe('logs: snake_case, append-only', () => {
  const log: Log = {
    id,
    type: 'journal',
    body: 'Slept well',
    entryDate: stamp,
    createdAt: stamp,
    energyLevel: 'high',
    moodEmoji: '🔥',
    tagIds: [otherId],
    lifeAreaId: otherId,
  };

  it('round-trips with the iOS spelling, tags included at create', () => {
    const fields = encodeLog(log);
    expect(Object.keys(fields).sort()).toEqual([
      'body',
      'created_at',
      'energy_level',
      'entry_date',
      'id',
      'life_area_id',
      'mood_emoji',
      'tag_ids',
      'type',
    ]);
    expect(decodeLog(fields)).toEqual(log);
  });

  it('decodes an unknown energy_level as absent instead of failing the whole document', () => {
    const fields = { ...encodeLog(log), energy_level: 'turbo' };
    expect(decodeLog(fields).energyLevel).toBeUndefined();
  });

  it('fails an unknown type or a missing entry_date', () => {
    expect(() => decodeLog({ ...encodeLog(log), type: 'note' })).toThrow();
    expect(() => decodeLog(without(encodeLog(log), 'entry_date'))).toThrow();
  });
});

describe('profile', () => {
  it('decodes the sign-up and seed markers', () => {
    const profile = decodeProfile({
      email: 'e@example.com',
      created_at: Timestamp.fromDate(stamp),
      display_name: 'E',
      seeded_at: Timestamp.fromDate(stamp),
    });
    expect(profile).toEqual({
      email: 'e@example.com',
      createdAt: stamp,
      displayName: 'E',
      seededAt: stamp,
    });
    expect(decodeProfile({})).toEqual({});
  });
});
