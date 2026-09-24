// Ports of DailySummaryServiceTests, DailySummaryGenerationCoordinatorTests and
// DailySummaryRebuildTests, with the DailySummaryTestDoubles as small fakes below.
import { describe, expect, it } from 'vitest';

import {
  buildDailySummaryRequest,
  type DailySummaryContent,
  type DailySummaryRequest,
  type DailySummarySnapshot,
  type DailySummarySource,
  type DailySummaryTone,
  type GeneratedDailySummary,
} from '@/domain/dailySummary';

import {
  createDailySummaryGenerationCoordinator,
  createDailySummaryStore,
  type DailySummaryGenerator,
  type DailySummaryProvider,
  type DailySummaryStorage,
} from './dailySummaryStore';

const now = new Date(1_787_000_000_000);

function content(headline: string): DailySummaryContent {
  return {
    headline,
    dopamineWins: [],
    journalReflections: 'r',
    focusStaminaInsight: 'f',
    gentleTomorrowKickstart: [],
  };
}

class FakeProvider implements DailySummaryProvider {
  requestedTones: DailySummaryTone[] = [];
  error: Error | undefined;
  loadRequest(tone: DailySummaryTone, date: Date): Promise<DailySummaryRequest> {
    this.requestedTones.push(tone);
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve(
      buildDailySummaryRequest({
        date,
        tone,
        tasks: [],
        focusSessions: [],
        journalEntries: [],
        capturesCount: 0,
        lifeAreaNames: new Map(),
      }),
    );
  }
}

function generator(
  headline: string | Error,
  source: DailySummarySource = 'localSynthesis',
): DailySummaryGenerator & { calls: number } {
  return {
    source,
    calls: 0,
    generate() {
      this.calls += 1;
      return headline instanceof Error
        ? Promise.reject(headline)
        : Promise.resolve(content(headline));
    },
  };
}

function toggleable() {
  const g = {
    source: 'localSynthesis' as const,
    shouldFail: false,
    generate: () =>
      g.shouldFail
        ? Promise.reject(new Error('generator unavailable'))
        : Promise.resolve(content('stub headline')),
  };
  return g;
}

/** A generator that waits for `open()`, so a test can look at the world mid-generation. */
function gated(fail = false) {
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  const g = {
    source: 'localSynthesis' as const,
    calls: 0,
    open: () => release(),
    async generate() {
      g.calls += 1;
      await opened;
      if (fail) throw new Error('generator unavailable');
      return content('gated headline');
    },
  };
  return g;
}

class FakeStorage implements DailySummaryStorage {
  snapshot: DailySummarySnapshot | null = null;
  read() {
    return this.snapshot;
  }
  write(snapshot: DailySummarySnapshot) {
    this.snapshot = snapshot;
  }
}

