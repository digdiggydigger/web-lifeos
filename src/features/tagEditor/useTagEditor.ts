import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import type { TagEditorClient } from '@/features/areas/areasClient';
import { useAreaClients } from '@/features/areas/useAreaClients';

import { createTagEditorStore } from './tagEditorStore';
import type { TagEditorState } from './tagEditorStore';

/**
 * One store per signed-in client, shared by the list and the detail: an undo recorded on the
 * detail screen restores through the same store the list is reading, so the list refreshes.
 */
const stores = new WeakMap<TagEditorClient, StoreApi<TagEditorState>>();

export function useTagEditorStore(): StoreApi<TagEditorState> {
  const client = useAreaClients();
  const store = useMemo(() => {
    let existing = stores.get(client);
    if (!existing) {
      existing = createTagEditorStore(client);
      stores.set(client, existing);
    }
    return existing;
  }, [client]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}
