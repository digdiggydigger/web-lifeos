/**
 * The auth state machine (`Auth/AuthService.swift`): unknown → signedOut | signedIn, with the
 * transient error and reset-confirmation lines. Built on a vanilla zustand store so a test can
 * create one around a fake client.
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { NOT_AN_ADDRESS, normalizedDisplayName, normalizedEmail } from '@/domain/auth';

import type { AuthClient, AuthUser } from '../auth/authClient';
import { authErrorMessage } from '../auth/authErrors';

export type AuthStatus =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'signedIn'; readonly user: AuthUser };

export interface AuthState {
  readonly status: AuthStatus;
  readonly busy: boolean;
  readonly errorMessage: string | undefined;
  /** Set on EVERY successful reset request, whether or not the address has an account. */
  readonly passwordResetSentTo: string | undefined;
  readonly start: () => () => void;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signUp: (email: string, password: string, displayName: string) => Promise<void>;
  readonly sendPasswordReset: (email: string) => Promise<void>;
  readonly updateDisplayName: (raw: string) => Promise<boolean>;
  readonly signOut: () => Promise<void>;
  readonly clearTransientMessages: () => void;
}

export type AuthStore = StoreApi<AuthState>;

export function signedInUser(state: Pick<AuthState, 'status'>): AuthUser | undefined {
  return state.status.kind === 'signedIn' ? state.status.user : undefined;
}

export function createAuthStore(client: AuthClient): AuthStore {
  return createStore<AuthState>((set, get) => {
    const clear = { errorMessage: undefined, passwordResetSentTo: undefined };

    async function attempt(work: () => Promise<void>): Promise<void> {
      set({ ...clear, busy: true });
      try {
        await work();
      } catch (error) {
        set({ errorMessage: authErrorMessage(error) });
      } finally {
        set({ busy: false });
      }
    }

    return {
      status: { kind: 'unknown' },
      busy: false,
      errorMessage: undefined,
      passwordResetSentTo: undefined,

      start: () =>
        client.subscribe((user) => {
          set({ status: user ? { kind: 'signedIn', user } : { kind: 'signedOut' } });
        }),

      signIn: (email, password) =>
        attempt(async () => {
          const user = await client.signIn(email.trim(), password.trim());
          set({ status: { kind: 'signedIn', user } });
        }),

      signUp: (email, password, displayName) =>
        attempt(async () => {
          const address = normalizedEmail(email);
          if (!address) throw new Error(NOT_AN_ADDRESS);
          const user = await client.signUp(
            address,
            password.trim(),
            normalizedDisplayName(displayName),
          );
          set({ status: { kind: 'signedIn', user } });
        }),

      sendPasswordReset: (email) =>
        attempt(async () => {
          const address = normalizedEmail(email);
          if (!address) throw new Error(NOT_AN_ADDRESS);
          await client.sendPasswordReset(address);
          set({ passwordResetSentTo: address });
        }),

      updateDisplayName: async (raw) => {
        if (get().status.kind !== 'signedIn') return false;
        let ok = false;
        await attempt(async () => {
          const user = await client.updateDisplayName(normalizedDisplayName(raw));
          set({ status: { kind: 'signedIn', user } });
          ok = true;
        });
        return ok;
      },

      signOut: () =>
        attempt(async () => {
          await client.signOut();
          set({ status: { kind: 'signedOut' } });
        }),

      clearTransientMessages: () => {
        set(clear);
      },
    };
  });
}
