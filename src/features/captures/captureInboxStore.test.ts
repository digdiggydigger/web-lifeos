// Ports of CaptureInboxServiceTests, CaptureInboxFilterTests, CaptureInboxTriageServiceTests,
// CaptureInboxTriageActionsTests, CaptureInboxTriageCountsTests, CaptureSortAndUndoTests (service half),
// CaptureInboxSkipTests, CaptureInboxServiceLinkTests, CaptureNotesServiceTests,
// CaptureWeekCounterweightTests and CapturePromotionIndependenceTests.
import { describe, expect, it } from 'vitest';

import type { CaptureUpdate } from '@/data/codec/payloads/captures';
import type { NormalizedCreateCaptureInput } from '@/domain/captures';
import type { NormalizedCreateLogInput } from '@/domain/journal';
import type { Capture, LifeArea, Log, Tag, Task } from '@/domain/types';
import type { RecentAction } from '@/domain/undo/recentAction';
import type { JournalClient } from '@/features/journal/journalClient';
import { createRecentActionStore } from '@/features/undo/recentActionStore';

import type { CaptureClient, PromoteToTaskInput } from './captureClient';
import { createCaptureInboxStore } from './captureInboxStore';

type Result<T> = T | Error;
function resolve<T>(value: Result<T>): Promise<T> {
  return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
}
const fail = (m: string) => new Error(m);

