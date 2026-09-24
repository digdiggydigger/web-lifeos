// Port of JournalServiceTests through the JournalClient seam.
import { describe, expect, it } from 'vitest';

import type { NormalizedCreateLogInput } from '@/domain/journal';
import type { Capture, CompletedFocusSession, LifeArea, Log, Tag, Task } from '@/domain/types';

import type { JournalClient } from './journalClient';
import { createJournalStore } from './journalStore';

class FakeJournalClient implements JournalClient {
  lifeAreas: LifeArea[] | Error = [];
  logs: Log[] | Error = [];
  focusSessions: CompletedFocusSession[] | Error = [];
  captures: Capture[] | Error = [];
  tags: Tag[] | Error = [];
  createLogError: Error | undefined;
  createTagResult: Tag | Error = { id: 'NEW', name: 'new' };
  fetchLifeAreasCalls = 0;
  fetchLogsCalls = 0;
  createLogCalls = 0;
  lastCreateLogInput: NormalizedCreateLogInput | undefined;
  private resolve<T>(value: T | Error): Promise<T> {
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  }
  fetchLifeAreas() {
    this.fetchLifeAreasCalls += 1;
    return this.resolve(this.lifeAreas);
  }
  fetchLogs() {
    this.fetchLogsCalls += 1;
    return this.resolve(this.logs);
  }
  fetchFocusSessions() {
    return this.resolve(this.focusSessions);
  }
  fetchCaptures() {
    return this.resolve(this.captures);
  }
  fetchAllTasks(): Promise<Task[]> {
    return Promise.resolve([]);
  }
  fetchAllTags() {
    return this.resolve(this.tags);
  }
  createTag() {
    return this.resolve(this.createTagResult);
  }
  createLog(input: NormalizedCreateLogInput) {
    this.createLogCalls += 1;
    this.lastCreateLogInput = input;
    if (this.createLogError) return Promise.reject(this.createLogError);
    const now = new Date();
    return Promise.resolve<Log>({
      id: `L${this.createLogCalls}`,
      type: input.type,
      body: input.body,
      entryDate: now,
      createdAt: now,
    });
  }
  deleteLog() {
    return Promise.resolve();
  }
}

function makeLog(body: string, entryDate: Date, lifeAreaId?: string): Log {
  return {
    id: body,
    type: 'log',
    body,
    entryDate,
    createdAt: entryDate,
    ...(lifeAreaId ? { lifeAreaId } : {}),
  };
}

