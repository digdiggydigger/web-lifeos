/** The narrow seam the auth store depends on (the iOS `AuthClientAdapting`), so the store is testable with a fake. */

export interface AuthUser {
  readonly uid: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface AuthClient {
  /** Delivers the restored session first, then every later change. Returns an unsubscribe. */
  subscribe(onChange: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string, displayName: string | undefined): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  updateDisplayName(displayName: string | undefined): Promise<AuthUser>;
  signOut(): Promise<void>;
}
