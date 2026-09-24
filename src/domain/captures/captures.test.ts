// Ports of CaptureValidationTests, CaptureSortAndUndoTests (pure half), CaptureSkipOrderingTests,
// CaptureListRefinementTests, CaptureInboxSummaryTests, CaptureInboxHealthTests,
// ComposerDraftFilingTests, CaptureDetailPresentationTests and CaptureRowPresentationTests.
import { describe, expect, it } from 'vitest';

import type { Capture, CaptureKind, LifeArea, Tag } from '@/domain/types';

import {
  applySkipOrdering,
  canReturnToInbox,
  canSort,
  captureCaption,
  captureDetailHeadline,
  captureKindLabel,
  captureNavTitle,
  capturePrimaryText,
  captureSourceDomain,
  captureTimestamp,
  DEFAULT_CAPTURE_KIND,
  detailCanSort,
  doorLine,
  DRAFT_SUBJECT_LIMIT,
  draftSubject,
  inboxBreakdown,
  inboxHeadline,
  normalizeCreateCaptureInput,
  normalizedLinkURLString,
  oldestLine,
  progressFraction,
  refineCaptures,
  shouldFileDraft,
  sittingLine,
  sortedEmphasis,
  sortHint,
  tagsForCapture,
  triageArea,
  triageAreaLabel,
  weekHealth,
  weeklyCounterweight,
} from './index';

let seq = 0;
function capture(content: string, extra: Partial<Capture> = {}): Capture {
  seq += 1;
  return {
    id: `C${seq}`,
    content,
    kind: 'note',
    processed: false,
    createdAt: new Date(2026, 7, 14, 9, 41),
    ...extra,
  };
}
const now = new Date(2026, 7, 14, 9, 41);
const daysAgo = (n: number) => new Date(2026, 7, 14 - n, 9, 41);

describe('CaptureValidation', () => {
  it('trims, refuses empty for every kind but photo, passes each kind through, defaults to note', () => {
    const ok = normalizeCreateCaptureInput({ content: '  Buy milk  ', kind: 'note' });
    expect(ok.kind === 'ok' && [ok.input.content, ok.input.kind]).toEqual(['Buy milk', 'note']);
    expect(normalizeCreateCaptureInput({ content: '   ', kind: 'note' })).toMatchObject({
      kind: 'failed',
      reason: 'emptyContent',
      message: 'Capture content is required.',
    });
    expect(normalizeCreateCaptureInput({ content: '\n\t ', kind: 'task' }).kind).toBe('failed');
    for (const kind of ['note', 'task', 'voice', 'photo'] as CaptureKind[]) {
      const r = normalizeCreateCaptureInput({ content: 'Something', kind });
      expect(r.kind === 'ok' && r.input.kind).toBe(kind);
    }
    expect(normalizeCreateCaptureInput({ content: '', kind: 'photo' }).kind).toBe('ok');
    expect(DEFAULT_CAPTURE_KIND).toBe('note');
    const titled = normalizeCreateCaptureInput({ content: 'x', kind: 'note', title: '  ' });
    expect(titled.kind === 'ok' && titled.input.title).toBeUndefined();
  });
  it('links get https when the scheme is missing, keep http, trim, and refuse junk', () => {
    const link = (content: string) => normalizeCreateCaptureInput({ content, kind: 'link' });
    const a = link('example.com/article');
    expect(a.kind === 'ok' && a.input.content).toBe('https://example.com/article');
    const b = link('http://example.com');
    expect(b.kind === 'ok' && b.input.content).toBe('http://example.com');
    const c = link('  example.com  ');
    expect(c.kind === 'ok' && c.input.content).toBe('https://example.com');
    expect(link('   ')).toMatchObject({ reason: 'invalidURL', message: 'Enter a valid URL.' });
    expect(link('ftp://example.com')).toMatchObject({ reason: 'invalidURL' });
    expect(link('not a url')).toMatchObject({ reason: 'invalidURL' });
    expect(normalizedLinkURLString('https://example.com/path?query=1')).toEqual({
      ok: true,
      url: 'https://example.com/path?query=1',
    });
  });
});