describe('journalStore', () => {
  it('starts loading; loads newest first with one fetch each; empty data is loaded []', async () => {
    const fake = new FakeJournalClient();
    const older = makeLog('Older', new Date(0));
    const newer = makeLog('Newer', new Date(100_000));
    fake.logs = [older, newer];
    const store = createJournalStore(fake);
    expect(store.getState().state).toEqual({ kind: 'loading' });
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'loaded', logs: [newer, older] });
    expect([fake.fetchLifeAreasCalls, fake.fetchLogsCalls]).toEqual([1, 1]);
    const empty = createJournalStore(new FakeJournalClient());
    await empty.getState().load();
    expect(empty.getState().state).toEqual({ kind: 'loaded', logs: [] });
  });

  it('fails when life areas or logs fail; garnish failures leave the streams empty', async () => {
    const areasDown = new FakeJournalClient();
    areasDown.lifeAreas = new Error('Network error');
    const a = createJournalStore(areasDown);
    await a.getState().load();
    expect(a.getState().state).toEqual({ kind: 'failed', message: 'Network error' });

    const logsDown = new FakeJournalClient();
    logsDown.logs = new Error('Network error');
    const b = createJournalStore(logsDown);
    await b.getState().load();
    expect(b.getState().state).toEqual({ kind: 'failed', message: 'Network error' });

    const garnishDown = new FakeJournalClient();
    const entry = makeLog('x', new Date());
    garnishDown.logs = [entry];
    garnishDown.focusSessions = new Error('down');
    garnishDown.captures = new Error('down');
    const c = createJournalStore(garnishDown);
    await c.getState().load();
    expect(c.getState().state).toEqual({ kind: 'loaded', logs: [entry] });
    expect(c.getState().focusSessions).toEqual([]);
    expect(c.getState().captures).toEqual([]);
  });

  it('the life-area filter refilters without refetching, and is inert before the first load', async () => {
    const fake = new FakeJournalClient();
    const work = makeLog('Work log', new Date(), 'W');
    const personal = makeLog('Personal log', new Date(), 'P');
    fake.logs = [work, personal];
    const store = createJournalStore(fake);
    store.getState().setSelectedLifeAreaId('W');
    expect(store.getState().state).toEqual({ kind: 'loading' });
    expect(fake.fetchLogsCalls).toBe(0);
    await store.getState().load();
    expect(store.getState().state).toEqual({ kind: 'loaded', logs: [work] });
    store.getState().setSelectedLifeAreaId('X');
    expect(store.getState().state).toEqual({ kind: 'loaded', logs: [] });
    expect(fake.fetchLogsCalls).toBe(1);
  });

  it('createLog rejects an empty body without a network call', async () => {
    const fake = new FakeJournalClient();
    const store = createJournalStore(fake);
    store.getState().setComposer({ body: '   ' });
    expect(await store.getState().createLog()).toBe(false);
    expect(fake.createLogCalls).toBe(0);
    expect(store.getState().createErrorMessage).toBe('Log body must not be empty.');
  });

  it('createLog appends to the feed, sends the tags, and resets the composer', async () => {
    const fake = new FakeJournalClient();
    const store = createJournalStore(fake);
    await store.getState().load();
    store.getState().setComposer({ body: 'Had a good day', type: 'journal', tagIds: ['A', 'B'] });
    expect(store.getState().isComposerBodyValid()).toBe(true);
    expect(await store.getState().createLog()).toBe(true);
    expect(fake.lastCreateLogInput?.body).toBe('Had a good day');
    expect(fake.lastCreateLogInput?.type).toBe('journal');
    expect(fake.lastCreateLogInput?.tagIds).toEqual(['A', 'B']);
    expect(fake.lastCreateLogInput?.energyLevel).toBe('medium');
    expect(fake.lastCreateLogInput?.moodEmoji).toBe('⚡');
    const s = store.getState();
    expect(s.state.kind === 'loaded' && s.state.logs.map((l) => l.body)).toEqual([
      'Had a good day',
    ]);
    expect(s.composer).toEqual({
      body: '',
      type: 'log',
      lifeAreaId: undefined,
      energyLevel: 'medium',
      moodEmoji: '⚡',
      tagIds: [],
    });
  });

  it('a network failure surfaces the error and keeps the composer', async () => {
    const fake = new FakeJournalClient();
    fake.createLogError = new Error('Network error');
    const store = createJournalStore(fake);
    store.getState().setComposer({ body: 'Had a good day' });
    expect(await store.getState().createLog()).toBe(false);
    expect(store.getState().createErrorMessage).toBe('Network error');
    expect(store.getState().composer.body).toBe('Had a good day');
  });

  it('load populates sprints, captures and tags; a new tag is created, selected and listed', async () => {
    const fake = new FakeJournalClient();
    const sprint: CompletedFocusSession = {
      id: 'S',
      taskTitle: 'Draft',
      lifeAreaEmoji: '💼',
      plannedSeconds: 1500,
      focusedSeconds: 1500,
      checkpointsReached: 2,
      completedNaturally: true,
      startedAt: new Date(0),
      endedAt: new Date(1_500_000),
    };
    const capture: Capture = {
      id: 'C',
      content: 'stray',
      kind: 'note',
      processed: false,
      createdAt: new Date(100),
    };
    const errands: Tag = { id: 'E', name: 'errands' };
    fake.focusSessions = [sprint];
    fake.captures = [capture];
    fake.tags = [errands];
    const store = createJournalStore(fake);
    await store.getState().load();
    expect(store.getState().focusSessions).toEqual([sprint]);
    expect(store.getState().captures).toEqual([capture]);
    expect(store.getState().availableTags).toEqual([errands]);

    fake.createTagResult = { id: 'D', name: 'deep-work' };
    expect(await store.getState().createTagForComposer('deep-work')).toEqual({
      id: 'D',
      name: 'deep-work',
    });
    expect(store.getState().composer.tagIds).toEqual(['D']);
    expect(store.getState().availableTags.map((t) => t.id)).toEqual(['E', 'D']);
    store.getState().toggleComposerTag('D');
    expect(store.getState().composer.tagIds).toEqual([]);

    fake.createTagResult = new Error('down');
    expect(await store.getState().createTagForComposer('x')).toBeUndefined();
    expect(store.getState().createErrorMessage).toBe('down');
  });

  it('a reload over loaded content never flashes loading', async () => {
    const store = createJournalStore(new FakeJournalClient());
    await store.getState().load();
    let sawLoading = false;
    const unsubscribe = store.subscribe((s) => {
      if (s.state.kind === 'loading') sawLoading = true;
    });
    await store.getState().load();
    unsubscribe();
    expect(sawLoading).toBe(false);
  });
});
