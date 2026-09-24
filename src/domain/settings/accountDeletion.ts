/** `Settings/AccountDeletionModels.swift` + the section's copy. */

export type AccountReauthMethod = 'password' | 'apple';

export type AccountDeletionPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'deletingData' }
  | { readonly kind: 'deletingAccount' }
  | { readonly kind: 'reauthRequired'; readonly method: AccountReauthMethod }
  | { readonly kind: 'reauthenticating' }
  | { readonly kind: 'completed' };

export const RECENT_LOGIN_REQUIRED_MESSAGE =
  "Please confirm it's you before deleting this account.";

/** The typed pause: Firebase Auth demands a recent sign-in before it will delete a user. */
export class RecentLoginRequiredError extends Error {
  constructor() {
    super(RECENT_LOGIN_REQUIRED_MESSAGE);
    this.name = 'RecentLoginRequiredError';
  }
}

export function isDeletionBusy(phase: AccountDeletionPhase): boolean {
  return (
    phase.kind === 'deletingData' ||
    phase.kind === 'deletingAccount' ||
    phase.kind === 'reauthenticating'
  );
}

export function deletionProgressText(phase: AccountDeletionPhase): string | undefined {
  switch (phase.kind) {
    case 'deletingData':
      return 'Deleting your data…';
    case 'deletingAccount':
      return 'Removing your account…';
    case 'reauthenticating':
      return "Confirming it's you…";
    default:
      return undefined;
  }
}

export const DELETE_ACCOUNT_HEADER = 'Delete Account';
export const DELETE_ACCOUNT_FOOTER =
  'Permanently deletes your account and everything in it — tasks, life areas, journal, captures, nudges, and focus history. This cannot be undone.';
export const DELETE_ACCOUNT_ROW = 'Delete Account…';
export const DELETE_ACCOUNT_CONFIRM_TITLE = 'Delete your account?';
export const DELETE_ACCOUNT_CONFIRM_MESSAGE =
  'This permanently erases your account and every task, life area, journal entry, capture, and focus session. This cannot be undone.';
export const DELETE_ACCOUNT_CONFIRM_ACTION = 'Delete Account & All Data';
export const REAUTH_TITLE = "Confirm it's you";
export const REAUTH_PASSWORD_MESSAGE =
  'Deleting an account needs a recent sign-in. Enter your password to continue.';
export const REAUTH_APPLE_MESSAGE =
  'This account signed in with Apple. Sign out and back in on your phone, or delete the account from there.';
export const REAUTH_ACTION = 'Delete Account';
export const DELETE_FAILED_TITLE = "Couldn't delete account";
