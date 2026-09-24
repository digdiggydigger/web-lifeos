/** `TagEditorService`: rename with merge-on-clash, soft delete with undo, create with an "already exists" info. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  alreadyExistsInfo,
  normalizeNewName,
  renameChange,
  sortTagsCaseInsensitively,
} from '@/domain/tags';
import type { EditableTag } from '@/domain/tags';
import { errorText } from '@/features/tasks/tasksClient';

import type { TagEditorClient } from '@/features/areas/areasClient';

export interface TagMergeConflict {
  readonly id: string;
  readonly name: string;
  readonly usageCount: number;
}

export type TagEditorLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'failed'; readonly message: string };

export interface TagEditorState {
  readonly state: TagEditorLoadState;
  readonly tags: readonly EditableTag[];
  readonly isMutating: boolean;
  readonly pendingMergeConflict: TagMergeConflict | undefined;
  readonly errorMessage: string | undefined;
  readonly infoMessage: string | undefined;
  readonly load: () => Promise<void>;
  readonly rename: (tag: EditableTag, to: string) => Promise<boolean>;
  readonly confirmMerge: (tag: EditableTag, intoName: string) => Promise<boolean>;
  readonly cancelMerge: () => void;
  readonly softDelete: (tag: EditableTag) => Promise<boolean>;
  readonly restore: (tagId: string) => Promise<boolean>;
  readonly create: (name: string) => Promise<boolean>;
  readonly clearInfo: () => void;
}

export function createTagEditorStore(client: TagEditorClient): StoreApi<TagEditorState> {
  return createStore<TagEditorState>((set, get) => {
    async function reload(): Promise<void> {
      set({ tags: sortTagsCaseInsensitively(await client.fetchTags()) });
    }
    async function mutate(work: () => Promise<boolean>, guarded = true): Promise<boolean> {
      if (guarded && get().isMutating) return false;
      set({ isMutating: true, errorMessage: undefined });
      try {
        return await work();
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return false;
      } finally {
        set({ isMutating: false });
      }
    }
    return {
      state: { kind: 'loading' },
      tags: [],
      isMutating: false,
      pendingMergeConflict: undefined,
      errorMessage: undefined,
      infoMessage: undefined,
      load: async () => {
        set({ state: { kind: 'loading' } });
        try {
          await reload();
          set({ state: { kind: 'loaded' } });
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },
      rename: (tag, to) =>
        mutate(async () => {
          const change = renameChange(tag.name, to);
          if (change.kind !== 'valid') return false;
          const result = await client.renameTag(tag.id, change.name);
          if (result.kind === 'needsMerge') {
            set({
              pendingMergeConflict: {
                id: result.id,
                name: result.name,
                usageCount: result.usageCount,
              },
            });
            return false;
          }
          await reload();
          return true;
        }),
      confirmMerge: (tag, intoName) =>
        mutate(async () => {
          set({ pendingMergeConflict: undefined });
          await client.mergeTag(tag.id, intoName);
          await reload();
          return true;
        }),
      cancelMerge: () => set({ pendingMergeConflict: undefined }),
      softDelete: (tag) =>
        mutate(async () => {
          await client.softDeleteTag(tag.id);
          await reload();
          return true;
        }),
      restore: (tagId) =>
        mutate(async () => {
          await client.restoreTag(tagId);
          await reload();
          return true;
        }, false),
      create: (raw) =>
        mutate(async () => {
          const name = normalizeNewName(raw);
          if (!name) return false;
          const result = await client.createTag(name);
          if (result.kind === 'alreadyExisted') set({ infoMessage: alreadyExistsInfo(name) });
          await reload();
          return true;
        }),
      clearInfo: () => set({ infoMessage: undefined }),
    };
  });
}
