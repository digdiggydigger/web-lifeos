/**
 * `CaptureInboxService` (+Create, +Notes, +Tags, +Triage, +Media, +Counterweight): the inbox slices,
 * the triage verbs with their undo, the quick-capture composer, and the week counterweight.
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  applySkipOrdering,
  captureDetailHeadline,
  DEFAULT_CAPTURE_KIND,
  normalizeCreateCaptureInput,
  refineCaptures,
  weekHealth,
  weeklyCounterweight,
} from '@/domain/captures';
import type { InboxFilter, WeekHealth } from '@/domain/captures';
import { normalizeCreateLogInput } from '@/domain/journal';
import type { Capture, CaptureKind, EnergyLevel, Tag, Task, TaskPriority } from '@/domain/types';
import type { RecentAction } from '@/domain/undo/recentAction';
import type { JournalClient } from '@/features/journal/journalClient';
import { errorText } from '@/features/tasks/tasksClient';

import type { CaptureClient } from './captureClient';
import { ALREADY_PROCESSED_ERROR } from './captureClient';

export type InboxListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly captures: readonly Capture[] }
  | { readonly kind: 'failed'; readonly message: string };

export interface CaptureComposer {
  readonly content: string;
  readonly kind: CaptureKind;
  readonly lifeAreaId: string | undefined;
  readonly tagIds: readonly string[];
}

const EMPTY_COMPOSER: CaptureComposer = {
  content: '',
  kind: DEFAULT_CAPTURE_KIND,
  lifeAreaId: undefined,
  tagIds: [],
};

export const TAGS_NOT_ATTACHED_WARNING = 'Saved, but some tags could not be attached.';
export const CAPTURE_NOT_PROCESSED_WARNING =
  "Task created, but couldn't mark the capture as processed.";
export const JOURNAL_ENTRY_LEFT_WARNING =
  "Capture is back in your inbox, but its journal entry couldn't be removed.";
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

type TriageAction =
  | {
      readonly kind: 'sorted';
      readonly captureId: string;
      readonly previousLifeAreaId: string | undefined;
    }
  | { readonly kind: 'skipped'; readonly captureId: string }
  | { readonly kind: 'journaled'; readonly captureId: string; readonly logId: string }
  | { readonly kind: 'deleted'; readonly captureId: string };

export interface CaptureInboxState {
  readonly state: InboxListState;
  readonly filter: InboxFilter;
  readonly availableFilters: readonly InboxFilter[];
  readonly counts: Readonly<Partial<Record<InboxFilter, number>>>;
  readonly skippedIds: readonly string[];
  readonly sortNewestFirst: boolean;
  readonly kindFilter: CaptureKind | undefined;
  readonly composer: CaptureComposer;
  readonly isSubmittingCapture: boolean;
  readonly createCaptureErrorMessage: string | undefined;
  readonly createdTask: Task | undefined;
  readonly warningMessage: string | undefined;
  readonly errorMessage: string | undefined;
  readonly triageErrorMessage: string | undefined;
  readonly weekCounterweightLine: string | undefined;
  readonly weekHealth: WeekHealth | undefined;
  /** How many undos have landed; the screen clears its staged pick when it moves. */
  readonly triageUndoCount: number;

  readonly captures: () => readonly Capture[];
  readonly displayedCaptures: () => Capture[];
  readonly load: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly select: (filter: InboxFilter) => Promise<void>;
  readonly setSortNewestFirst: (newestFirst: boolean) => void;
  readonly setKindFilter: (kind: CaptureKind | undefined) => void;
  readonly setComposer: (patch: Partial<CaptureComposer>) => void;
  readonly toggleComposerTag: (tagId: string) => void;
  readonly isContentValid: () => boolean;
  readonly createCapture: () => Promise<boolean>;
  readonly createPhotoCapture: (image: Blob) => Promise<boolean>;
  readonly createTagForDraft: (name: string) => Promise<Tag | undefined>;
  readonly promoteToTask: (
    capture: Capture,
    lifeAreaId: string | undefined,
    priority: TaskPriority,
    dueDate: Date | undefined,
    focusDurationSeconds?: number,
  ) => Promise<boolean>;
  readonly sort: (capture: Capture, into: string, areaLabel?: string) => Promise<boolean>;
  readonly skip: (capture: Capture) => void;
  readonly discard: (capture: Capture) => Promise<boolean>;
  readonly undoSeen: (capture: Capture) => Promise<boolean>;
  readonly logToJournal: (
    capture: Capture,
    energyLevel?: EnergyLevel,
    moodEmoji?: string,
  ) => Promise<boolean>;
  readonly updateLifeArea: (capture: Capture, lifeAreaId: string | undefined) => Promise<boolean>;
  readonly saveNotes: (capture: Capture, notes: string) => Promise<Capture | undefined>;
  readonly fetchCaptureDetail: (id: string) => Promise<Capture>;
  readonly fetchAllTags: () => Promise<Tag[]>;
  readonly fetchTags: (capture: Capture) => Promise<Tag[]>;
  readonly addExistingTag: (capture: Capture, tagId: string) => Promise<boolean>;
  readonly createAndAddTag: (capture: Capture, name: string) => Promise<Tag | undefined>;
  readonly removeTag: (capture: Capture, tagId: string) => Promise<boolean>;
  readonly clearWarning: () => void;
  readonly clearErrors: () => void;
}

