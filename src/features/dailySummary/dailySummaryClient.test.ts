// Ports of FirebaseDailySummaryDataAdapterTests and the request half of
// FirebaseDailySummaryGeneratorTests (the decode rules are in the domain tests).
import { describe, expect, it } from 'vitest';

import { buildDailySummaryRequest, DailySummaryEndpointError } from '@/domain/dailySummary';
import type { Capture, CompletedFocusSession, LifeArea, Log, Task } from '@/domain/types';

import {
  DAILY_SUMMARY_ENDPOINT,
  dailySummaryProvider,
  endpointDailySummaryGenerator,
  localDailySummaryStorage,
  stubDailySummaryGenerator,
  type DailySummaryBackingStore,
} from './dailySummaryClient';

const now = new Date(1_787_000_000_000);

function area(id: string, name: string, archived = false): LifeArea {
  return { id, name, colour: '🌿', sortOrder: 0, archived };
}

class FakeBacking implements DailySummaryBackingStore {
  tasks: Task[] = [];
  logs: Log[] = [];
  sessions: CompletedFocusSession[] = [];
  captures: Capture[] = [];
  areas: LifeArea[] = [];
  failing: keyof DailySummaryBackingStore | undefined;
  calls: Record<string, number> = {};
  private hit<T>(name: keyof DailySummaryBackingStore, value: T): Promise<T> {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
    return this.failing === name
      ? Promise.reject(new Error(`${name} failed`))
      : Promise.resolve(value);
  }
  fetchTasks() {
    return this.hit('fetchTasks', this.tasks);
  }
  fetchLogs() {
    return this.hit('fetchLogs', this.logs);
  }
  fetchFocusSessions() {
    return this.hit('fetchFocusSessions', this.sessions);
  }
  fetchCaptures() {
    return this.hit('fetchCaptures', this.captures);
  }
  fetchLifeAreas() {
    return this.hit('fetchLifeAreas', this.areas);
  }
}

function capture(processed: boolean): Capture {
  return { id: `C${Math.random()}`, content: 'x', kind: 'note', processed, createdAt: now };
}

describe('the data adapter', () => {
  it('counts only untriaged captures', async () => {
    const backing = new FakeBacking();
    backing.captures = [capture(false), capture(false), capture(true)];
    expect((await dailySummaryProvider(backing).loadRequest('energizing', now)).capturesCount).toBe(
      2,
    );
    backing.captures = [capture(true)];
    expect((await dailySummaryProvider(backing).loadRequest('energizing', now)).capturesCount).toBe(
      0,
    );
    backing.captures = [];
    expect((await dailySummaryProvider(backing).loadRequest('energizing', now)).capturesCount).toBe(
      0,
    );
  });

  it('carries the requested tone and date, and every collection it read, each read once', async () => {
    const backing = new FakeBacking();
    backing.tasks = [
      { id: 'T1', title: 'Draft the brief', status: 'done', priority: 'p2', completedAt: now },
      { id: 'T2', title: 'Still open', status: 'open', priority: 'p3' },
    ];
    backing.logs = [
      {
        id: 'L',
        type: 'journal',
        body: 'Slept badly, still shipped',
        entryDate: now,
        createdAt: now,
      },
    ];
    backing.sessions = [
      {
        id: 'S',
        taskTitle: 's',
        lifeAreaEmoji: '🎯',
        plannedSeconds: 1500,
        focusedSeconds: 1500,
        checkpointsReached: 0,
        completedNaturally: true,
        startedAt: new Date(now.getTime() - 1_500_000),
        endedAt: now,
      },
    ];
    const request = await dailySummaryProvider(backing).loadRequest('coaching', now);
    expect(request.tone).toBe('coaching');
    expect(request.date).toEqual(now);
    expect(request.completedTasks.map((t) => t.title)).toEqual(['Draft the brief']);
    expect(request.inProgressTasks.map((t) => t.title)).toEqual(['Still open']);
    expect(request.journalEntries.map((j) => j.body)).toEqual(['Slept badly, still shipped']);
    expect(request.focusMinutesTotal).toBe(25);
    expect(backing.calls).toEqual({
      fetchTasks: 1,
      fetchLogs: 1,
      fetchFocusSessions: 1,
      fetchCaptures: 1,
      fetchLifeAreas: 1,
    });
  });

  it('resolves area names, archived included; duplicates keep the first; unassigned is General', async () => {
    const backing = new FakeBacking();
    backing.tasks = [
      { id: 'T1', title: 'a', status: 'done', priority: 'p2', completedAt: now, lifeAreaId: 'OLD' },
      { id: 'T2', title: 'b', status: 'done', priority: 'p2', completedAt: now, lifeAreaId: 'DUP' },
      { id: 'T3', title: 'c', status: 'done', priority: 'p2', completedAt: now },
    ];
    backing.areas = [area('OLD', 'Old Job', true), area('DUP', 'First'), area('DUP', 'Second')];
    const request = await dailySummaryProvider(backing).loadRequest('energizing', now);
    expect(
      Object.fromEntries(request.completedTasks.map((t) => [t.title, t.lifeAreaName])),
    ).toEqual({
      a: 'Old Job',
      b: 'First',
      c: 'General',
    });
  });

  it('any failed read fails the whole request', async () => {
    for (const failing of [
      'fetchTasks',
      'fetchLogs',
      'fetchFocusSessions',
      'fetchCaptures',
      'fetchLifeAreas',
    ] as const) {
      const backing = new FakeBacking();
      backing.failing = failing;
      await expect(dailySummaryProvider(backing).loadRequest('energizing', now)).rejects.toThrow(
        `${failing} failed`,
      );
    }
  });
});