describe('CaptureTriage', () => {
  const work: LifeArea = { id: 'W', name: 'Work', colour: '💼', sortOrder: 0, archived: false };
  const health: LifeArea = { id: 'H', name: 'Health', colour: '🫀', sortOrder: 1, archived: false };
  it('canSort needs an area; a staged pick or clear for this capture wins; other captures are ignored', () => {
    expect(canSort(undefined)).toBe(false);
    expect(canSort('W')).toBe(true);
    const filed = capture('x', { lifeAreaId: 'W' });
    expect(triageArea(undefined, filed)).toBe('W');
    expect(triageArea(undefined, capture('x'))).toBeUndefined();
    expect(triageArea({ captureId: filed.id, lifeAreaId: 'H' }, filed)).toBe('H');
    expect(triageArea({ captureId: filed.id, lifeAreaId: undefined }, filed)).toBeUndefined();
    expect(triageArea({ captureId: 'other', lifeAreaId: 'H' }, filed)).toBe('W');
    expect(sortedEmphasis(undefined)).toBe('waiting');
    expect(sortedEmphasis('W')).toBe('ready');
    expect(triageAreaLabel('W', [work, health])).toBe('💼 Work');
    expect(triageAreaLabel('X', [work])).toBeUndefined();
    expect(triageAreaLabel(undefined, [work])).toBeUndefined();
  });
  it('skip ordering sends skipped to the back in skip order, ignoring stale ids', () => {
    const [a, b, c] = [capture('a'), capture('b'), capture('c')];
    expect(applySkipOrdering([a, b], [])).toEqual([a, b]);
    expect(applySkipOrdering([a, b, c], [a.id])).toEqual([b, c, a]);
    expect(applySkipOrdering([a, b, c], [c.id, a.id])).toEqual([b, c, a]);
    expect(applySkipOrdering([a, b, c], ['stale', a.id])).toEqual([b, c, a]);
    expect(applySkipOrdering([a, b], [a.id, b.id])).toEqual([a, b]);
  });
  it('refinement sorts newest first by default, flips, filters by kind, and composes', () => {
    const at = (m: number) => new Date(now.getTime() - m * 60_000);
    const old = capture('old', { createdAt: at(60) });
    const fresh = capture('new', { createdAt: at(1) });
    expect(refineCaptures([old, fresh], true, undefined).map((c) => c.content)).toEqual([
      'new',
      'old',
    ]);
    expect(refineCaptures([fresh, old], false, undefined).map((c) => c.content)).toEqual([
      'old',
      'new',
    ]);
    const link = capture('a link', { kind: 'link', createdAt: at(2) });
    const photo = capture('a photo', { kind: 'photo', createdAt: at(3) });
    expect(refineCaptures([fresh, link, photo], true, 'link').map((c) => c.content)).toEqual([
      'a link',
    ]);
    const oldNote = capture('old note', { createdAt: at(90) });
    expect(refineCaptures([fresh, oldNote, link], false, 'note').map((c) => c.content)).toEqual([
      'old note',
      'new',
    ]);
  });
});

