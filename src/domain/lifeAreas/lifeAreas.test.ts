// Ports of AreaPaletteTests, AreasGridTests, AreaDetailPresentationTests, LifeAreaEditorValidationTests,
// LifeAreaEditorPresentationTests, LifeAreaReorderPayloadTests, LifeAreaTaskCountsTests, LifeAreaPickerTests.
import { describe, expect, it } from 'vitest';

import { areaStatusLine } from '@/domain/momentum/momentumScoreboard';
import type { LifeArea, Task } from '@/domain/types';

import { areaDetailFilterTitle, capturesFiledHere, ringLine } from './areaDetailPresentation';
import {
  AREA_FAMILIES,
  familyDisplayName,
  familyFor,
  familyFromKey,
  familyTokens,
} from './areaPalette';
import {
  areasGridMetaLine,
  buildAreasGrid,
  unfiledCount,
  unfiledLine,
  weekShare,
} from './areasGrid';
import {
  completeOrder,
  createConflictMessage,
  findNameClash,
  isPickerRowDisabled,
  LIFE_AREA_EMOJI,
  nextSortOrder,
  normalizeNewName,
  partitionLifeAreas,
  renameChange,
  renameConflictMessage,
  validateEmoji,
} from './lifeAreaEditor';
import { countOpenTasksByLifeArea } from './lifeAreaTaskCounts';

const area = (o: Partial<LifeArea> & { id: string }): LifeArea => ({
  name: 'Area',
  colour: '🦖',
  sortOrder: 0,
  archived: false,
  ...o,
});
const now = new Date(2026, 7, 14, 9, 41);
const work = area({ id: 'W', name: 'Work', colour: '💼', sortOrder: 0 });
const health = area({ id: 'H', name: 'Health', colour: '🫀', sortOrder: 1 });
let n = 0;
const done = (daysAgo: number, lifeAreaId?: string): Task => ({
  id: `D${(n += 1)}`,
  title: 'Done',
  status: 'done',
  priority: 'p3',
  completedAt: new Date(2026, 7, 14 - daysAgo, 9, 41),
  ...(lifeAreaId ? { lifeAreaId } : {}),
});
const open = (lifeAreaId?: string): Task => ({
  id: `O${(n += 1)}`,
  title: 'Open',
  status: 'open',
  priority: 'p3',
  ...(lifeAreaId ? { lifeAreaId } : {}),
});

describe('AreaPalette', () => {
  it('maps the seeded and v3 emoji to their families, ignoring the variation selector', () => {
    const expect_ = (emoji: string, family: string) =>
      expect(familyFor(area({ id: 'X', colour: emoji }))).toBe(family);
    expect_('🫀', 'health');
    expect_('💼', 'work');
    expect_('🏠', 'admin');
    expect_('💰', 'admin');
    expect_('💬', 'hobby');
    expect_('🌱', 'growth');
    expect_('🏋️', 'health');
    expect_('📝', 'admin');
    expect_('🧘', 'growth');
    expect_('🎨', 'hobby');
    expect(familyFor(area({ id: 'X', colour: '🏋️' }))).toBe(
      familyFor(area({ id: 'X', colour: '🏋' })),
    );
  });
  it('falls back to a UUID-stable family from the original five for an unknown emoji', () => {
    expect(familyFor(area({ id: '00000000-0000-0000-0000-000000000000' }))).toBe('work');
    expect(familyFor(area({ id: '03000000-0000-0000-0000-000000000000' }))).toBe('growth');
    for (let i = 0; i < 64; i += 1) {
      const id = crypto.randomUUID().toUpperCase();
      expect(['work', 'health', 'admin', 'growth', 'hobby']).toContain(familyFor(area({ id })));
    }
  });
  it('lets a stored key beat the emoji, and ignores a malformed key', () => {
    expect(familyFor(area({ id: 'X', colour: '💼', palette: 'growth' }))).toBe('growth');
    expect(familyFor(area({ id: 'X', colour: '💼', palette: 'sparkle' }))).toBe('work');
  });
  it('round-trips wire keys, rejects asset names, and names every family', () => {
    for (const f of AREA_FAMILIES) expect(familyFromKey(f)).toBe(f);
    expect(familyFromKey('AreaWork')).toBeUndefined();
    expect(['Blue', 'Teal', 'Gold', 'Purple', 'Pink', 'Green', 'Orange', 'Red', 'Slate']).toEqual(
      AREA_FAMILIES.map(familyDisplayName),
    );
    expect(familyTokens('work')).toEqual({
      base: 'area-work',
      vivid: 'area-work-vivid',
      tint: 'area-work-tint',
      on: 'on-area-work',
    });
  });
});

