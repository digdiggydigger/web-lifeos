/** Friendly copy for the Firebase Auth error codes a person can actually act on. */

interface CodedError {
  readonly code?: unknown;
  readonly message?: unknown;
}

const MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-credential': "That email and password don't match.",
  'auth/wrong-password': "That email and password don't match.",
  'auth/user-not-found': "That email and password don't match.",
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/email-already-in-use': 'There is already an account for that email. Sign in instead.',
  'auth/weak-password': 'Please choose a longer password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
  'auth/network-request-failed': "Couldn't reach the server. Check your connection and try again.",
  'auth/user-disabled': 'This account has been disabled.',
  'auth/requires-recent-login': 'Please sign in again to do that.',
};

export function authErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof error === 'object' && error !== null) {
    const { code, message } = error as CodedError;
    if (typeof code === 'string' && code in MESSAGES) return MESSAGES[code]!;
    if (typeof message === 'string' && message.length > 0 && !message.startsWith('Firebase:')) {
      return message;
    }
  }
  return fallback;
}

export function isRecentLoginRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as CodedError).code === 'auth/requires-recent-login'
  );
}
