/** `TaskDetailService` (`Tasks/TaskDetailService.swift`) on a vanilla zustand store, one per open task. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { DEFAULT_DURATION_SECONDS } from '@/domain/focus/focusSprintConfiguration';
import {
  isEmptyDelta,
  matchExistingTag,
  normalizeCreateTagInput,
  normalizeUpdateTaskInput,
  taskCreateValidationMessage,
} from '@/domain/tasks';
import type { TaskEditedFields } from '@/domain/tasks';
import type { Tag, Task } from '@/domain/types';

import { errorText } from './tasksClient';
import type { TaskDetailClient } from './tasksClient';

export type TaskDetailLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly task: Task }
  | { readonly kind: 'failed'; readonly message: string };

export interface TaskDetailState {
  readonly state: TaskDetailLoadState;
  readonly tags: readonly Tag[];
  readonly allTags: readonly Tag[];
  readonly isSaving: boolean;
  readonly errorMessage: string | undefined;
  readonly warningMessage: string | undefined;
  readonly defaultSprintSeconds: number;
  readonly load: () => Promise<void>;
  readonly save: (edited: TaskEditedFields) => Promise<boolean>;
  readonly close: () => Promise<void>;
  readonly reopen: () => Promise<boolean>;
  readonly softDelete: () => Promise<boolean>;
  readonly toggleTag: (tag: Tag) => Promise<void>;
  readonly addTag: (name: string) => Promise<void>;
}

export type TaskDetailStore = StoreApi<TaskDetailState>;

export function createTaskDetailStore(
  client: TaskDetailClient,
  taskId: string,
  defaultSprintSeconds = DEFAULT_DURATION_SECONDS,
): TaskDetailStore {
  return createStore<TaskDetailState>((set, get) => {
    const loadedTask = () =>
      get().state.kind === 'loaded' ? (get().state as { task: Task }).task : undefined;

    async function attach(tag: Tag): Promise<void> {
      try {
        await client.addTagToTask(taskId, tag.id);
        set({ tags: [...get().tags, tag] });
      } catch {
        set({ warningMessage: `Couldn't attach tag "${tag.name}".` });
      }
    }

    async function detach(tag: Tag): Promise<void> {
      try {
        await client.removeTagFromTask(taskId, tag.id);
        set({ tags: get().tags.filter((t) => t.id !== tag.id) });
      } catch {
        set({ warningMessage: `Couldn't remove tag "${tag.name}".` });
      }
    }

    async function setStatus(to: Task['status']): Promise<boolean> {
      const task = loadedTask();
      if (!task || task.status === to) return false;
      set({ errorMessage: undefined });
      try {
        const updated = await client.updateStatus(taskId, to);
        set({ state: { kind: 'loaded', task: updated } });
        return true;
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return false;
      }
    }

    return {
      state: { kind: 'loading' },
      tags: [],
      allTags: [],
      isSaving: false,
      errorMessage: undefined,
      warningMessage: undefined,
      defaultSprintSeconds,

      load: async () => {
        set({ state: { kind: 'loading' } });
        try {
          const [task, tags, allTags] = await Promise.all([
            client.fetchTask(taskId),
            client.fetchTagsForTask(taskId),
            client.fetchAllTags(),
          ]);
          set({ state: { kind: 'loaded', task }, tags, allTags });
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },

      save: async (edited) => {
        const task = loadedTask();
        if (!task) return false;
        set({ errorMessage: undefined });
        const result = normalizeUpdateTaskInput(task, edited, get().defaultSprintSeconds);
        if (!result.ok) {
          set({ errorMessage: taskCreateValidationMessage(result.error) });
          return false;
        }
        if (isEmptyDelta(result.value)) return true;
        set({ isSaving: true });
        try {
          const updated = await client.updateTask(taskId, result.value);
          set({ state: { kind: 'loaded', task: updated } });
          return true;
        } catch (error) {
          set({ errorMessage: errorText(error) });
          return false;
        } finally {
          set({ isSaving: false });
        }
      },

      close: async () => {
        await setStatus('done');
      },

      reopen: () => setStatus('open'),

      softDelete: async () => {
        set({ errorMessage: undefined });
        try {
          await client.softDeleteTask(taskId);
          return true;
        } catch (error) {
          set({ errorMessage: errorText(error) });
          return false;
        }
      },

      toggleTag: async (tag) => {
        if (get().tags.some((t) => t.id === tag.id)) await detach(tag);
        else await attach(tag);
      },

      addTag: async (name) => {
        const normalized = normalizeCreateTagInput(name);
        if (!normalized.ok) return;
        const existing = matchExistingTag(get().allTags, normalized.value);
        if (existing) {
          await attach(existing);
          return;
        }
        let created: Tag;
        try {
          created = await client.createTag(normalized.value);
        } catch {
          set({ warningMessage: `Couldn't create tag "${normalized.value}".` });
          return;
        }
        set({ allTags: [...get().allTags, created] });
        await attach(created);
      },
    };
  });
}
