/** `LifeAreaEditorService`: serialized mutations, conflicts as pending state, info toasts. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { lifeAreaPaletteEdit } from '@/data/codec/payloads/lifeAreas';
import type { LifeAreaNameConflict } from '@/data/repos/lifeAreasRepo';
import { completeOrder, normalizeNewName, partitionLifeAreas } from '@/domain/lifeAreas';
import type { LifeArea } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';

import type { LifeAreaEditorClient } from '@/features/areas/areasClient';

export type EditorLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'failed'; readonly message: string };

export interface LifeAreaEditorState {
  readonly state: EditorLoadState;
  readonly lifeAreas: readonly LifeArea[];
  readonly isMutating: boolean;
  readonly pendingCreateConflict: LifeAreaNameConflict | undefined;
  readonly pendingRenameConflict: LifeAreaNameConflict | undefined;
  readonly errorMessage: string | undefined;
  readonly infoMessage: string | undefined;
  readonly load: () => Promise<void>;
  readonly saveEdits: (
    area: LifeArea,
    name: string,
    colour: string,
    palette: string | undefined,
  ) => Promise<boolean>;
  readonly setArchived: (area: LifeArea, archived: boolean) => Promise<boolean>;
  readonly create: (name: string, colour: string) => Promise<boolean>;
  readonly unarchiveConflicting: (conflict: LifeAreaNameConflict) => Promise<boolean>;
  readonly cancelCreateConflict: () => void;
  readonly cancelRenameConflict: () => void;
  readonly clearInfo: () => void;
  /** Web addition: the editor list hosts Arrange mode (iOS keeps it on Home). Writes the complete order. */
  readonly moveActive: (id: string, direction: -1 | 1) => Promise<boolean>;
}

export function createLifeAreaEditorStore(
  client: LifeAreaEditorClient,
): StoreApi<LifeAreaEditorState> {
  return createStore<LifeAreaEditorState>((set, get) => {
    async function mutate(work: () => Promise<boolean>): Promise<boolean> {
      if (get().isMutating) return false;
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
    async function reload(): Promise<void> {
      try {
        set({ lifeAreas: await client.fetchLifeAreas() });
      } catch (error) {
        set({ errorMessage: errorText(error) });
      }
    }
    return {
      state: { kind: 'loading' },
      lifeAreas: [],
      isMutating: false,
      pendingCreateConflict: undefined,
      pendingRenameConflict: undefined,
      errorMessage: undefined,
      infoMessage: undefined,
      load: async () => {
        set({ state: { kind: 'loading' } });
        try {
          set({ lifeAreas: await client.fetchLifeAreas(), state: { kind: 'loaded' } });
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },
      saveEdits: (area, rawName, colour, palette) =>
        mutate(async () => {
          const name = normalizeNewName(rawName);
          if (!name) return false;
          const input = {
            ...(name !== area.name ? { name } : {}),
            ...(colour !== area.colour ? { colour } : {}),
            palette: lifeAreaPaletteEdit(area.palette, palette),
          };
          if (
            input.name === undefined &&
            input.colour === undefined &&
            input.palette.kind === 'unchanged'
          )
            return true;
          const result = await client.update(area.id, input);
          if (result.kind === 'nameConflict') {
            set({ pendingRenameConflict: result.conflict });
            return false;
          }
          await reload();
          return true;
        }),
      setArchived: (area, archived) =>
        mutate(async () => {
          await client.setArchived(area.id, archived);
          set({
            infoMessage: archived ? `Archived “${area.name}”.` : `Unarchived “${area.name}”.`,
          });
          await reload();
          return true;
        }),
      create: (rawName, colour) =>
        mutate(async () => {
          const name = normalizeNewName(rawName);
          if (!name) return false;
          const result = await client.create(name, colour);
          if (result.kind === 'nameConflict') {
            set({ pendingCreateConflict: result.conflict });
            return false;
          }
          await reload();
          return true;
        }),
      unarchiveConflicting: (conflict) =>
        mutate(async () => {
          await client.setArchived(conflict.id, false);
          set({ pendingCreateConflict: undefined, infoMessage: `Unarchived “${conflict.name}”.` });
          await reload();
          return true;
        }),
      cancelCreateConflict: () => set({ pendingCreateConflict: undefined }),
      cancelRenameConflict: () => set({ pendingRenameConflict: undefined }),
      clearInfo: () => set({ infoMessage: undefined }),
      moveActive: (id, direction) =>
        mutate(async () => {
          const { active, archived } = partitionLifeAreas(get().lifeAreas);
          const index = active.findIndex((a) => a.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= active.length) return false;
          const reordered = active.slice();
          [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
          await client.reorder(completeOrder(reordered, archived));
          await reload();
          return true;
        }),
    };
  });
}