describe('CaptureInboxSummary', () => {
  const weekCapture = (created: number, cleared?: number) =>
    capture('x', {
      createdAt: daysAgo(created),
      processed: cleared !== undefined,
      ...(cleared !== undefined ? { clearedAt: daysAgo(cleared) } : {}),
    });
  it('headlines, door line, and the empty inbox as a win', () => {
    expect(inboxHeadline(3, 'unprocessed')).toBe('3 to triage');
    expect(inboxHeadline(1, 'unprocessed')).toBe('1 to triage');
    expect(inboxHeadline(0, 'unprocessed')).toBe('Inbox clear');
    expect([3, 1, 0].map((n) => inboxHeadline(n, 'promoted'))).toEqual([
      '3 promoted',
      '1 promoted',
      'Nothing promoted yet',
    ]);
    expect([3, 1, 0].map((n) => inboxHeadline(n, 'seen'))).toEqual([
      '3 sorted',
      '1 sorted',
      'Nothing sorted yet',
    ]);
    expect(doorLine(3)).toBe('3 waiting to triage');
    expect(doorLine(0)).toBe('Inbox clear');
    expect(doorLine(undefined)).toBeUndefined();
  });
  it('the weekly counterweight counts the trailing seven days including today', () => {
    expect(
      weeklyCounterweight(
        [weekCapture(0), weekCapture(6), weekCapture(7), weekCapture(10, 6), weekCapture(10, 7)],
        now,
      ),
    ).toBe('2 captured · 1 cleared this week');
    const unstamped = capture('x', { createdAt: daysAgo(10), processed: true });
    expect(weeklyCounterweight([unstamped, weekCapture(0)], now)).toBe(
      '1 captured · 0 cleared this week',
    );
    expect(weeklyCounterweight([weekCapture(10, 0)], now)).toBe('0 captured · 1 cleared this week');
    expect(weeklyCounterweight([weekCapture(10)], now)).toBeUndefined();
  });
  it('oldest line reads hours then days', () => {
    const aged = (hours: number) =>
      capture('x', { createdAt: new Date(now.getTime() - hours * 3_600_000) });
    expect(oldestLine([aged(18), aged(3)], now)).toBe('oldest is 18 hours old');
    expect(oldestLine([aged(50)], now)).toBe('oldest is 2 days old');
    expect(oldestLine([aged(0.5)], now)).toBe('oldest is under an hour old');
    expect(oldestLine([aged(1)], now)).toBe('oldest is 1 hour old');
    expect(oldestLine([], now)).toBeUndefined();
  });
  it('breakdown names each kind present in a stable order, pluralised, empty when nothing waits', () => {
    const k = (kind: CaptureKind) => capture('s', { kind });
    expect(inboxBreakdown([k('note'), k('note'), k('voice')])).toBe('2 notes · 1 voice memo');
    expect(inboxBreakdown([k('photo')])).toBe('1 photo');
    expect(inboxBreakdown([k('photo'), k('note'), k('link'), k('voice'), k('task')])).toBe(
      '1 note · 1 task · 1 link · 1 voice memo · 1 photo',
    );
    expect(
      inboxBreakdown([
        k('note'),
        k('note'),
        k('task'),
        k('task'),
        k('link'),
        k('link'),
        k('voice'),
        k('voice'),
        k('photo'),
        k('photo'),
      ]),
    ).toBe('2 notes · 2 tasks · 2 links · 2 voice memos · 2 photos');
    expect(inboxBreakdown([])).toBe('');
  });
  it('week health counts captured, cleared and per day; progress and sitting lines', () => {
    const health = weekHealth(
      [
        weekCapture(0),
        weekCapture(1),
        weekCapture(1),
        weekCapture(6),
        weekCapture(30),
        weekCapture(30, 2),
        weekCapture(30, 3),
      ],
      now,
    );
    expect(health).toEqual({ captured: 4, cleared: 2, capturedPerDay: [1, 0, 0, 0, 0, 2, 1] });
    expect(weekHealth([weekCapture(30)], now)).toBeUndefined();
    expect(weekHealth([], now)).toBeUndefined();
    expect(progressFraction(11, 7)).toBeCloseTo(7 / 11, 3);
    expect(progressFraction(3, 5)).toBe(1);
    expect(progressFraction(0, 0)).toBeUndefined();
    expect(sittingLine(1)).toBe('One is still sitting here — decide or bin it.');
    expect(sittingLine(3)).toBe('Three are still sitting here — decide or bin them.');
    expect(sittingLine(12)).toBe('12 are still sitting here — decide or bin them.');
    expect(sittingLine(0)).toBeUndefined();
  });
});

describe('ComposerDraftFiling', () => {
  it('files typed text only, and names the draft by its first line', () => {
    expect(shouldFileDraft('Book the dentist before Friday')).toBe(true);
    expect(shouldFileDraft('')).toBe(false);
    for (const text of [' ', '\n', '\t', '   \n  \t ']) expect(shouldFileDraft(text)).toBe(false);
    expect(draftSubject('Book the dentist\nand the optician')).toBe('Book the dentist');
    expect(draftSubject('\n\n  Ask Sam about the key')).toBe('Ask Sam about the key');
    const long = 'a'.repeat(200);
    expect(Array.from(draftSubject(long))).toHaveLength(DRAFT_SUBJECT_LIMIT);
    expect(draftSubject(long).endsWith('…')).toBe(true);
    const exact = 'b'.repeat(DRAFT_SUBJECT_LIMIT);
    expect(draftSubject(exact)).toBe(exact);
    expect(draftSubject('  Renew the passport   \n')).toBe('Renew the passport');
  });
});

