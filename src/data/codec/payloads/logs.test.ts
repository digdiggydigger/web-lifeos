// Ports of LogTagIdsCodingTests and the LogEnergyMoodTests wire-key cases, through `newLog` + `encodeLog`.
import { describe, expect, it } from 'vitest';

import { encodeLog } from '../schemas';
import { newLog } from './logs';

const now = new Date(1_700_000_000_000);
const tagIds = ['7F3C2A10-1B2C-4D5E-8F90-1234567890AB', '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D'];

describe('newLog + encodeLog', () => {
  it('writes snake_case keys, uppercase tag ids, and no camelCase spelling', () => {
    const fields = encodeLog(
      newLog(
        {
          body: 'entry',
          type: 'journal',
          lifeAreaId: tagIds[0],
          energyLevel: 'low',
          moodEmoji: '😴',
          tagIds,
        },
        now,
        'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
      ),
    );
    expect(fields['tag_ids']).toEqual(tagIds);
    expect(fields['energy_level']).toBe('low');
    expect(fields['mood_emoji']).toBe('😴');
    expect(fields['life_area_id']).toBe(tagIds[0]);
    expect(fields).not.toHaveProperty('tagIds');
    expect(fields).not.toHaveProperty('energyLevel');
    expect(fields).not.toHaveProperty('lifeAreaId');
    expect(Object.keys(fields).sort()).toEqual(
      [
        'body',
        'created_at',
        'energy_level',
        'entry_date',
        'id',
        'life_area_id',
        'mood_emoji',
        'tag_ids',
        'type',
      ].sort(),
    );
  });

  it('an untagged, unfiled quick log writes no empty array, no null, and no energy or mood keys', () => {
    const fields = encodeLog(
      newLog(
        {
          body: 'x',
          type: 'log',
          lifeAreaId: undefined,
          energyLevel: undefined,
          moodEmoji: undefined,
          tagIds: [],
        },
        now,
      ),
    );
    expect(Object.keys(fields).sort()).toEqual(['body', 'created_at', 'entry_date', 'id', 'type']);
    expect(Object.values(fields)).not.toContain(null);
  });
});
