import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';

import { FirebaseAuthClient } from '@/data/auth';
import { createAuthStore } from '@/data/store/authStore';
import type { AuthState, AuthStore } from '@/data/store/authStore';

const AuthStoreContext = createContext<AuthStore | undefined>(undefined);

interface AuthProviderProps {
  readonly children: ReactNode;
  /** Tests inject a store built around a fake client. */
  readonly store?: AuthStore;
}

export function AuthProvider({ children, store }: AuthProviderProps) {
  const value = useMemo(() => store ?? createAuthStore(new FirebaseAuthClient()), [store]);
  useEffect(() => value.getState().start(), [value]);
  return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>;
}

export function useAuth<T>(selector: (state: AuthState) => T): T {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuth must be used inside AuthProvider');
  return useStore(store, selector);
}