describe('CaptureDetailPresentation', () => {
  it('nav titles, timestamp, return-to-inbox, source domain, sort hint', () => {
    expect(
      (['note', 'task', 'link', 'voice', 'photo'] as CaptureKind[]).map(captureNavTitle),
    ).toEqual(['📝 Note', '✅ Task', '🌐 Link', '🗣️ Voice', '📸 Photo']);
    const rendered = captureTimestamp(new Date(2026, 7, 14, 7, 33), 'en-GB');
    expect(rendered).toContain('14 August 2026');
    expect(rendered).toContain('7:33');
    expect(canReturnToInbox({ seen: true, processed: false })).toBe(true);
    expect(canReturnToInbox({ seen: true, processed: true })).toBe(false);
    expect(canReturnToInbox({ seen: false, processed: false })).toBe(false);
    expect(canReturnToInbox({ processed: false })).toBe(false);
    expect(captureSourceDomain(capture('https://swiftpackageindex.com/x', { kind: 'link' }))).toBe(
      'swiftpackageindex.com',
    );
    expect(captureSourceDomain(capture('https://www.example.com/x', { kind: 'link' }))).toBe(
      'example.com',
    );
    expect(
      captureSourceDomain(
        capture('https://t.co/abc', {
          kind: 'link',
          linkPreview: { url: 'https://example.com/full' },
        }),
      ),
    ).toBe('example.com');
    expect(captureSourceDomain(capture('https://example.com'))).toBeUndefined();
    expect(captureSourceDomain(capture('nothing here', { kind: 'link' }))).toBeUndefined();
    expect(detailCanSort(undefined)).toBe(false);
    expect(detailCanSort('W')).toBe(true);
    expect(sortHint(true)).toBe(
      'Files this capture in the chosen area and clears it from your inbox.',
    );
    expect(sortHint(false)).toBe('Choose a life area above first.');
    expect(captureDetailHeadline(capture('transcript', { kind: 'voice' }))).toBe('Voice note');
    expect(captureDetailHeadline(capture('transcript', { kind: 'voice', title: 'Idea' }))).toBe(
      'Idea',
    );
  });
});

describe('CaptureRowPresentation', () => {
  it('primary text precedence and fallbacks', () => {
    expect(capturePrimaryText(capture('the content body', { title: 'A Real Title' }))).toBe(
      'A Real Title',
    );
    expect(capturePrimaryText(capture('the content body', { title: '   ' }))).toBe(
      'the content body',
    );
    expect(
      capturePrimaryText(
        capture('https://example.com/article', {
          kind: 'link',
          linkPreview: { url: 'x', title: 'Example Article Headline' },
        }),
      ),
    ).toBe('Example Article Headline');
    expect(
      capturePrimaryText(
        capture('https://example.com/article', {
          kind: 'link',
          linkPreview: { url: 'x', title: '  ' },
        }),
      ),
    ).toBe('https://example.com/article');
    expect(
      capturePrimaryText(capture('note body', { linkPreview: { url: 'x', title: 'Ignored' } })),
    ).toBe('note body');
    expect(capturePrimaryText(capture('', { kind: 'photo' }))).toBe('Photo capture');
    expect(capturePrimaryText(capture('   ', { kind: 'photo' }))).toBe('Photo capture');
    expect(capturePrimaryText(capture('', { title: '' }))).toBe('Untitled capture');
    expect(capturePrimaryText(capture('Just the body'))).toBe('Just the body');
    expect(
      (['note', 'task', 'link', 'photo', 'voice'] as CaptureKind[]).map(captureKindLabel),
    ).toEqual(['Note', 'Task', 'Link', 'Photo', 'Voice']);
  });
  it('caption has one separator for every kind; tags resolve in attach order and drop dangling ids', () => {
    for (const kind of ['note', 'task', 'link', 'photo', 'voice'] as CaptureKind[]) {
      expect(captureCaption(capture('x', { kind }), now)).toContain(' · ');
    }
    expect(
      captureCaption(capture('x', { createdAt: new Date(2026, 7, 14, 7, 33) }), now, 'en-GB'),
    ).toMatch(/^Captured 0?7:33 · note$/);
    const a: Tag = { id: 'A', name: 'a' };
    const b: Tag = { id: 'B', name: 'b' };
    expect(tagsForCapture({ tagIds: ['B', 'A'] }, [a, b])).toEqual([b, a]);
    expect(tagsForCapture({ tagIds: ['B', 'X'] }, [b])).toEqual([b]);
    expect(tagsForCapture({}, [a])).toEqual([]);
    expect(tagsForCapture({ tagIds: [] }, [a])).toEqual([]);
  });
});