describe('the endpoint generator', () => {
  const request = buildDailySummaryRequest({
    date: now,
    tone: 'gentle',
    tasks: [],
    focusSessions: [],
    journalEntries: [],
    capturesCount: 0,
    lifeAreaNames: new Map(),
  });

  it('posts the camelCase body with the ID token to the same-origin endpoint', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetch = ((url: string, init: RequestInit) => {
      seen.push({ url, init });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            summary: {
              headline: 'h',
              dopamineWins: [],
              journalReflections: 'r',
              focusStaminaInsight: 'f',
              gentleTomorrowKickstart: [],
            },
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof globalThis.fetch;
    const generator = endpointDailySummaryGenerator({
      idToken: () => Promise.resolve('TOKEN'),
      fetch,
    });
    expect(generator.source).toBe('model');
    expect((await generator.generate(request)).headline).toBe('h');
    expect(seen[0]?.url).toBe(DAILY_SUMMARY_ENDPOINT);
    expect(DAILY_SUMMARY_ENDPOINT).toBe('/api/daily-summary');
    expect(seen[0]?.init.method).toBe('POST');
    expect(seen[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TOKEN',
    });
    const body = JSON.parse(seen[0]?.init.body as string) as Record<string, unknown>;
    expect(body['tone']).toBe('gentle');
    expect(body['date']).toBe(now.toISOString());
  });

  it('signed out fails with a clear message and sends nothing', async () => {
    let sent = 0;
    const fetch = (() => {
      sent += 1;
      return Promise.reject(new Error('should not send'));
    }) as unknown as typeof globalThis.fetch;
    const generator = endpointDailySummaryGenerator({
      idToken: () => Promise.resolve(undefined),
      fetch,
    });
    await expect(generator.generate(request)).rejects.toEqual(
      new DailySummaryEndpointError('notSignedIn'),
    );
    expect(sent).toBe(0);
  });

  it('a 401 is the session-expired error', async () => {
    const fetch = (() =>
      Promise.resolve(
        new Response('{"error":"unauthorized"}', { status: 401 }),
      )) as unknown as typeof globalThis.fetch;
    const generator = endpointDailySummaryGenerator({ idToken: () => Promise.resolve('T'), fetch });
    await expect(generator.generate(request)).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('the stub generator is on-device synthesis', async () => {
    expect(stubDailySummaryGenerator.source).toBe('localSynthesis');
    expect((await stubDailySummaryGenerator.generate(request)).headline).toBe(
      'A quiet day so far, and that is allowed.',
    );
  });
});

describe('the local snapshot store', () => {
  it('round-trips, reads nothing before a write, and swallows a throwing storage', () => {
    const map = new Map<string, string>();
    const storage = localDailySummaryStorage({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    expect(storage.read()).toBeNull();
    const snapshot = { version: 1, userId: 'u', tone: 'gentle' as const, summary: null };
    storage.write(snapshot);
    expect(storage.read()).toEqual(snapshot);
    const throwing = localDailySummaryStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => throwing.write(snapshot)).not.toThrow();
    expect(throwing.read()).toBeNull();
    expect(localDailySummaryStorage(undefined).read()).toBeNull();
  });
});
