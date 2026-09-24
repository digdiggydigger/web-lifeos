/** `JournalService`: the feed, the life-area filter, the composer fields, and the garnish streams. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  DEFAULT_ENERGY_LEVEL,
  DEFAULT_MOOD_EMOJI,
  filterByLifeArea,
  normalizeCreateLogInput,
  sortByEntryDateDescending,
} from '@/domain/journal';
import type {
  Capture,
  CompletedFocusSession,
  EnergyLevel,
  LifeArea,
  Log,
  LogType,
  Tag,
  Task,
} from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { JournalClient } from './journalClient';

export type JournalListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly logs: readonly Log[] }
  | { readonly kind: 'failed'; readonly message: string };

export interface JournalComposer {
  readonly body: string;
  readonly type: LogType;
  readonly lifeAreaId: string | undefined;
  readonly energyLevel: EnergyLevel;
  readonly moodEmoji: string;
  readonly tagIds: readonly string[];
}

const EMPTY_COMPOSER: JournalComposer = {
  body: '',
  type: 'log',
  lifeAreaId: undefined,
  energyLevel: DEFAULT_ENERGY_LEVEL,
  moodEmoji: DEFAULT_MOOD_EMOJI,
  tagIds: [],
};

export interface JournalState {
  readonly state: JournalListState;
  readonly selectedLifeAreaId: string | undefined;
  readonly lifeAreas: readonly LifeArea[];
  readonly tasks: readonly Task[];
  readonly focusSessions: readonly CompletedFocusSession[];
  readonly captures: readonly Capture[];
  readonly availableTags: readonly Tag[];
  readonly composer: JournalComposer;
  readonly isCreating: boolean;
  readonly createErrorMessage: string | undefined;
  readonly load: () => Promise<void>;
  readonly setSelectedLifeAreaId: (id: string | undefined) => void;
  readonly setComposer: (patch: Partial<JournalComposer>) => void;
  readonly toggleComposerTag: (tagId: string) => void;
  readonly isComposerBodyValid: () => boolean;
  readonly createLog: () => Promise<boolean>;
  readonly createTagForComposer: (name: string) => Promise<Tag | undefined>;
  /** The undo path for an entry written a moment ago (capture triage's "Journal it", M1.4). */
  readonly deleteLog: (id: string) => Promise<boolean>;
}

export function createJournalStore(client: JournalClient): StoreApi<JournalState> {
  let logs: Log[] = [];
  let hasLoadedOnce = false;
  return createStore<JournalState>((set, get) => {
    function recompute(): void {
      set({
        state: {
          kind: 'loaded',
          logs: sortByEntryDateDescending(filterByLifeArea(logs, get().selectedLifeAreaId)),
        },
      });
    }
    return {
      state: { kind: 'loading' },
      selectedLifeAreaId: undefined,
      lifeAreas: [],
      tasks: [],
      focusSessions: [],
      captures: [],
      availableTags: [],
      composer: EMPTY_COMPOSER,
      isCreating: false,
      createErrorMessage: undefined,
      load: async () => {
        if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
        try {
          const [lifeAreas, fetchedLogs, focusSessions, captures, tasks, availableTags] =
            await Promise.all([
              client.fetchLifeAreas(),
              client.fetchLogs(),
              client.fetchFocusSessions().catch(() => []),
              client.fetchCaptures().catch(() => []),
              client.fetchAllTasks().catch(() => []),
              client.fetchAllTags().catch(() => []),
            ]);
          logs = fetchedLogs;
          hasLoadedOnce = true;
          set({ lifeAreas, focusSessions, captures, tasks, availableTags });
          recompute();
        } catch (error) {
          hasLoadedOnce = false;
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },
      setSelectedLifeAreaId: (selectedLifeAreaId) => {
        set({ selectedLifeAreaId });
        if (hasLoadedOnce) recompute();
      },
      setComposer: (patch) => set({ composer: { ...get().composer, ...patch } }),
      toggleComposerTag: (tagId) => {
        const { tagIds } = get().composer;
        get().setComposer({
          tagIds: tagIds.includes(tagId) ? tagIds.filter((t) => t !== tagId) : [...tagIds, tagId],
        });
      },
      isComposerBodyValid: () => {
        const c = get().composer;
        return normalizeCreateLogInput({ body: c.body, type: c.type }).kind === 'ok';
      },
      createLog: async () => {
        set({ createErrorMessage: undefined });
        const c = get().composer;
        const validation = normalizeCreateLogInput({
          body: c.body,
          type: c.type,
          lifeAreaId: c.lifeAreaId,
          energyLevel: c.energyLevel,
          moodEmoji: c.moodEmoji,
          tagIds: c.tagIds,
        });
        if (validation.kind !== 'ok') {
          set({ createErrorMessage: validation.message });
          return false;
        }
        set({ isCreating: true });
        try {
          const created = await client.createLog(validation.input);
          logs = [...logs, created];
          recompute();
          set({ composer: EMPTY_COMPOSER });
          return true;
        } catch (error) {
          set({ createErrorMessage: errorText(error) });
          return false;
        } finally {
          set({ isCreating: false });
        }
      },
      createTagForComposer: async (name) => {
        set({ createErrorMessage: undefined });
        try {
          const tag = await client.createTag(name);
          const { composer, availableTags } = get();
          if (!composer.tagIds.includes(tag.id))
            set({ composer: { ...composer, tagIds: [...composer.tagIds, tag.id] } });
          if (!availableTags.some((t) => t.id === tag.id))
            set({ availableTags: [...availableTags, tag] });
          return tag;
        } catch (error) {
          set({ createErrorMessage: errorText(error) });
          return undefined;
        }
      },
      deleteLog: async (id) => {
        try {
          await client.deleteLog(id);
          logs = logs.filter((l) => l.id !== id);
          if (hasLoadedOnce) recompute();
          return true;
        } catch (error) {
          set({ createErrorMessage: errorText(error) });
          return false;
        }
      },
    };
  });
}
