/**
 * `Home/DailySummaryService.swift` + `DailySummaryGenerationCoordinator.swift`: generate a summary
 * for the selected tone, fall back to on-device synthesis when the model fails (never when the
 * DATA failed), remember the tone and today's summary per account, and let a remounted card join a
 * generation already running instead of starting a second model call.
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  DAILY_SUMMARY_SNAPSHOT_VERSION,
  dailySummaryCopyText,
  snapshotBelongsTo,
  snapshotSummaryOn,
  type DailySummaryContent,
  type DailySummaryRequest,
  type DailySummarySnapshot,
  type DailySummarySource,
  type DailySummaryTone,
  type GeneratedDailySummary,
} from '@/domain/dailySummary';

export interface DailySummaryProvider {
  loadRequest(tone: DailySummaryTone, date: Date): Promise<DailySummaryRequest>;
}

export interface DailySummaryGenerator {
  readonly source: DailySummarySource;
  generate(request: DailySummaryRequest): Promise<DailySummaryContent>;
}

export interface DailySummaryStorage {
  read(): DailySummarySnapshot | null;
  write(snapshot: DailySummarySnapshot): void;
}

// MARK: - The coordinator: one in-flight generation per account

export interface DailySummaryGenerationCoordinator {
  isGenerating(userId: string | null): boolean;
  inFlight(userId: string | null): Promise<GeneratedDailySummary> | undefined;
  /** Joins the running generation for `userId`, or starts `work` as the new one. */
  generation(
    userId: string | null,
    work: () => Promise<GeneratedDailySummary>,
  ): Promise<GeneratedDailySummary>;
}

export function createDailySummaryGenerationCoordinator(): DailySummaryGenerationCoordinator {
  let current: { userId: string | null; task: Promise<GeneratedDailySummary> } | undefined;
  const inFlight = (userId: string | null) =>
    current && current.userId === userId ? current.task : undefined;
  return {
    inFlight,
    isGenerating: (userId) => inFlight(userId) !== undefined,
    generation(userId, work) {
      const existing = inFlight(userId);
      if (existing) return existing;
      const task = work().finally(() => {
        if (current?.task === task) current = undefined;
      });
      current = { userId, task };
      return task;
    },
  };
}

/** Shared across remounts, as `DailySummaryGenerationCoordinator.shared`. */
export const sharedDailySummaryCoordinator = createDailySummaryGenerationCoordinator();

// MARK: - The store

export type DailySummaryViewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly generated: GeneratedDailySummary }
  | { readonly kind: 'failed'; readonly message: string };

export interface DailySummaryState {
  readonly state: DailySummaryViewState;
  readonly tone: DailySummaryTone;
  readonly setTone: (tone: DailySummaryTone) => void;
  readonly generate: (now?: Date) => Promise<void>;
  readonly reattachIfGenerating: () => Promise<void>;
  readonly copyText: () => string | undefined;
  readonly isGenerating: () => boolean;
  readonly hasSummary: () => boolean;
}

export interface DailySummaryStoreOptions {
  readonly provider: DailySummaryProvider;
  readonly generator: DailySummaryGenerator;
  readonly fallbackGenerator?: DailySummaryGenerator;
  readonly storage?: DailySummaryStorage;
  readonly userId: string | null;
  readonly coordinator?: DailySummaryGenerationCoordinator;
  /** The instant the store restores against: only a summary from that day comes back. */
  readonly now?: Date;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDailySummaryStore(
  options: DailySummaryStoreOptions,
): StoreApi<DailySummaryState> {
  const { provider, generator, fallbackGenerator, storage, userId } = options;
  const coordinator = options.coordinator ?? sharedDailySummaryCoordinator;
  let storedSummary: GeneratedDailySummary | null = null;

  // `restore(asOf:)`: the spinner is there on the first state when a generation is running.
  let initialState: DailySummaryViewState = coordinator.isGenerating(userId)
    ? { kind: 'loading' }
    : { kind: 'idle' };
  let initialTone: DailySummaryTone = 'energizing';
  const snapshot = storage?.read();
  if (snapshot && snapshotBelongsTo(snapshot, userId)) {
    storedSummary = snapshotSummaryOn(snapshot, options.now ?? new Date());
    if (storedSummary && initialState.kind !== 'loading') {
      initialState = { kind: 'loaded', generated: storedSummary };
    }
    initialTone = snapshot.tone;
  }

  return createStore<DailySummaryState>((set, get) => {
    function persist(): void {
      storage?.write({
        version: DAILY_SUMMARY_SNAPSHOT_VERSION,
        userId,
        tone: get().tone,
        summary: storedSummary,
      });
    }

    /** The model first; on ITS failure the on-device synthesis, and if that fails too, the model's error. */
    async function word(
      request: DailySummaryRequest,
    ): Promise<{ content: DailySummaryContent; source: DailySummarySource }> {
      try {
        return { content: await generator.generate(request), source: generator.source };
      } catch (error) {
        if (!fallbackGenerator) throw error;
        try {
          return {
            content: await fallbackGenerator.generate(request),
            source: fallbackGenerator.source,
          };
        } catch {
          throw error;
        }
      }
    }

    async function apply(generation: Promise<GeneratedDailySummary>): Promise<void> {
      try {
        const generated = await generation;
        storedSummary = generated;
        set({ state: { kind: 'loaded', generated } });
      } catch (error) {
        set({ state: { kind: 'failed', message: errorText(error) } });
      }
    }

    return {
      state: initialState,
      tone: initialTone,
      setTone: (tone) => {
        set({ tone });
        persist();
      },
      generate: async (now = new Date()) => {
        const requestedTone = get().tone;
        set({ state: { kind: 'loading' } });
        const generation = coordinator.generation(userId, async () => {
          const request = await provider.loadRequest(requestedTone, now);
          const worded = await word(request);
          const generated: GeneratedDailySummary = {
            content: worded.content,
            tone: requestedTone,
            generatedAt: now,
            source: worded.source,
          };
          // Remembered before the generation stops looking in flight.
          storedSummary = generated;
          persist();
          return generated;
        });
        await apply(generation);
      },
      reattachIfGenerating: async () => {
        const generation = coordinator.inFlight(userId);
        if (!generation) return;
        set({ state: { kind: 'loading' } });
        await apply(generation);
      },
      copyText: () => {
        const { state } = get();
        return state.kind === 'loaded'
          ? dailySummaryCopyText(state.generated.content, state.generated.generatedAt)
          : undefined;
      },
      isGenerating: () => get().state.kind === 'loading',
      hasSummary: () => get().state.kind === 'loaded',
    };
  });
}