function makeStore(
  opts: {
    tone?: DailySummaryTone;
    provider?: DailySummaryProvider;
    generator?: DailySummaryGenerator;
    fallback?: DailySummaryGenerator;
    storage?: DailySummaryStorage;
    userId?: string | null;
    coordinator?: ReturnType<typeof createDailySummaryGenerationCoordinator>;
    restoringAsOf?: Date;
  } = {},
) {
  const store = createDailySummaryStore({
    provider: opts.provider ?? new FakeProvider(),
    generator: opts.generator ?? generator('stub headline'),
    ...(opts.fallback ? { fallbackGenerator: opts.fallback } : {}),
    ...(opts.storage ? { storage: opts.storage } : {}),
    userId: opts.userId ?? null,
    coordinator: opts.coordinator ?? createDailySummaryGenerationCoordinator(),
    now: opts.restoringAsOf ?? now,
  });
  if (opts.restoringAsOf === undefined && opts.tone) store.getState().setTone(opts.tone);
  return store;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DailySummaryService', () => {
  it('starts idle with no copy text', () => {
    const store = makeStore();
    expect(store.getState().state).toEqual({ kind: 'idle' });
    expect(store.getState().copyText()).toBeUndefined();
  });

  it('generate produces a loaded summary tagged with source and tone', async () => {
    const store = makeStore({ tone: 'coaching' });
    await store.getState().generate(now);
    const state = store.getState().state;
    expect(state.kind).toBe('loaded');
    if (state.kind !== 'loaded') return;
    expect(state.generated).toEqual<GeneratedDailySummary>({
      content: content('stub headline'),
      tone: 'coaching',
      generatedAt: now,
      source: 'localSynthesis',
    });
  });

  it('asks the provider for the currently selected tone', async () => {
    const provider = new FakeProvider();
    const store = makeStore({ provider });
    store.getState().setTone('bulleted');
    await store.getState().generate(now);
    expect(provider.requestedTones).toEqual(['bulleted']);
  });

  it('a failed generation surfaces the message and keeps no summary', async () => {
    const store = makeStore({ generator: generator(new Error('generator unavailable')) });
    await store.getState().generate(now);
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'generator unavailable' });
    expect(store.getState().copyText()).toBeUndefined();
  });

  it('a failed data load is reported rather than silently empty, and not papered over by the fallback', async () => {
    const provider = new FakeProvider();
    provider.error = new Error("could not read today's tasks");
    const store = makeStore({ provider, fallback: generator('fallback') });
    await store.getState().generate(now);
    expect(store.getState().state).toEqual({
      kind: 'failed',
      message: "could not read today's tasks",
    });
  });

  it('regenerating after a failure recovers', async () => {
    const g = toggleable();
    const store = makeStore({ generator: g });
    g.shouldFail = true;
    await store.getState().generate(now);
    expect(store.getState().state.kind).toBe('failed');
    g.shouldFail = false;
    await store.getState().generate(now);
    expect(store.getState().state.kind).toBe('loaded');
  });

  it('copy text is available only once a summary exists', async () => {
    const store = makeStore();
    expect(store.getState().copyText()).toBeUndefined();
    await store.getState().generate(now);
    expect(store.getState().copyText()).toContain('stub headline');
  });

  it('changing tone keeps the existing summary until regenerated', async () => {
    const store = makeStore();
    await store.getState().generate(now);
    store.getState().setTone('gentle');
    expect(store.getState().state.kind).toBe('loaded');
  });

  it('a model failure degrades to the on-device synthesis, which is remembered', async () => {
    const storage = new FakeStorage();
    const store = makeStore({
      generator: generator(new Error('generator unavailable'), 'model'),
      fallback: generator('stub headline'),
      storage,
      userId: 'uid-1',
    });
    await store.getState().generate(now);
    const state = store.getState().state;
    expect(state.kind === 'loaded' && state.generated.source).toBe('localSynthesis');
    expect(state.kind === 'loaded' && state.generated.content.headline).toBe('stub headline');
    expect(storage.snapshot?.summary?.source).toBe('localSynthesis');
  });

  it('if the fallback also fails, the model’s error is reported', async () => {
    const store = makeStore({
      generator: generator(new Error('generator unavailable'), 'model'),
      fallback: generator(new Error('secondary failure')),
    });
    await store.getState().generate(now);
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'generator unavailable' });
  });

  it('a restored store reloads today’s summary and its tone', async () => {
    const storage = new FakeStorage();
    const first = makeStore({ tone: 'bulleted', storage, userId: 'uid-1' });
    await first.getState().generate(now);
    const second = makeStore({
      storage,
      userId: 'uid-1',
      restoringAsOf: new Date(now.getTime() + 600_000),
    });
    expect(second.getState().tone).toBe('bulleted');
    const state = second.getState().state;
    expect(state.kind === 'loaded' && state.generated.generatedAt).toEqual(now);
    expect(second.getState().hasSummary()).toBe(true);
  });

  it('a summary from an earlier day is not restored, but its tone is', async () => {
    const storage = new FakeStorage();
    const first = makeStore({ tone: 'gentle', storage, userId: 'uid-1' });
    await first.getState().generate(now);
    const second = makeStore({
      storage,
      userId: 'uid-1',
      restoringAsOf: new Date(now.getTime() + 86_400_000),
    });
    expect(second.getState().state).toEqual({ kind: 'idle' });
    expect(second.getState().tone).toBe('gentle');
  });

  it('another account’s summary is not restored', async () => {
    const storage = new FakeStorage();
    const first = makeStore({ tone: 'coaching', storage, userId: 'uid-1' });
    await first.getState().generate(now);
    const second = makeStore({ storage, userId: 'uid-2', restoringAsOf: now });
    expect(second.getState().state).toEqual({ kind: 'idle' });
    expect(second.getState().tone).toBe('energizing');
  });

  it('changing tone is remembered', () => {
    const storage = new FakeStorage();
    const store = makeStore({ storage, userId: 'uid-1' });
    store.getState().setTone('bulleted');
    expect(storage.snapshot?.tone).toBe('bulleted');
  });

  it('a failed generation does not erase the stored summary', async () => {
    const storage = new FakeStorage();
    const g = toggleable();
    const store = makeStore({ generator: g, storage, userId: 'uid-1' });
    await store.getState().generate(now);
    g.shouldFail = true;
    await store.getState().generate(now);
    store.getState().setTone('gentle');
    expect(store.getState().state).toEqual({ kind: 'failed', message: 'generator unavailable' });
    expect(storage.snapshot?.summary?.content.headline).toBe('stub headline');
  });
});