describe('AreasGrid', () => {
  it('counts tasks, logs and captures per area', () => {
    const items = buildAreasGrid({
      areas: [work, health],
      openTasks: [open('W'), open('W'), open()],
      allTasks: [done(1, 'W'), done(20, 'H')],
      logs: [{ lifeAreaId: 'W' }, {}],
      captures: [{ lifeAreaId: 'H' }, {}],
      now,
    });
    expect(items).toHaveLength(2);
    expect(items[0]?.momentum.closedThisWeek).toBe(1);
    expect(items[0]?.momentum.open).toBe(2);
    expect(items[0]?.logCount).toBe(1);
    expect(items[0]?.captureCount).toBe(0);
    expect(items[1]?.momentum.closedThisWeek).toBe(0);
    expect(items[1]?.captureCount).toBe(1);
    expect(items[1]?.momentum.lastClosedAt).toBeDefined();
  });
  it('meta line omits zeroes and pluralises', () => {
    expect(areasGridMetaLine(3, 1, 0)).toBe('3 tasks · 1 log');
    expect(areasGridMetaLine(1, 0, 2)).toBe('1 task · 2 captures');
    expect(areasGridMetaLine(0, 0, 0)).toBe('Nothing here yet');
  });
  it('counts unfiled captures and words the Unfiled card', () => {
    expect(unfiledCount([{}, { lifeAreaId: 'W' }, {}])).toBe(2);
    expect(unfiledLine(0)).toBe('Everything waiting has an area');
    expect(unfiledLine(1)).toBe('1 capture with no area yet');
    expect(unfiledLine(3)).toBe('3 captures with no area yet');
  });
  it('week share: fractions, caption, quiet areas, hidden when empty', () => {
    const share = weekShare(
      [work, health],
      [done(0, 'W'), done(1, 'W'), done(2, 'H'), done(20, 'H')],
      now,
    )!;
    expect(share.segments.map((s) => s.count)).toEqual([2, 1]);
    expect(share.segments[0]?.fraction).toBeCloseTo(2 / 3, 3);
    expect(share.caption).toBe('3 items closed: 2 Work, 1 Health.');
    expect(weekShare([work, health], [done(0, 'W')], now)?.caption).toBe(
      '1 item closed: 1 Work. Nothing in Health.',
    );
    expect(weekShare([work, health], [], now)).toBeUndefined();
  });
  it('status line tones', () => {
    expect(areaStatusLine(0, 0, undefined, now)).toEqual({
      text: 'Nothing open or closed this week',
      tone: 'plain',
    });
    expect(areaStatusLine(2, 0, now, now)).toEqual({
      text: '2 of 2 closed — all clear',
      tone: 'clear',
    });
    expect(areaStatusLine(1, 2, new Date(2026, 7, 6), now)).toEqual({
      text: '1 of 3 closed — quiet all week',
      tone: 'quiet',
    });
    expect(areaStatusLine(1, 2, new Date(2026, 7, 9), now).text).toMatch(
      /^1 of 3 closed — quiet since /,
    );
    expect(areaStatusLine(1, 2, new Date(2026, 7, 13), now)).toEqual({
      text: '1 of 3 tasks closed',
      tone: 'plain',
    });
  });
});

describe('AreaDetailPresentation', () => {
  it('filter titles carry their counts; ring line states the rate', () => {
    expect(areaDetailFilterTitle('tasks', 3)).toBe('Tasks 3');
    expect(areaDetailFilterTitle('journal', 1)).toBe('Journal 1');
    expect(areaDetailFilterTitle('captures', 0)).toBe('Captures 0');
    expect(areaDetailFilterTitle('all', 9)).toBe('All');
    expect(ringLine(0.67, 'Work & Career')).toBe("67% of this week's Work & Career items closed");
    expect(ringLine(1, 'Health')).toBe("All of this week's Health items closed");
    expect(ringLine(undefined, 'Hobbies')).toBe('Nothing here has moved this week');
  });
  it('shows only captures filed here, never an unfiled one', () => {
    const filed: { id: string; lifeAreaId?: string } = { id: 'F', lifeAreaId: 'A' };
    const elsewhere: { id: string; lifeAreaId?: string } = { id: 'E', lifeAreaId: 'B' };
    const unfiled: { id: string; lifeAreaId?: string } = { id: 'U' };
    expect(capturesFiledHere([filed, elsewhere], 'A')).toEqual([filed]);
    expect(capturesFiledHere([unfiled], 'A')).toEqual([]);
  });
});

