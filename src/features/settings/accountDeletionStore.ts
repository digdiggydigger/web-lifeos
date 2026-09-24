/** `AccountDeletionService`: data first, then the auth user; a recent-login demand pauses for reauth without re-running the cascade. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { RecentLoginRequiredError } from '@/domain/settings';
import type { AccountDeletionPhase, AccountReauthMethod } from '@/domain/settings';
import { errorText } from '@/features/tasks/tasksClient';

export interface AccountDeletionClient {
  reauthMethod(): AccountReauthMethod | undefined;
  deleteAllUserData(): Promise<void>;
  deleteAuthAccount(): Promise<void>;
  reauthenticate(password: string): Promise<void>;
}

export interface AccountDeletionState {
  readonly phase: AccountDeletionPhase;
  readonly errorMessage: string | undefined;
  readonly requestDeletion: () => Promise<void>;
  readonly completeReauth: (password: string) => Promise<void>;
  readonly cancel: () => void;
  readonly clearError: () => void;
}

export function createAccountDeletionStore(
  client: AccountDeletionClient,
): StoreApi<AccountDeletionState> {
  let hasDeletedData = false;
  return createStore<AccountDeletionState>((set, get) => ({
    phase: { kind: 'idle' },
    errorMessage: undefined,
    requestDeletion: async () => {
      set({ errorMessage: undefined });
      if (!hasDeletedData) {
        set({ phase: { kind: 'deletingData' } });
        try {
          await client.deleteAllUserData();
          hasDeletedData = true;
        } catch (error) {
          set({ errorMessage: errorText(error), phase: { kind: 'idle' } });
          return;
        }
      }
      set({ phase: { kind: 'deletingAccount' } });
      try {
        await client.deleteAuthAccount();
        set({ phase: { kind: 'completed' } });
      } catch (error) {
        if (error instanceof RecentLoginRequiredError) {
          set({ phase: { kind: 'reauthRequired', method: client.reauthMethod() ?? 'password' } });
        } else {
          set({ errorMessage: errorText(error), phase: { kind: 'idle' } });
        }
      }
    },
    completeReauth: async (password) => {
      set({ errorMessage: undefined, phase: { kind: 'reauthenticating' } });
      try {
        await client.reauthenticate(password);
      } catch (error) {
        set({
          errorMessage: errorText(error),
          phase: { kind: 'reauthRequired', method: 'password' },
        });
        return;
      }
      await get().requestDeletion();
    },
    cancel: () => set({ errorMessage: undefined, phase: { kind: 'idle' } }),
    clearError: () => set({ errorMessage: undefined }),
  }));
}
