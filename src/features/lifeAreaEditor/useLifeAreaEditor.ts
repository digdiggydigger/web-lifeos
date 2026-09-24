import { useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import type { LifeAreaEditorClient } from '@/features/areas/areasClient';
import { useAreaClients } from '@/features/areas/useAreaClients';

import { createLifeAreaEditorStore } from './lifeAreaEditorStore';
import type { LifeAreaEditorState } from './lifeAreaEditorStore';

/** One store per client, shared by the list and the detail so an info toast set on one shows on the other. */
const stores = new WeakMap<LifeAreaEditorClient, StoreApi<LifeAreaEditorState>>();

export function useLifeAreaEditorStore(): StoreApi<LifeAreaEditorState> {
  const client = useAreaClients();
  const store = useMemo(() => {
    let existing = stores.get(client);
    if (!existing) {
      existing = createLifeAreaEditorStore(client);
      stores.set(client, existing);
    }
    return existing;
  }, [client]);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return store;
}
