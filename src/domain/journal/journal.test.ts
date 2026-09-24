// Ports of LogSortingTests, LogValidationTests, LogEnergyMoodTests, LogComposerCopyTests,
// JournalComposerPaletteTests (the pure cases) and JournalTimelineTests.
import { describe, expect, it } from 'vitest';

import type { Capture, CompletedFocusSession, Log, Tag, Task } from '@/domain/types';

import {
  chipPalette,
  COMPOSER_FOOTER,
  COMPOSER_GUIDANCE,
  composerBackground,
  composerChrome,
  composerChromeInk,
  composerExplainer,
  dayCollapsedLine,
  dayHeaderLine,
  DEFAULT_MOOD_EMOJI,
  ENERGY_LEVELS,
  energyChipLabel,
  energyGlyph,
  energyTitle,
  filterByLifeArea,
  isPaper,
  JOURNAL_MOOD_OPTIONS,
  locationSubtitle,
  normalizeCreateLogInput,
  sortByEntryDateDescending,
  sprintLine,
  tagsForLog,
  timelineDays,
  timelineHeaderLine,
  writingSurface,
} from './index';

const now = new Date(2026, 7, 14, 9, 41);
function at(daysAgo: number, hour: number): Date {
  return new Date(2026, 7, 14 - daysAgo, hour, 0, 0);
}
function log(daysAgo: number, hour: number, areaId?: string, extra: Partial<Log> = {}): Log {
  return {
    id: `L-${daysAgo}-${hour}`,
    type: 'journal',
    body: 'entry',
    entryDate: at(daysAgo, hour),
    createdAt: now,
    ...(areaId ? { lifeAreaId: areaId } : {}),
    ...extra,
  };
}
function doneTask(daysAgo: number, hour: number, areaId?: string): Task {
  return {
    id: `T-${daysAgo}-${hour}`,
    title: 'Done',
    status: 'done',
    priority: 'p3',
    completedAt: at(daysAgo, hour),
    ...(areaId ? { lifeAreaId: areaId } : {}),
  };
}
function sprint(
  daysAgo: number,
  hour: number,
  o: { focused?: number; planned?: number; natural?: boolean } = {},
): CompletedFocusSession {
  const focused = o.focused ?? 1500;
  const ended = at(daysAgo, hour);
  return {
    id: `S-${daysAgo}-${hour}-${focused}`,
    taskTitle: 'Draft the report',
    lifeAreaEmoji: '💼',
    plannedSeconds: o.planned ?? 1500,
    focusedSeconds: focused,
    checkpointsReached: 0,
    completedNaturally: o.natural ?? true,
    startedAt: new Date(ended.getTime() - focused * 1000),
    endedAt: ended,
  };
}
function capture(daysAgo: number, hour: number, areaId?: string): Capture {
  return {
    id: `C-${daysAgo}-${hour}`,
    content: 'a stray thought',
    kind: 'note',
    processed: false,
    createdAt: at(daysAgo, hour),
    ...(areaId ? { lifeAreaId: areaId } : {}),
  };
}
const kinds = (days: ReturnType<typeof timelineDays>) =>
  days.flatMap((d) => d.entries.map((e) => e.kind));

describe('LogSorting', () => {
  it('sorts newest first and filters by area with undefined meaning All', () => {
    const oldest = log(3, 1);
    const middle = log(2, 1);
    const newest = log(1, 1);
    expect(sortByEntryDateDescending([])).toEqual([]);
    expect(sortByEntryDateDescending([middle, oldest, newest])).toEqual([newest, middle, oldest]);
    const work = log(0, 1, 'W');
    const none = log(0, 2);
    expect(filterByLifeArea([work, none], undefined)).toEqual([work, none]);
    expect(filterByLifeArea([work, none], 'W')).toEqual([work]);
    expect(filterByLifeArea([none], 'W')).toEqual([]);
  });
});