class FakeCaptureClient implements CaptureClient {
  unprocessed: Result<Capture[]> = [];
  processed: Result<Capture[]> = [];
  seen: Result<Capture[]> = [];
  all: Result<Capture[]> = [];
  captureResult: Result<Capture> | undefined;
  createCaptureResult: Error | undefined;
  createTaskResult: Result<Task> = { id: 'T', title: 'x', status: 'open', priority: 'p4' };
  updateCaptureResult: Result<Capture> | undefined;
  markProcessedResult: Error | undefined;
  markUnprocessedResult: Error | undefined;
  softDeleteResult: Error | undefined;
  restoreResult: Error | undefined;
  tagsResult: Result<Tag[]> = [];
  captureTagsResult: Result<Tag[]> = [];
  createTagResult: Result<Tag> = { id: 'NEW', name: 'new' };
  addTagResult: Error | undefined;
  removeTagResult: Error | undefined;
  callLog: string[] = [];
  lastCreateCaptureInput: NormalizedCreateCaptureInput | undefined;
  lastCreateTaskInput: PromoteToTaskInput | undefined;
  lastUpdate: { id: string; changes: CaptureUpdate } | undefined;
  lastMarkProcessedId: string | undefined;
  lastMarkUnprocessedId: string | undefined;
  lastSoftDeleteId: string | undefined;
  lastRestoreId: string | undefined;
  lastAddTag: { captureId: string; tagId: string } | undefined;
  lastRemoveTag: { captureId: string; tagId: string } | undefined;
  lastCreateTagName: string | undefined;
  counts = {
    processed: 0,
    seen: 0,
    createCapture: 0,
    createTask: 0,
    markProcessed: 0,
    addTag: 0,
    removeTag: 0,
    createTag: 0,
    fetchCapture: 0,
  };
  private log<T>(name: string, value: Result<T>): Promise<T> {
    this.callLog.push(name);
    return resolve(value);
  }
  createCapture(input: NormalizedCreateCaptureInput, mediaURL?: string) {
    this.counts.createCapture += 1;
    this.lastCreateCaptureInput = input;
    if (this.createCaptureResult)
      return this.log<Capture>('createCapture', this.createCaptureResult);
    const capture: Capture = {
      id: `C-${this.counts.createCapture}`,
      content: input.content,
      kind: input.kind,
      processed: false,
      createdAt: new Date(),
      ...(mediaURL ? { mediaURL } : {}),
    };
    return this.log('createCapture', capture);
  }
  fetchUnprocessedCaptures() {
    return this.log('fetchUnprocessed', this.unprocessed);
  }
  fetchProcessedCaptures() {
    this.counts.processed += 1;
    return this.log('fetchProcessed', this.processed);
  }
  fetchSeenCaptures() {
    this.counts.seen += 1;
    return this.log('fetchSeen', this.seen);
  }
  fetchCaptures() {
    return this.log('fetchCaptures', this.all);
  }
  fetchCapture(id: string) {
    this.counts.fetchCapture += 1;
    return this.log('fetchCapture', this.captureResult ?? fail(`no ${id}`));
  }
  fetchLifeAreas(): Promise<LifeArea[]> {
    return Promise.resolve([]);
  }
  createTask(input: PromoteToTaskInput) {
    this.counts.createTask += 1;
    this.lastCreateTaskInput = input;
    return this.log('createTask', this.createTaskResult);
  }
  markProcessed(id: string) {
    this.counts.markProcessed += 1;
    this.lastMarkProcessedId = id;
    return this.log('markProcessed', this.markProcessedResult ?? undefined);
  }
  markUnprocessed(id: string) {
    this.lastMarkUnprocessedId = id;
    return this.log('markUnprocessed', this.markUnprocessedResult ?? undefined);
  }
  softDeleteCapture(id: string) {
    this.lastSoftDeleteId = id;
    return this.log('softDelete', this.softDeleteResult ?? undefined);
  }
  restoreCapture(id: string) {
    this.lastRestoreId = id;
    return this.log('restore', this.restoreResult ?? undefined);
  }
  updateCapture(id: string, changes: CaptureUpdate) {
    this.lastUpdate = { id, changes };
    if (this.updateCaptureResult) return this.log('updateCapture', this.updateCaptureResult);
    const current = [
      ...(Array.isArray(this.unprocessed) ? this.unprocessed : []),
      ...(Array.isArray(this.seen) ? this.seen : []),
    ].find((c) => c.id === id);
    return this.log('updateCapture', current ?? fail('missing'));
  }
  fetchAllTags() {
    return this.log('fetchAllTags', this.tagsResult);
  }
  createTag(name: string) {
    this.counts.createTag += 1;
    this.lastCreateTagName = name;
    return this.log('createTag', this.createTagResult);
  }
  fetchTags() {
    return this.log('fetchTags', this.captureTagsResult);
  }
  addTag(captureId: string, tagId: string) {
    this.counts.addTag += 1;
    this.lastAddTag = { captureId, tagId };
    return this.log('addTag', this.addTagResult ?? undefined);
  }
  removeTag(captureId: string, tagId: string) {
    this.counts.removeTag += 1;
    this.lastRemoveTag = { captureId, tagId };
    return this.log('removeTag', this.removeTagResult ?? undefined);
  }
  uploadMedia() {
    return this.log('uploadMedia', {
      mediaKey: 'users/u/captures/x.jpg',
      mediaURL: 'https://cdn/x.jpg',
    });
  }
}

class FakeJournal implements JournalClient {
  createLogResult: Result<Log> | undefined;
  deleteLogResult: Error | undefined;
  lastCreateLogInput: NormalizedCreateLogInput | undefined;
  lastDeleteLogId: string | undefined;
  createLogCalls = 0;
  callLog: string[];
  constructor(callLog: string[] = []) {
    this.callLog = callLog;
  }
  fetchLifeAreas = () => Promise.resolve([]);
  fetchLogs = () => Promise.resolve([]);
  fetchFocusSessions = () => Promise.resolve([]);
  fetchCaptures = () => Promise.resolve([]);
  fetchAllTasks = () => Promise.resolve([]);
  fetchAllTags = () => Promise.resolve([]);
  createTag = (name: string) => Promise.resolve({ id: name, name });
  createLog(input: NormalizedCreateLogInput) {
    this.createLogCalls += 1;
    this.lastCreateLogInput = input;
    this.callLog.push('createLog');
    const now = new Date();
    const fallback: Log = {
      id: 'LOG',
      type: 'journal',
      body: input.body,
      entryDate: now,
      createdAt: now,
    };
    return resolve(this.createLogResult ?? fallback);
  }
  deleteLog(id: string) {
    this.lastDeleteLogId = id;
    this.callLog.push('deleteLog');
    return resolve(this.deleteLogResult ?? undefined);
  }
}