export interface CaptureInboxOptions {
  readonly journalClient?: JournalClient | undefined;
  readonly availableFilters?: readonly InboxFilter[];
  readonly record?: ((action: RecentAction) => void) | undefined;
  readonly now?: () => Date;
}

function taskTitle(capture: Capture): string {
  if (capture.kind === 'photo')
    return capture.content.length === 0 ? 'Photo capture' : capture.content;
  const previewTitle = capture.linkPreview?.title?.trim();
  if (capture.kind === 'link' && previewTitle) return previewTitle;
  return capture.content;
}

function journalBody(capture: Capture): string {
  const title = capture.title?.trim();
  if (!title || title === capture.content.trim()) return capture.content;
  return `${title}\n${capture.content}`;
}

export function createCaptureInboxStore(
  client: CaptureClient,
  options: CaptureInboxOptions = {},
): StoreApi<CaptureInboxState> {
  const journalClient = options.journalClient;
  const availableFilters = options.availableFilters ?? ['unprocessed'];
  const record = options.record ?? (() => undefined);
  const pendingTaskIdsByCapture = new Map<string, string>();
  const capturesBeingPromoted = new Set<string>();

  return createStore<CaptureInboxState>((set, get) => {
    function fetchSlice(filter: InboxFilter): Promise<Capture[]> {
      switch (filter) {
        case 'unprocessed':
          return client.fetchUnprocessedCaptures();
        case 'seen':
          return client.fetchSeenCaptures();
        case 'promoted':
          return client.fetchProcessedCaptures();
      }
    }
    function setCount(filter: InboxFilter, count: number): void {
      set({ counts: { ...get().counts, [filter]: count } });
    }
    function removeCapture(id: string): void {
      const { state, filter } = get();
      if (state.kind !== 'loaded') return;
      const remaining = state.captures.filter((c) => c.id !== id);
      set({ state: { kind: 'loaded', captures: remaining } });
      setCount(filter, remaining.length);
    }
    function replaceCapture(updated: Capture): void {
      const { state } = get();
      if (state.kind !== 'loaded') return;
      set({
        state: {
          kind: 'loaded',
          captures: state.captures.map((c) => (c.id === updated.id ? updated : c)),
        },
      });
    }
    async function refreshInactiveCounts(): Promise<void> {
      for (const inactive of availableFilters) {
        if (inactive === get().filter) continue;
        try {
          setCount(inactive, (await fetchSlice(inactive)).length);
        } catch {
          // unknown is not the same as zero; leave whatever was known
        }
      }
    }
    async function refreshWeekCounterweight(): Promise<void> {
      try {
        const all = await client.fetchCaptures();
        const now = (options.now ?? (() => new Date()))();
        set({
          weekCounterweightLine: weeklyCounterweight(all, now),
          weekHealth: weekHealth(all, now),
        });
      } catch {
        // decoration only
      }
    }
    function recordTriageUndo(): void {
      set({ triageUndoCount: get().triageUndoCount + 1 });
    }
    async function undoTriage(action: TriageAction): Promise<boolean> {
      switch (action.kind) {
        case 'skipped':
          set({ skippedIds: get().skippedIds.filter((id) => id !== action.captureId) });
          recordTriageUndo();
          return true;
        case 'journaled': {
          set({ triageErrorMessage: undefined });
          try {
            await client.markUnprocessed(action.captureId);
          } catch (error) {
            set({ triageErrorMessage: errorText(error) });
            return false;
          }
          try {
            await journalClient?.deleteLog(action.logId);
          } catch {
            set({ warningMessage: JOURNAL_ENTRY_LEFT_WARNING });
          }
          recordTriageUndo();
          await get().refresh();
          await refreshInactiveCounts();
          return true;
        }
        case 'deleted':
          set({ triageErrorMessage: undefined });
          try {
            await client.restoreCapture(action.captureId);
            recordTriageUndo();
            await get().refresh();
            await refreshInactiveCounts();
            return true;
          } catch (error) {
            set({ triageErrorMessage: errorText(error) });
            return false;
          }
        case 'sorted':
          set({ triageErrorMessage: undefined });
          try {
            await client.updateCapture(action.captureId, {
              lifeAreaId: action.previousLifeAreaId ?? null,
              seen: false,
              clearedAt: null,
            });
            recordTriageUndo();
            await get().refresh();
            await refreshInactiveCounts();
            return true;
          } catch (error) {
            set({ triageErrorMessage: errorText(error) });
            return false;
          }
      }
    }
    function recordAction(
      action: TriageAction,
      kind: RecentAction['kind'],
      subject: Capture,
      areaLabel?: string,
    ): void {
      record({
        kind,
        subject: captureDetailHeadline(subject),
        ...(areaLabel !== undefined ? { areaLabel } : {}),
        undo: () => undoTriage(action),
      });
    }
    async function attachDraftTags(capture: Capture): Promise<void> {
      const selected = get().composer.tagIds;
      get().setComposer({ tagIds: [] });
      for (const tagId of selected) {
        try {
          await client.addTag(capture.id, tagId);
        } catch {
          set({ warningMessage: TAGS_NOT_ATTACHED_WARNING });
        }
      }
    }
    async function createTaskIfNotAlreadyProcessed(
      capture: Capture,
      lifeAreaId: string | undefined,
      priority: TaskPriority,
      dueDate: Date | undefined,
      focusDurationSeconds: number | undefined,
    ): Promise<string | undefined> {
      let serverCopy: Capture;
      try {
        serverCopy = await client.fetchCapture(capture.id);
        if (serverCopy.processed) {
          set({ errorMessage: ALREADY_PROCESSED_ERROR });
          return undefined;
        }
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return undefined;
      }
      try {
        const task = await client.createTask({
          title: taskTitle(capture),
          notes: serverCopy.notes,
          lifeAreaId,
          priority,
          dueDate,
          focusDurationSeconds,
        });
        set({ createdTask: task });
        return task.id;
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return undefined;
      }
    }
    async function createFromComposer(
      kind: CaptureKind,
      media?: { mediaKey: string; mediaURL: string },
    ): Promise<boolean> {
      const c = get().composer;
      const validation = normalizeCreateCaptureInput({
        content: c.content,
        kind,
        lifeAreaId: c.lifeAreaId,
        mediaKey: media?.mediaKey,
        mediaContentType: media ? PHOTO_CONTENT_TYPE : undefined,
      });
      if (validation.kind !== 'ok') {
        set({ createCaptureErrorMessage: validation.message });
        return false;
      }
      const created = await client.createCapture(validation.input, media?.mediaURL);
      await attachDraftTags(created);
      set({
        composer: {
          ...get().composer,
          content: '',
          kind: DEFAULT_CAPTURE_KIND,
          lifeAreaId: undefined,
        },
      });
      return true;
    }

    return {
      state: { kind: 'loading' },
      filter: availableFilters[0] ?? 'unprocessed',
      availableFilters,
      counts: {},
      skippedIds: [],
      sortNewestFirst: true,
      kindFilter: undefined,
      composer: EMPTY_COMPOSER,
      isSubmittingCapture: false,
      createCaptureErrorMessage: undefined,
      createdTask: undefined,
      warningMessage: undefined,
      errorMessage: undefined,
      triageErrorMessage: undefined,
      weekCounterweightLine: undefined,
      weekHealth: undefined,
      triageUndoCount: 0,

      captures: () =>
        get().state.kind === 'loaded'
          ? (get().state as { captures: readonly Capture[] }).captures
          : [],
      displayedCaptures: () =>
        applySkipOrdering(
          refineCaptures(get().captures(), get().sortNewestFirst, get().kindFilter),
          get().skippedIds,
        ),
      load: async () => {
        set({ state: { kind: 'loading' } });
        try {
          const list = await fetchSlice(get().filter);
          setCount(get().filter, list.length);
          set({ state: { kind: 'loaded', captures: list } });
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
        await refreshInactiveCounts();
        await refreshWeekCounterweight();
      },
      refresh: async () => {
        try {
          const list = await fetchSlice(get().filter);
          setCount(get().filter, list.length);
          set({ state: { kind: 'loaded', captures: list } });
        } catch {
          // keep what is on screen
        }
        await refreshWeekCounterweight();
      },
      select: async (filter) => {
        if (!availableFilters.includes(filter) || filter === get().filter) return;
        set({ filter });
        await get().load();
      },
      setSortNewestFirst: (sortNewestFirst) => set({ sortNewestFirst }),
      setKindFilter: (kindFilter) => set({ kindFilter }),
      setComposer: (patch) => set({ composer: { ...get().composer, ...patch } }),
      toggleComposerTag: (tagId) => {
        const { tagIds } = get().composer;
        get().setComposer({
          tagIds: tagIds.includes(tagId) ? tagIds.filter((t) => t !== tagId) : [...tagIds, tagId],
        });
      },
      isContentValid: () => {
        const c = get().composer;
        return normalizeCreateCaptureInput({ content: c.content, kind: c.kind }).kind === 'ok';
      },
      createCapture: async () => {
        set({ createCaptureErrorMessage: undefined, isSubmittingCapture: true });
        try {
          return await createFromComposer(get().composer.kind);
        } catch (error) {
          set({ createCaptureErrorMessage: errorText(error) });
          return false;
        } finally {
          set({ isSubmittingCapture: false });
        }
      },
      createPhotoCapture: async (image) => {
        set({ createCaptureErrorMessage: undefined, isSubmittingCapture: true });
        try {
          const uploaded = await client.uploadMedia(image, PHOTO_CONTENT_TYPE);
          return await createFromComposer('photo', uploaded);
        } catch (error) {
          set({ createCaptureErrorMessage: errorText(error) });
          return false;
        } finally {
          set({ isSubmittingCapture: false });
        }
      },
      createTagForDraft: async (name) => {
        set({ triageErrorMessage: undefined });
        try {
          const tag = await client.createTag(name);
          if (!get().composer.tagIds.includes(tag.id))
            get().setComposer({ tagIds: [...get().composer.tagIds, tag.id] });
          return tag;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return undefined;
        }
      },
      promoteToTask: async (capture, lifeAreaId, priority, dueDate, focusDurationSeconds) => {
        if (capturesBeingPromoted.has(capture.id)) return false;
        capturesBeingPromoted.add(capture.id);
        set({ errorMessage: undefined, warningMessage: undefined });
        try {
          let taskId = pendingTaskIdsByCapture.get(capture.id);
          if (taskId === undefined) {
            taskId = await createTaskIfNotAlreadyProcessed(
              capture,
              lifeAreaId,
              priority,
              dueDate,
              focusDurationSeconds,
            );
            if (taskId === undefined) return false;
          }
          try {
            await client.markProcessed(capture.id);
            pendingTaskIdsByCapture.delete(capture.id);
            removeCapture(capture.id);
            await refreshInactiveCounts();
            return true;
          } catch {
            pendingTaskIdsByCapture.set(capture.id, taskId);
            set({ warningMessage: CAPTURE_NOT_PROCESSED_WARNING });
            return false;
          }
        } finally {
          capturesBeingPromoted.delete(capture.id);
        }
      },
      sort: async (capture, into, areaLabel) => {
        set({ triageErrorMessage: undefined });
        try {
          await client.updateCapture(capture.id, {
            lifeAreaId: into,
            seen: true,
            clearedAt: (options.now ?? (() => new Date()))(),
          });
          removeCapture(capture.id);
          await refreshInactiveCounts();
          recordAction(
            { kind: 'sorted', captureId: capture.id, previousLifeAreaId: capture.lifeAreaId },
            'captureSorted',
            capture,
            areaLabel,
          );
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      skip: (capture) => {
        set({ skippedIds: [...get().skippedIds.filter((id) => id !== capture.id), capture.id] });
        recordAction({ kind: 'skipped', captureId: capture.id }, 'captureSkipped', capture);
      },
      discard: async (capture) => {
        set({ triageErrorMessage: undefined });
        try {
          await client.softDeleteCapture(capture.id);
          removeCapture(capture.id);
          await refreshInactiveCounts();
          recordAction({ kind: 'deleted', captureId: capture.id }, 'captureDeleted', capture);
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      undoSeen: async (capture) => {
        set({ triageErrorMessage: undefined });
        try {
          await client.updateCapture(capture.id, { seen: false, clearedAt: null });
          removeCapture(capture.id);
          await refreshInactiveCounts();
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      logToJournal: async (capture, energyLevel, moodEmoji) => {
        set({ triageErrorMessage: undefined });
        if (!journalClient) {
          set({ triageErrorMessage: 'Journal is unavailable.' });
          return false;
        }
        const validation = normalizeCreateLogInput({
          body: journalBody(capture),
          type: 'journal',
          lifeAreaId: capture.lifeAreaId,
          energyLevel,
          moodEmoji,
        });
        if (validation.kind !== 'ok') {
          set({ triageErrorMessage: validation.message });
          return false;
        }
        try {
          const entry = await journalClient.createLog(validation.input);
          await client.markProcessed(capture.id);
          removeCapture(capture.id);
          await refreshInactiveCounts();
          recordAction(
            { kind: 'journaled', captureId: capture.id, logId: entry.id },
            'captureJournalled',
            capture,
          );
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      updateLifeArea: async (capture, lifeAreaId) => {
        set({ triageErrorMessage: undefined });
        try {
          replaceCapture(
            await client.updateCapture(capture.id, { lifeAreaId: lifeAreaId ?? null }),
          );
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      saveNotes: async (capture, notes) => {
        set({ triageErrorMessage: undefined });
        const trimmed = notes.trim();
        try {
          const updated = await client.updateCapture(capture.id, {
            notes: trimmed.length === 0 ? null : trimmed,
          });
          replaceCapture(updated);
          return updated;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return undefined;
        }
      },
      fetchCaptureDetail: (id) => client.fetchCapture(id),
      fetchAllTags: async () => {
        try {
          return await client.fetchAllTags();
        } catch {
          return [];
        }
      },
      fetchTags: async (capture) => {
        try {
          return await client.fetchTags(capture.id);
        } catch {
          return [];
        }
      },
      addExistingTag: async (capture, tagId) => {
        set({ triageErrorMessage: undefined });
        try {
          await client.addTag(capture.id, tagId);
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      createAndAddTag: async (capture, name) => {
        set({ triageErrorMessage: undefined });
        try {
          const tag = await client.createTag(name);
          await client.addTag(capture.id, tag.id);
          return tag;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return undefined;
        }
      },
      removeTag: async (capture, tagId) => {
        set({ triageErrorMessage: undefined });
        try {
          await client.removeTag(capture.id, tagId);
          return true;
        } catch (error) {
          set({ triageErrorMessage: errorText(error) });
          return false;
        }
      },
      clearWarning: () => set({ warningMessage: undefined }),
      clearErrors: () => set({ errorMessage: undefined, triageErrorMessage: undefined }),
    };
  });
}
