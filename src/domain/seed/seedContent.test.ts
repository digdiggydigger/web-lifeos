// Pure half of FirebaseManagerSeedTests: the content itself. The write path is tested against
// the emulator in tests/emulator/seed.test.ts.
import { describe, expect, it } from 'vitest';

import { buildSeedContent, SEED_AREAS, SEED_TAGS } from './seedContent';

const now = new Date('2026-09-24T09:00:00Z');
const newId = () => crypto.randomUUID().toUpperCase();
const content = buildSeedContent(now, newId);

describe('buildSeedContent', () => {
  it('writes the six life areas in grid order with the emoji in the colour field', () => {
    expect(content.areas.map((a) => [a.name, a.colour, a.sortOrder])).toEqual([
      ['Health', '🫀', 0],
      ['Work', '💼', 1],
      ['Home', '🏠', 2],
      ['Money', '💰', 3],
      ['Relationships', '💬', 4],
      ['Growth', '🌱', 5],
    ]);
    expect(content.areas.every((a) => !a.archived && a.palette === undefined)).toBe(true);
    expect(SEED_AREAS).toHaveLength(6);
  });

  it('writes the five baseline tags', () => {
    expect(content.tags.map((t) => t.name)).toEqual([
      'urgent',
      'focus',
      'quick-win',
      'waiting-on',
      'someday',
    ]);
    expect(SEED_TAGS).toHaveLength(5);
  });

  it('writes the three starter tasks, all open', () => {
    expect(content.tasks.map((t) => t.title)).toEqual([
      'Check off your first task',
      'Take a 10-minute walk',
      'Capture three things on your mind',
    ]);
    expect(content.tasks.every((t) => t.status === 'open' && t.createdAt === now)).toBe(true);
  });

  it('files the walk under Health and the first task under Growth; the capture task is unfiled', () => {
    const health = content.areas.find((a) => a.name === 'Health')!;
    const growth = content.areas.find((a) => a.name === 'Growth')!;
    const [first, walk, capture] = content.tasks;
    expect(first?.lifeAreaId).toBe(growth.id);
    expect(walk?.lifeAreaId).toBe(health.id);
    expect(capture?.lifeAreaId).toBeUndefined();
  });

  it('pre-tags the first task as quick-win and nothing else', () => {
    const quickWin = content.tags.find((t) => t.name === 'quick-win')!;
    expect(content.tasks[0]?.tagIds).toEqual([quickWin.id]);
    expect(content.tasks[1]?.tagIds).toEqual([]);
    expect(content.tasks[2]?.tagIds).toEqual([]);
  });

  it('gives the walk a tomorrow due date and leaves the others undated', () => {
    expect(content.tasks[1]?.dueDate).toEqual(new Date('2026-09-25T09:00:00Z'));
    expect(content.tasks[0]?.dueDate).toBeUndefined();
    expect(content.tasks[2]?.dueDate).toBeUndefined();
  });

  it('writes one welcome journal entry with no area', () => {
    expect(content.welcome.type).toBe('journal');
    expect(content.welcome.body).toMatch(/append-only on purpose/);
    expect(content.welcome.lifeAreaId).toBeUndefined();
    expect(content.welcome.entryDate).toBe(now);
  });

  it('mints a distinct uppercase id for every document', () => {
    const ids = [
      ...content.areas.map((a) => a.id),
      ...content.tags.map((t) => t.id),
      ...content.tasks.map((t) => t.id),
      content.welcome.id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id === id.toUpperCase())).toBe(true);
  });
});