describe('DailySummaryGenerationCoordinator', () => {
  const summary = (headline: string): GeneratedDailySummary => ({
    content: content(headline),
    tone: 'energizing',
    generatedAt: now,
    source: 'localSynthesis',
  });

  it('nothing is generating initially', () => {
    const c = createDailySummaryGenerationCoordinator();
    expect(c.isGenerating('uid')).toBe(false);
    expect(c.inFlight('uid')).toBeUndefined();
  });

  it('a generation is in flight the moment it starts and until it finishes', async () => {
    const c = createDailySummaryGenerationCoordinator();
    const p = c.generation('uid', () => Promise.resolve(summary('done')));
    expect(c.isGenerating('uid')).toBe(true);
    await p;
    expect(c.isGenerating('uid')).toBe(false);
    expect(c.inFlight('uid')).toBeUndefined();
  });

  it('a second request joins the running generation rather than starting another', async () => {
    const c = createDailySummaryGenerationCoordinator();
    let calls = 0;
    const work = async () => {
      calls += 1;
      await flush();
      return summary(calls === 1 ? 'first' : 'second');
    };
    const first = c.generation('uid', work);
    const second = c.generation('uid', work);
    expect((await first).content.headline).toBe('first');
    expect((await second).content.headline).toBe('first');
    expect(calls).toBe(1);
  });

  it('a failed generation reaches every caller and clears the slot', async () => {
    const c = createDailySummaryGenerationCoordinator();
    const work = async () => {
      await flush();
      throw new Error('nope');
    };
    const first = c.generation('uid', work);
    const second = c.generation('uid', work);
    await expect(first).rejects.toThrow('nope');
    await expect(second).rejects.toThrow('nope');
    expect(c.isGenerating('uid')).toBe(false);
  });

  it('a fresh generation can start once the last one finished', async () => {
    const c = createDailySummaryGenerationCoordinator();
    await c.generation('uid', () => Promise.resolve(summary('first')));
    expect(
      (await c.generation('uid', () => Promise.resolve(summary('second')))).content.headline,
    ).toBe('second');
  });

  it('another account’s generation is not visible, and a signed-out scope sees nothing', async () => {
    const c = createDailySummaryGenerationCoordinator();
    const theirs = c.generation('uid-other', async () => {
      await flush();
      return summary('theirs');
    });
    expect(c.isGenerating('uid')).toBe(false);
    expect(c.isGenerating(null)).toBe(false);
    const mine = await c.generation('uid', () => Promise.resolve(summary('mine')));
    expect(mine.content.headline).toBe('mine');
    await theirs;
  });
});

describe('a rebuilt store joins the generation already running', () => {
  it('shows the spinner on its first state, receives the result, and makes no second call', async () => {
    const coordinator = createDailySummaryGenerationCoordinator();
    const g = gated();
    const service = makeStore({ generator: g, userId: 'uid-e', coordinator });
    const generating = service.getState().generate(now);
    await flush();
    expect(service.getState().state).toEqual({ kind: 'loading' });

    const rebuilt = makeStore({ generator: g, userId: 'uid-e', coordinator });
    expect(rebuilt.getState().state).toEqual({ kind: 'loading' });
    expect(rebuilt.getState().isGenerating()).toBe(true);
    const reattaching = rebuilt.getState().reattachIfGenerating();

    g.open();
    await generating;
    await reattaching;
    const state = rebuilt.getState().state;
    expect(state.kind === 'loaded' && state.generated.content.headline).toBe('gated headline');
    expect(g.calls).toBe(1);
  });

  it('sees the failure of the generation it joined', async () => {
    const coordinator = createDailySummaryGenerationCoordinator();
    const g = gated(true);
    const service = makeStore({ generator: g, userId: 'uid-e', coordinator });
    const generating = service.getState().generate(now);
    await flush();
    const rebuilt = makeStore({ generator: g, userId: 'uid-e', coordinator });
    const reattaching = rebuilt.getState().reattachIfGenerating();
    g.open();
    await generating;
    await reattaching;
    expect(service.getState().state).toEqual({ kind: 'failed', message: 'generator unavailable' });
    expect(rebuilt.getState().state.kind).not.toBe('loading');
  });

  it('reattaching with nothing in flight changes nothing, and keeps a restored summary', async () => {
    expect(
      await (async () => {
        const s = makeStore();
        await s.getState().reattachIfGenerating();
        return s.getState().state;
      })(),
    ).toEqual({ kind: 'idle' });
    const storage = new FakeStorage();
    const seeded = makeStore({ storage, userId: 'uid-e' });
    await seeded.getState().generate(now);
    const restored = makeStore({ storage, userId: 'uid-e', restoringAsOf: now });
    await restored.getState().reattachIfGenerating();
    expect(restored.getState().state.kind).toBe('loaded');
  });

  it('ignores another account’s generation', async () => {
    const coordinator = createDailySummaryGenerationCoordinator();
    const g = gated();
    const theirs = makeStore({ generator: g, userId: 'uid-someone-else', coordinator });
    const generating = theirs.getState().generate(now);
    await flush();
    const mine = makeStore({ generator: g, userId: 'uid-e', coordinator });
    expect(mine.getState().state).toEqual({ kind: 'idle' });
    g.open();
    await generating;
  });

  it('the store is written before the generation stops looking in flight', async () => {
    const coordinator = createDailySummaryGenerationCoordinator();
    const storage = new FakeStorage();
    const store = makeStore({ storage, userId: 'uid-e', coordinator });
    const generating = store.getState().generate(now);
    await generating;
    expect(coordinator.isGenerating('uid-e')).toBe(false);
    expect(storage.snapshot?.summary).not.toBeNull();
  });
});