let seq = 0;
function capture(content: string, extra: Partial<Capture> = {}): Capture {
  seq += 1;
  return {
    id: `C${seq}`,
    content,
    kind: 'note',
    processed: false,
    createdAt: new Date(),
    ...extra,
  };
}

async function makeSUT(
  loaded: Capture[],
  extra: {
    seen?: Capture[];
    promoted?: Capture[];
    filters?: ('unprocessed' | 'seen' | 'promoted')[];
  } = {},
) {
  const client = new FakeCaptureClient();
  const journal = new FakeJournal(client.callLog);
  client.unprocessed = loaded;
  client.seen = extra.seen ?? [];
  client.processed = extra.promoted ?? [];
  const centre = createRecentActionStore();
  const store = createCaptureInboxStore(client, {
    journalClient: journal,
    availableFilters: extra.filters ?? ['unprocessed'],
    record: (action: RecentAction) => centre.getState().record(action),
  });
  await store.getState().load();
  return {
    client,
    journal,
    centre,
    store,
    pending: () => centre.getState().current,
    undo: () => centre.getState().undo(),
  };
}

describe('load, refresh, filters', () => {
  it('load succeeds or fails; refresh keeps what is on screen on failure', async () => {
    const { client, store } = await makeSUT([capture('Buy milk')]);
    expect(
      store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Buy milk']);
    client.unprocessed = [...store.getState().captures(), capture('Fresh')];
    await store.getState().refresh();
    expect(store.getState().captures()).toHaveLength(2);
    client.unprocessed = fail('Network error');
    await store.getState().refresh();
    expect(store.getState().captures()).toHaveLength(2);
    const failing = new FakeCaptureClient();
    failing.unprocessed = fail('Network error');
    const s = createCaptureInboxStore(failing);
    await s.getState().load();
    expect(s.getState().state).toEqual({ kind: 'failed', message: 'Network error' });
  });
  it('the default filter is To triage and never fetches the other slices; counts for inactive tabs are learned or left unknown', async () => {
    const { client, store } = await makeSUT([capture('a')]);
    expect(store.getState().filter).toBe('unprocessed');
    expect(client.counts.processed).toBe(0);
    expect(client.counts.seen).toBe(0);
    const env = await makeSUT([capture('Buy milk')], {
      promoted: [capture('x', { processed: true }), capture('y', { processed: true })],
      filters: ['unprocessed', 'seen', 'promoted'],
    });
    expect(env.store.getState().counts).toEqual({ unprocessed: 1, seen: 0, promoted: 2 });
    const down = new FakeCaptureClient();
    down.unprocessed = [capture('Buy milk')];
    down.processed = fail('down');
    const s = createCaptureInboxStore(down, { availableFilters: ['unprocessed', 'promoted'] });
    await s.getState().load();
    expect(s.getState().captures()).toHaveLength(1);
    expect(s.getState().counts.unprocessed).toBe(1);
    expect(s.getState().counts.promoted).toBeUndefined();
  });
  it('select swaps slices, ignores an unoffered filter and a re-select; a failed slice is a failed state', async () => {
    const env = await makeSUT([capture('Buy milk')], {
      promoted: [capture('Already a task', { processed: true })],
      filters: ['unprocessed', 'promoted'],
    });
    await env.store.getState().select('promoted');
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Already a task']);
    const before = env.client.callLog.length;
    await env.store.getState().select('promoted');
    expect(env.client.callLog.length).toBe(before);
    await env.store.getState().select('seen');
    expect(env.store.getState().filter).toBe('promoted');
    await env.store.getState().select('unprocessed');
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Buy milk']);
    env.client.processed = fail('offline');
    await env.store.getState().select('promoted');
    expect(env.store.getState().state).toEqual({ kind: 'failed', message: 'offline' });
  });
  it('displayed captures honour sort, kind refinement and skip ordering; skip survives a refresh', async () => {
    const at = (m: number) => new Date(Date.now() - m * 60_000);
    const older = capture('older note', { createdAt: at(60) });
    const newer = capture('newer link', { kind: 'link', createdAt: at(1) });
    const { client, store } = await makeSUT([older, newer]);
    expect(
      store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['newer link', 'older note']);
    store.getState().setSortNewestFirst(false);
    expect(
      store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['older note', 'newer link']);
    store.getState().setKindFilter('link');
    expect(
      store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['newer link']);
    store.getState().setKindFilter(undefined);
    store.getState().setSortNewestFirst(true);
    store.getState().skip(newer);
    expect(
      store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['older note', 'newer link']);
    client.unprocessed = [older, newer];
    await store.getState().refresh();
    expect(
      store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['older note', 'newer link']);
  });
});

describe('create', () => {
  it('trims, resets, refuses empty without a call, surfaces failure, and normalises links', async () => {
    const { client, store } = await makeSUT([]);
    store.getState().setComposer({ content: '  Buy milk  ', kind: 'task' });
    expect(await store.getState().createCapture()).toBe(true);
    expect(client.lastCreateCaptureInput).toMatchObject({ content: 'Buy milk', kind: 'task' });
    expect(store.getState().composer.content).toBe('');
    expect(store.getState().composer.kind).toBe('note');
    store.getState().setComposer({ content: '   ' });
    expect(await store.getState().createCapture()).toBe(false);
    expect(store.getState().createCaptureErrorMessage).toBe('Capture content is required.');
    expect(client.counts.createCapture).toBe(1);
    store.getState().setComposer({ content: 'example.com/article', kind: 'link' });
    expect(await store.getState().createCapture()).toBe(true);
    expect(client.lastCreateCaptureInput?.content).toBe('https://example.com/article');
    store.getState().setComposer({ content: 'not a url', kind: 'link' });
    expect(await store.getState().createCapture()).toBe(false);
    expect(store.getState().createCaptureErrorMessage).toBe('Enter a valid URL.');
    client.createCaptureResult = fail('Network error');
    store.getState().setComposer({ content: 'Buy milk', kind: 'note' });
    expect(await store.getState().createCapture()).toBe(false);
    expect(store.getState().createCaptureErrorMessage).toBe('Network error');
  });
  it('draft tags attach after create and reset; a failed attach warns; a new draft tag is selected', async () => {
    const { client, store } = await makeSUT([]);
    client.createTagResult = { id: 'D', name: 'deep-work' };
    expect(await store.getState().createTagForDraft('deep-work')).toEqual({
      id: 'D',
      name: 'deep-work',
    });
    expect(store.getState().composer.tagIds).toEqual(['D']);
    store.getState().setComposer({ content: 'Tagged' });
    expect(await store.getState().createCapture()).toBe(true);
    expect(client.lastAddTag).toEqual({ captureId: 'C-1', tagId: 'D' });
    expect(store.getState().composer.tagIds).toEqual([]);
    client.addTagResult = fail('down');
    store.getState().setComposer({ content: 'Tagged again', tagIds: ['D'] });
    expect(await store.getState().createCapture()).toBe(true);
    expect(store.getState().warningMessage).toBe('Saved, but some tags could not be attached.');
  });
  it('a photo uploads first, then creates with the media URL and an optional caption', async () => {
    const { client, store } = await makeSUT([]);
    store.getState().setComposer({ content: '', kind: 'photo' });
    expect(await store.getState().createPhotoCapture(new Blob(['x'], { type: 'image/jpeg' }))).toBe(
      true,
    );
    expect(client.callLog.slice(-2)).toEqual(['uploadMedia', 'createCapture']);
    expect(client.lastCreateCaptureInput).toMatchObject({
      kind: 'photo',
      content: '',
      mediaKey: 'users/u/captures/x.jpg',
      mediaContentType: 'image/jpeg',
    });
  });
});

describe('promote to task', () => {
  it('creates the task from the capture, marks processed, removes it; title rules for photo and link', async () => {
    const c = capture('Buy milk', { notes: 'Ask about the referral' });
    const { client, store } = await makeSUT([c]);
    client.captureResult = c;
    expect(await store.getState().promoteToTask(c, 'W', 'p2', undefined, 900)).toBe(true);
    expect(client.lastCreateTaskInput).toEqual({
      title: 'Buy milk',
      notes: 'Ask about the referral',
      lifeAreaId: 'W',
      priority: 'p2',
      dueDate: undefined,
      focusDurationSeconds: 900,
    });
    expect(client.lastMarkProcessedId).toBe(c.id);
    expect(client.lastUpdate).toBeUndefined();
    expect(store.getState().captures()).toEqual([]);
    expect(store.getState().counts.unprocessed).toBe(0);
    const photo = capture('', { kind: 'photo' });
    const p = await makeSUT([photo]);
    p.client.captureResult = photo;
    await p.store.getState().promoteToTask(photo, undefined, 'p4', undefined);
    expect(p.client.lastCreateTaskInput?.title).toBe('Photo capture');
    expect(p.client.lastCreateTaskInput?.lifeAreaId).toBeUndefined();
    const link = capture('https://example.com/article', {
      kind: 'link',
      linkPreview: { url: 'https://example.com/article', title: 'A Great Article' },
    });
    const l = await makeSUT([link]);
    l.client.captureResult = link;
    await l.store.getState().promoteToTask(link, undefined, 'p4', undefined);
    expect(l.client.lastCreateTaskInput?.title).toBe('A Great Article');
  });
  it('a failed markProcessed keeps the task, warns, and does not create twice; an already-processed server copy refuses', async () => {
    const c = capture('Buy milk');
    const { client, store } = await makeSUT([c]);
    client.captureResult = c;
    client.markProcessedResult = fail('Network error');
    expect(await store.getState().promoteToTask(c, undefined, 'p4', undefined)).toBe(false);
    expect(client.counts.createTask).toBe(1);
    expect(store.getState().warningMessage).toBe(
      "Task created, but couldn't mark the capture as processed.",
    );
    expect(store.getState().errorMessage).toBeUndefined();
    expect(store.getState().createdTask?.id).toBe('T');
    client.markProcessedResult = undefined;
    expect(await store.getState().promoteToTask(c, undefined, 'p4', undefined)).toBe(true);
    expect(client.counts.createTask).toBe(1);
    const done = capture('Done', { processed: true });
    const d = await makeSUT([done]);
    d.client.captureResult = done;
    expect(await d.store.getState().promoteToTask(done, undefined, 'p4', undefined)).toBe(false);
    expect(d.store.getState().errorMessage).toBe('This capture has already been processed.');
    expect(d.client.counts.createTask).toBe(0);
  });
});

describe('sort, skip, discard and their undo', () => {
  it('sort writes the area and the exit stamp together, drops the count, records the capsule, and undo reverses', async () => {
    const noted = capture('Interesting', { lifeAreaId: 'H' });
    const env = await makeSUT([noted, capture('Keep me')], { filters: ['unprocessed', 'seen'] });
    env.client.seen = [noted];
    expect(await env.store.getState().sort(noted, 'W', '💼 Work')).toBe(true);
    expect(env.client.lastUpdate?.changes).toMatchObject({ lifeAreaId: 'W', seen: true });
    expect(env.client.lastUpdate?.changes.clearedAt).toBeInstanceOf(Date);
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Keep me']);
    expect(env.store.getState().counts).toEqual({ unprocessed: 1, seen: 1 });
    expect(env.pending()?.kind).toBe('captureSorted');
    expect(env.pending()?.areaLabel).toBe('💼 Work');
    expect(env.pending()?.subject).toBe('Interesting');
    env.client.unprocessed = [noted, capture('Keep me')];
    env.client.seen = [];
    await env.undo();
    expect(env.client.lastUpdate?.changes).toEqual({
      lifeAreaId: 'H',
      seen: false,
      clearedAt: null,
    });
    expect(env.store.getState().counts).toEqual({ unprocessed: 2, seen: 0 });
    expect(env.store.getState().triageUndoCount).toBe(1);
    expect(env.pending()).toBeUndefined();
  });
  it('undoing a sort of an unfiled capture clears the area; a failed sort keeps the row and offers no undo', async () => {
    const bare = capture('Bare');
    const env = await makeSUT([bare]);
    await env.store.getState().sort(bare, 'W');
    expect(env.pending()?.areaLabel).toBeUndefined();
    await env.undo();
    expect(env.client.lastUpdate?.changes.lifeAreaId).toBeNull();
    const failing = await makeSUT([bare]);
    failing.client.updateCaptureResult = fail('offline');
    expect(await failing.store.getState().sort(bare, 'W')).toBe(false);
    expect(failing.store.getState().captures()).toHaveLength(1);
    expect(failing.store.getState().triageErrorMessage).toBe('offline');
    expect(failing.pending()).toBeUndefined();
  });
  it('skip records an undoable action that puts the capture back', async () => {
    const first = capture('First');
    const env = await makeSUT([first, capture('Second')]);
    env.store.getState().skip(first);
    expect(
      env.store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['Second', 'First']);
    expect(env.pending()?.kind).toBe('captureSkipped');
    expect(env.pending()?.subject).toBe('First');
    await env.undo();
    expect(
      env.store
        .getState()
        .displayedCaptures()
        .map((c) => c.content),
    ).toEqual(['First', 'Second']);
  });
  it('discard soft-deletes (never hard), drops the count, offers undo that restores; failures keep the row or the offer', async () => {
    const doomed = capture('Idle thought');
    const env = await makeSUT([doomed, capture('Keep me')]);
    expect(await env.store.getState().discard(doomed)).toBe(true);
    expect(env.client.lastSoftDeleteId).toBe(doomed.id);
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Keep me']);
    expect(env.store.getState().counts.unprocessed).toBe(1);
    expect(env.pending()?.kind).toBe('captureDeleted');
    env.client.unprocessed = [doomed, capture('Keep me')];
    await env.undo();
    expect(env.client.lastRestoreId).toBe(doomed.id);
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Idle thought', 'Keep me']);
    const failing = await makeSUT([doomed]);
    failing.client.softDeleteResult = fail('offline');
    expect(await failing.store.getState().discard(doomed)).toBe(false);
    expect(failing.store.getState().captures()).toHaveLength(1);
    expect(failing.store.getState().triageErrorMessage).toBe('offline');
    expect(failing.pending()).toBeUndefined();
    const undoFails = await makeSUT([doomed]);
    await undoFails.store.getState().discard(doomed);
    undoFails.client.restoreResult = fail('offline');
    await undoFails.undo();
    expect(undoFails.pending()?.kind).toBe('captureDeleted');
    expect(undoFails.store.getState().triageErrorMessage).toBe('offline');
  });
  it('undoSeen drops the count of the slice it was tapped on', async () => {
    const restored = capture('Sorted too early', { seen: true });
    const client = new FakeCaptureClient();
    client.seen = [restored, capture('Still sorted', { seen: true })];
    const store = createCaptureInboxStore(client, { availableFilters: ['unprocessed', 'seen'] });
    await store.getState().select('seen');
    expect(store.getState().counts.seen).toBe(2);
    expect(await store.getState().undoSeen(restored)).toBe(true);
    expect(client.lastUpdate?.changes).toEqual({ seen: false, clearedAt: null });
    expect(store.getState().counts.seen).toBe(1);
  });
});

describe('journal it', () => {
  it('writes a journal entry with the capture area, marks processed, clears the inbox, relearns the promoted count', async () => {
    const thought = capture('Realised I procrastinate when the first step is vague', {
      lifeAreaId: 'A',
    });
    const env = await makeSUT([thought, capture('Another')], {
      promoted: [capture('Booked it', { processed: true })],
      filters: ['unprocessed', 'promoted'],
    });
    env.client.processed = [capture('Booked it', { processed: true }), thought];
    expect(await env.store.getState().logToJournal(thought)).toBe(true);
    expect(env.journal.lastCreateLogInput).toMatchObject({
      body: thought.content,
      type: 'journal',
      lifeAreaId: 'A',
    });
    expect(env.client.lastMarkProcessedId).toBe(thought.id);
    expect(
      env.store
        .getState()
        .captures()
        .map((c) => c.content),
    ).toEqual(['Another']);
    expect(env.store.getState().counts).toEqual({ unprocessed: 1, promoted: 2 });
    expect(env.pending()?.kind).toBe('captureJournalled');
  });
  it('a failed journal write leaves the capture unprocessed; a blank capture fails validation without a call; a title is kept with the content', async () => {
    const thought = capture('A thought');
    const env = await makeSUT([thought]);
    env.journal.createLogResult = fail('offline');
    expect(await env.store.getState().logToJournal(thought)).toBe(false);
    expect(env.client.counts.markProcessed).toBe(0);
    expect(env.store.getState().captures()).toHaveLength(1);
    expect(env.store.getState().triageErrorMessage).toBe('offline');
    const blank = await makeSUT([capture('   ')]);
    expect(await blank.store.getState().logToJournal(blank.store.getState().captures()[0]!)).toBe(
      false,
    );
    expect(blank.journal.createLogCalls).toBe(0);
    const titled = capture('https://example.com/an-article', {
      kind: 'link',
      title: 'Why vague first steps stall you',
    });
    const t = await makeSUT([titled]);
    await t.store.getState().logToJournal(titled);
    expect(t.journal.lastCreateLogInput?.body).toBe(
      'Why vague first steps stall you\nhttps://example.com/an-article',
    );
    const failedExit = await makeSUT([thought, capture('Keep me')]);
    failedExit.client.markProcessedResult = fail('Network error');
    expect(await failedExit.store.getState().logToJournal(thought)).toBe(false);
    expect(failedExit.store.getState().counts.unprocessed).toBe(2);
  });
  it('undo restores the capture BEFORE deleting the entry it wrote, is spent once used, and reports a leftover entry', async () => {
    const thought = capture('Rain smelled like school');
    const env = await makeSUT([thought]);
    const now = new Date();
    env.journal.createLogResult = {
      id: 'LOG-1',
      type: 'journal',
      body: 'x',
      entryDate: now,
      createdAt: now,
    };
    await env.store.getState().logToJournal(thought);
    env.client.unprocessed = [thought];
    await env.undo();
    expect(env.client.lastMarkUnprocessedId).toBe(thought.id);
    expect(env.journal.lastDeleteLogId).toBe('LOG-1');
    expect(env.client.callLog.indexOf('markUnprocessed')).toBeLessThan(
      env.client.callLog.indexOf('deleteLog'),
    );
    const restores = env.client.callLog.filter((c) => c === 'markUnprocessed').length;
    await env.undo();
    expect(env.pending()).toBeUndefined();
    expect(env.client.callLog.filter((c) => c === 'markUnprocessed')).toHaveLength(restores);

    const cannotRestore = await makeSUT([thought]);
    await cannotRestore.store.getState().logToJournal(thought);
    cannotRestore.client.markUnprocessedResult = fail('offline');
    await cannotRestore.undo();
    expect(cannotRestore.journal.lastDeleteLogId).toBeUndefined();
    expect(cannotRestore.store.getState().triageErrorMessage).toBe('offline');
    expect(cannotRestore.pending()).toBeDefined();

    const entryStays = await makeSUT([thought]);
    await entryStays.store.getState().logToJournal(thought);
    entryStays.journal.deleteLogResult = fail('offline');
    await entryStays.undo();
    expect(entryStays.pending()).toBeUndefined();
    expect(entryStays.store.getState().warningMessage).toBe(
      "Capture is back in your inbox, but its journal entry couldn't be removed.",
    );
  });
});

describe('notes, life area, tags, counterweight', () => {
  it('updateLifeArea sends only the area (explicit null to clear) and replaces the list copy; failure keeps it', async () => {
    const c = capture('Buy milk');
    const { client, store } = await makeSUT([c]);
    client.updateCaptureResult = { ...c, lifeAreaId: 'W' };
    expect(await store.getState().updateLifeArea(c, 'W')).toBe(true);
    expect(client.lastUpdate).toEqual({ id: c.id, changes: { lifeAreaId: 'W' } });
    expect(store.getState().captures()[0]?.lifeAreaId).toBe('W');
    await store.getState().updateLifeArea(c, undefined);
    expect(client.lastUpdate?.changes).toEqual({ lifeAreaId: null });
    client.updateCaptureResult = fail('Network error');
    expect(await store.getState().updateLifeArea(c, 'H')).toBe(false);
    expect(store.getState().triageErrorMessage).toBe('Network error');
    expect(store.getState().captures()).toHaveLength(1);
  });
  it('saveNotes trims, clears with null, replaces the copy, and surfaces failure', async () => {
    const c = capture('Buy milk');
    const { client, store } = await makeSUT([c]);
    client.updateCaptureResult = { ...c, notes: 'Read before Thursday' };
    expect((await store.getState().saveNotes(c, '  Read before Thursday  '))?.notes).toBe(
      'Read before Thursday',
    );
    expect(client.lastUpdate?.changes).toEqual({ notes: 'Read before Thursday' });
    expect(store.getState().captures()[0]?.notes).toBe('Read before Thursday');
    await store.getState().saveNotes(c, '   ');
    expect(client.lastUpdate?.changes).toEqual({ notes: null });
    client.updateCaptureResult = fail('offline');
    expect(await store.getState().saveNotes(c, 'x')).toBeUndefined();
    expect(store.getState().triageErrorMessage).toBe('offline');
  });
  it('tags: fetch degrades to []; add, create-then-add in order, remove; failures surface', async () => {
    const c = capture('Buy milk');
    const { client, store } = await makeSUT([c]);
    client.tagsResult = [{ id: 'U', name: 'urgent' }];
    expect(await store.getState().fetchAllTags()).toEqual([{ id: 'U', name: 'urgent' }]);
    client.tagsResult = fail('down');
    expect(await store.getState().fetchAllTags()).toEqual([]);
    client.captureTagsResult = [{ id: 'F', name: 'focus' }];
    expect(await store.getState().fetchTags(c)).toEqual([{ id: 'F', name: 'focus' }]);
    expect(await store.getState().addExistingTag(c, 'U')).toBe(true);
    expect(client.lastAddTag).toEqual({ captureId: c.id, tagId: 'U' });
    expect(client.counts.createTag).toBe(0);
    client.createTagResult = { id: 'N', name: 'new-tag' };
    client.callLog.length = 0;
    expect(await store.getState().createAndAddTag(c, 'new-tag')).toEqual({
      id: 'N',
      name: 'new-tag',
    });
    expect(client.callLog).toEqual(['createTag', 'addTag']);
    expect(client.lastCreateTagName).toBe('new-tag');
    client.createTagResult = fail('Network error');
    expect(await store.getState().createAndAddTag(c, 'x')).toBeUndefined();
    expect(store.getState().triageErrorMessage).toBe('Network error');
    expect(client.counts.addTag).toBe(2);
    expect(await store.getState().removeTag(c, 'U')).toBe(true);
    expect(client.lastRemoveTag).toEqual({ captureId: c.id, tagId: 'U' });
    client.removeTagResult = fail('Network error');
    expect(await store.getState().removeTag(c, 'U')).toBe(false);
  });
  it('load populates the week counterweight line, and a failed counterweight fetch leaves it undefined', async () => {
    const client = new FakeCaptureClient();
    const waiting = capture('Waiting');
    client.unprocessed = [waiting];
    client.all = [waiting, capture('Cleared', { processed: true, clearedAt: new Date() })];
    const store = createCaptureInboxStore(client, { now: () => new Date() });
    await store.getState().load();
    expect(store.getState().weekCounterweightLine).toBe('2 captured · 1 cleared this week');
    expect(store.getState().weekHealth?.captured).toBe(2);
    client.all = fail('Network error');
    const s2 = createCaptureInboxStore(client);
    await s2.getState().load();
    expect(s2.getState().weekCounterweightLine).toBeUndefined();
    expect(s2.getState().state).toEqual({ kind: 'loaded', captures: [waiting] });
  });
});
