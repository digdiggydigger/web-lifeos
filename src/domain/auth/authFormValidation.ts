/**
 * What the auth screen will and won't submit (`Auth/AuthFormValidation.swift`). The two modes
 * disagree on the password rule ON PURPOSE: creating an account enforces Firebase's floor while
 * typing; signing in accepts any non-empty password, because the stored one predates any rule.
 */

/** Firebase Auth rejects anything shorter server-side, so this is its rule restated, not ours. */
export const MINIMUM_PASSWORD_LENGTH = 6;
/** Long enough for a real name, short enough for a greeting line. Truncates rather than rejects. */
export const MAXIMUM_DISPLAY_NAME_LENGTH = 60;

export type AuthMode = 'signIn' | 'createAccount';
export const AUTH_MODES: readonly AuthMode[] = ['signIn', 'createAccount'];

export function authModeTitle(mode: AuthMode): string {
  return mode === 'signIn' ? 'Sign in' : 'Create account';
}

/**
 * Trimmed, and `undefined` unless it plausibly IS an address: one `@`, something either side, a
 * dot in the domain, no whitespace. The real check is the one Firebase does anyway.
 */
export function normalizedEmail(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return undefined;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return undefined;
  const [local, domain] = parts;
  if (!local || !domain) return undefined;
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return undefined;
  return trimmed;
}

/** Trimmed, capped, `undefined` when nothing is left: "" would be stored as a name the app greets you by. */
export function normalizedDisplayName(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return Array.from(trimmed).slice(0, MAXIMUM_DISPLAY_NAME_LENGTH).join('');
}

export function canSubmit(mode: AuthMode, email: string, password: string): boolean {
  if (normalizedEmail(email) === undefined) return false;
  return mode === 'signIn' ? password.length > 0 : password.length >= MINIMUM_PASSWORD_LENGTH;
}

/** The password rule said out loud WHILE typing; nothing before the first character. */
export function passwordHint(mode: AuthMode, password: string): string | undefined {
  if (mode !== 'createAccount' || password.length === 0) return undefined;
  if (password.length >= MINIMUM_PASSWORD_LENGTH) return undefined;
  return `At least ${MINIMUM_PASSWORD_LENGTH} characters.`;
}

export function canRequestReset(email: string): boolean {
  return normalizedEmail(email) !== undefined;
}

export const NOT_AN_ADDRESS = "That doesn't look like an email address.";