describe('LogValidation', () => {
  it('trims, rejects an empty body, passes type, area and tags through', () => {
    const ok = normalizeCreateLogInput({ body: '  Went for a walk  ', type: 'log' });
    expect(ok.kind === 'ok' && ok.input.body).toBe('Went for a walk');
    expect(normalizeCreateLogInput({ body: '   ', type: 'log' })).toEqual({
      kind: 'emptyBody',
      message: 'Log body must not be empty.',
    });
    const r = normalizeCreateLogInput({ body: 'Reflection', type: 'journal', lifeAreaId: 'W' });
    expect(r.kind === 'ok' && [r.input.type, r.input.lifeAreaId, r.input.tagIds]).toEqual([
      'journal',
      'W',
      [],
    ]);
    for (const type of ['log', 'journal'] as const) {
      const t = normalizeCreateLogInput({ body: 'Tagged', type, tagIds: ['A', 'B'] });
      expect(t.kind === 'ok' && t.input.tagIds).toEqual(['A', 'B']);
    }
  });
  it('keeps energy and mood for a journal entry, strips them from a quick log, blank mood is unset', () => {
    const j = normalizeCreateLogInput({
      body: ' Felt sharp ',
      type: 'journal',
      energyLevel: 'high',
      moodEmoji: '🔥',
    });
    expect(j.kind === 'ok' && [j.input.body, j.input.energyLevel, j.input.moodEmoji]).toEqual([
      'Felt sharp',
      'high',
      '🔥',
    ]);
    const l = normalizeCreateLogInput({
      body: 'Ring the dentist',
      type: 'log',
      energyLevel: 'high',
      moodEmoji: '🔥',
    });
    expect(l.kind === 'ok' && [l.input.energyLevel, l.input.moodEmoji]).toEqual([
      undefined,
      undefined,
    ]);
    expect(
      normalizeCreateLogInput({ body: '   ', type: 'journal', energyLevel: 'high' }).kind,
    ).toBe('emptyBody');
    const blank = normalizeCreateLogInput({
      body: 'Something',
      type: 'journal',
      energyLevel: 'medium',
      moodEmoji: '  ',
    });
    expect(blank.kind === 'ok' && blank.input.moodEmoji).toBeUndefined();
    const bare = normalizeCreateLogInput({ body: 'Something', type: 'journal' });
    expect(bare.kind === 'ok' && [bare.input.energyLevel, bare.input.moodEmoji]).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('energy and mood readouts', () => {
  it('raw values, distinct glyphs and titles, chip labels, the eight moods in order', () => {
    expect(ENERGY_LEVELS).toEqual(['low', 'medium', 'high']);
    expect(new Set(ENERGY_LEVELS.map(energyGlyph)).size).toBe(3);
    expect(new Set(ENERGY_LEVELS.map(energyTitle)).size).toBe(3);
    expect(energyChipLabel('low')).toBe('low energy');
    expect(energyChipLabel('high')).toBe('high energy');
    expect(JOURNAL_MOOD_OPTIONS).toEqual(['⚡', '🔥', '🧘', '🔋', '😴', '🧠', '🌊', '🎯']);
    expect(DEFAULT_MOOD_EMOJI).toBe('⚡');
  });
});

describe('LogComposerCopy', () => {
  it('explainers, guidance, footer and the location subtitle', () => {
    expect(composerExplainer('log')).toBe('A quick line, saved as-is — no questions asked.');
    expect(composerExplainer('journal')).toBe('A fuller entry — energy and mood ride along.');
    expect(COMPOSER_GUIDANCE).toBe('One honest line about now is enough.');
    expect(COMPOSER_FOOTER).toBe('Entries are append-only — saved means saved.');
    expect(locationSubtitle(false, undefined)).toBe("This entry won't record where you made it.");
    expect(locationSubtitle(false, 'at The Office 💼')).toBe(
      "This entry won't record where you made it.",
    );
    expect(locationSubtitle(true, undefined)).toBe('This entry will record where you made it.');
    expect(locationSubtitle(true, 'at The Office 💼')).toBe(
      "This entry will record you're at The Office 💼.",
    );
  });
});

describe('JournalComposerPalette', () => {
  it('journal is paper with its own chrome, ink and monochrome chips; log keeps the page', () => {
    expect(isPaper('journal')).toBe(true);
    expect(isPaper('log')).toBe(false);
    expect(composerBackground('log')).toBe('bg-page-background');
    expect(composerBackground('journal')).toBe('bg-journal-paper');
    expect(composerBackground('log')).not.toBe(composerBackground('journal'));
    expect(writingSurface('journal')).toBe('bg-journal-paper-surface');
    expect(writingSurface('log')).toBe('bg-card-surface-secondary');
    expect(composerChrome('journal')).toBe('bg-journal-paper-chrome');
    expect(composerChrome('log')).toBe('bg-page-background');
    expect(composerChromeInk('log')).toBeUndefined();
    expect(composerChromeInk('journal')).toBe('text-journal-paper-chrome-ink');
    const pad = chipPalette('journal');
    expect([pad.quietSurface, pad.quietLabel, pad.selectedFill, pad.selectedLabel]).toEqual([
      'bg-journal-paper-surface',
      'text-journal-paper-ink',
      'bg-journal-paper-ink',
      'text-journal-paper',
    ]);
    const ordinary = chipPalette('log');
    expect([
      ordinary.quietSurface,
      ordinary.quietLabel,
      ordinary.selectedFill,
      ordinary.softInk,
    ]).toEqual(['bg-card-surface-secondary', 'text-label-secondary', 'bg-accent', undefined]);
  });
});

describe('JournalTimeline', () => {
  it('groups by day newest first and orders entries within a day', () => {
    const days = timelineDays({
      logs: [log(0, 4), log(1, 9)],
      tasks: [doneTask(0, 5), doneTask(1, 17)],
      now,
    });
    expect(days.map((d) => d.title)).toEqual(['Today', 'Yesterday']);
    expect(days[0]!.entries.map((e) => e.kind)).toEqual(['closedTask', 'log']);
  });
  it('filters split written from closed; the area filter applies to logs, tasks and captures but not sprints', () => {
    const logs = [log(0, 4)];
    const tasks = [doneTask(0, 5)];
    expect(kinds(timelineDays({ logs, tasks, filter: 'written', now }))).toEqual(['log']);
    expect(kinds(timelineDays({ logs, tasks, filter: 'closed', now }))).toEqual(['closedTask']);
    expect(
      kinds(
        timelineDays({
          logs: [log(0, 4, 'A'), log(0, 6)],
          tasks: [doneTask(0, 5, 'A'), doneTask(0, 7)],
          lifeAreaId: 'A',
          now,
        }),
      ),
    ).toHaveLength(2);
    expect(
      kinds(
        timelineDays({
          logs: [],
          tasks: [],
          sprints: [sprint(0, 6)],
          captures: [capture(0, 5, 'A'), capture(0, 8)],
          lifeAreaId: 'A',
          now,
        }),
      ),
    ).toHaveLength(2);
  });
  it('interleaves all four kinds newest first, hides sub-minute sprints, isolates sprints and captured', () => {
    const logs = [log(0, 4)];
    const tasks = [doneTask(0, 7)];
    const sprints = [sprint(0, 6)];
    const captures = [capture(0, 5)];
    expect(kinds(timelineDays({ logs, tasks, sprints, captures, now }))).toEqual([
      'closedTask',
      'focusSprint',
      'capture',
      'log',
    ]);
    for (const filter of ['everything', 'sprints'] as const) {
      expect(
        kinds(
          timelineDays({
            logs: [],
            tasks: [],
            sprints: [
              sprint(0, 6, { focused: 45, natural: false }),
              sprint(0, 7, { focused: 60, natural: false }),
            ],
            filter,
            now,
          }),
        ),
      ).toHaveLength(1);
    }
    expect(kinds(timelineDays({ logs, tasks, sprints, captures, filter: 'sprints', now }))).toEqual(
      ['focusSprint'],
    );
    expect(
      kinds(timelineDays({ logs, tasks, sprints, captures, filter: 'captured', now })),
    ).toEqual(['capture']);
    expect(kinds(timelineDays({ logs, tasks, sprints, captures, filter: 'written', now }))).toEqual(
      ['log'],
    );
  });
  it('day header names the focus total; collapsed line counts entries', () => {
    const withSprints = timelineDays({
      logs: [log(0, 4)],
      tasks: [],
      sprints: [sprint(0, 6, { focused: 900 }), sprint(0, 7, { focused: 600 })],
      now,
    });
    expect(withSprints[0]!.focusedMinutes).toBe(25);
    expect(dayHeaderLine(withSprints[0]!)).toBe('Today · 25 min focused');
    const bare = timelineDays({ logs: [log(0, 4)], tasks: [], now });
    expect(dayHeaderLine(bare[0]!)).toBe('Today');
    expect(dayCollapsedLine(bare[0]!)).toBe('1 entry');
    expect(
      dayCollapsedLine(timelineDays({ logs: [log(0, 4), log(0, 7)], tasks: [], now })[0]!),
    ).toBe('2 entries');
  });
  it('header line counts the rolling week, sprints included, singular and plural', () => {
    expect(
      timelineHeaderLine({
        logs: [log(2, 9), log(20, 9)],
        tasks: [doneTask(0, 5), doneTask(30, 5)],
        now,
      }),
    ).toBe('1 closed · 1 written this week');
    expect(
      timelineHeaderLine({
        logs: [log(2, 9)],
        tasks: [doneTask(0, 5)],
        sprints: [
          sprint(1, 6),
          sprint(3, 6),
          sprint(20, 6),
          sprint(0, 7, { focused: 30, natural: false }),
        ],
        now,
      }),
    ).toBe('1 closed · 1 written · 2 sprints this week');
    expect(timelineHeaderLine({ logs: [], tasks: [], sprints: [sprint(0, 6)], now })).toBe(
      '0 closed · 0 written · 1 sprint this week',
    );
  });
  it('sprint lines and tag resolution', () => {
    expect(sprintLine(sprint(0, 6))).toBe('25 min sprint');
    expect(sprintLine(sprint(0, 6, { focused: 720, natural: false }))).toBe('12 of 25 min sprint');
    expect(sprintLine(sprint(0, 6, { focused: 45, planned: 45 }))).toBe('1 min sprint');
    const errands: Tag = { id: 'E', name: 'errands' };
    const deep: Tag = { id: 'D', name: 'deep-work' };
    expect(tagsForLog(log(0, 1, undefined, { tagIds: ['D', 'X', 'E'] }), [errands, deep])).toEqual([
      deep,
      errands,
    ]);
    expect(tagsForLog(log(0, 1), [errands])).toEqual([]);
  });
});