describe('LifeAreaEditor validation and presentation', () => {
  it('renameChange trims and compares case-sensitively', () => {
    expect(renameChange('Work', '   ')).toEqual({ kind: 'invalidEmpty' });
    expect(renameChange('Work', ' Work ')).toEqual({ kind: 'unchanged' });
    expect(renameChange('Work', ' Career ')).toEqual({ kind: 'valid', name: 'Career' });
    expect(normalizeNewName('  Garden ')).toBe('Garden');
    expect(normalizeNewName('  ')).toBeUndefined();
  });
  it('validates a single grapheme as the emoji', () => {
    expect(validateEmoji('')).toEqual({ kind: 'invalidEmpty' });
    expect(validateEmoji('ab')).toEqual({ kind: 'invalidNotSingleGlyph' });
    expect(validateEmoji('🏠💼')).toEqual({ kind: 'invalidNotSingleGlyph' });
    expect(validateEmoji(' 🏠 ')).toEqual({ kind: 'valid', emoji: '🏠' });
    expect(validateEmoji('👨‍👩‍👧‍👦')).toEqual({ kind: 'valid', emoji: '👨‍👩‍👧‍👦' });
    expect(validateEmoji('A')).toEqual({ kind: 'valid', emoji: 'A' });
    expect(new Set(LIFE_AREA_EMOJI).size).toBe(LIFE_AREA_EMOJI.length);
    expect(LIFE_AREA_EMOJI.every((e) => validateEmoji(e).kind === 'valid')).toBe(true);
  });
  it('partitions active from archived, both by sort order', () => {
    const areas = [
      area({ id: 'C', sortOrder: 2, archived: true }),
      area({ id: 'B', sortOrder: 1 }),
      area({ id: 'A', sortOrder: 0 }),
      area({ id: 'D', sortOrder: 3, archived: true }),
    ];
    const { active, archived } = partitionLifeAreas(areas);
    expect(active.map((a) => a.id)).toEqual(['A', 'B']);
    expect(archived.map((a) => a.id)).toEqual(['C', 'D']);
    expect(partitionLifeAreas([area({ id: 'A' })]).archived).toEqual([]);
  });
  it('conflict copy mentions unarchive only for an archived holder', () => {
    expect(createConflictMessage('Work', true)).toMatch(/Unarchive/);
    expect(createConflictMessage('Work', false)).not.toMatch(/narchive/);
    expect(renameConflictMessage('Work', true)).toMatch(/archived/);
    expect(renameConflictMessage('Work', true)).not.toMatch(/narchive it/);
    expect(renameConflictMessage('Work', false)).toBe(
      'You already have a life area called “Work”. Choose a different name.',
    );
  });
  it('reorder: active first then archived in relative order, the complete set', () => {
    const a1 = area({ id: 'A1', sortOrder: 0 });
    const a2 = area({ id: 'A2', sortOrder: 1 });
    const z1 = area({ id: 'Z1', sortOrder: 5, archived: true });
    const z2 = area({ id: 'Z2', sortOrder: 3, archived: true });
    expect(completeOrder([a2, a1], [z1, z2])).toEqual(['A2', 'A1', 'Z2', 'Z1']);
  });
  it('name clash is case-insensitive across every area except itself; sort order appends', () => {
    expect(findNameClash([work, health], ' work ')?.id).toBe('W');
    expect(findNameClash([work, health], 'Work', 'W')).toBeUndefined();
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 7 }])).toBe(8);
  });
  it('picker rows: archived disabled unless selected', () => {
    expect(isPickerRowDisabled({ archived: true }, false)).toBe(true);
    expect(isPickerRowDisabled({ archived: true }, true)).toBe(false);
    expect(isPickerRowDisabled({ archived: false }, false)).toBe(false);
  });
});

describe('countOpenTasksByLifeArea', () => {
  it('sorts by sort order, counts only open matching tasks, nil counts nowhere', () => {
    const counts = countOpenTasksByLifeArea(
      [health, work],
      [open('W'), open('W'), done(0, 'W'), open(), open('H')],
    );
    expect(counts.map((c) => [c.lifeArea.id, c.openTaskCount])).toEqual([
      ['W', 2],
      ['H', 1],
    ]);
    expect(countOpenTasksByLifeArea([work], []).map((c) => c.openTaskCount)).toEqual([0]);
  });
});
