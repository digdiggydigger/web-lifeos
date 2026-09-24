import { describe, expect, it } from 'vitest';

import { authErrorMessage, isRecentLoginRequired } from './authErrors';

describe('authErrorMessage', () => {
  it('maps the codes a person can act on to plain copy', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toMatch(/don't match/);
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/already an account/);
    expect(authErrorMessage({ code: 'auth/weak-password' })).toMatch(/at least 6/);
  });

  it('keeps a plain error message, hides raw Firebase messages, and falls back otherwise', () => {
    expect(authErrorMessage(new Error('Custom'))).toBe('Custom');
    expect(
      authErrorMessage({ code: 'auth/unknown', message: 'Firebase: Error (auth/unknown).' }),
    ).toBe('Something went wrong. Please try again.');
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('recognises the recent-login requirement', () => {
    expect(isRecentLoginRequired({ code: 'auth/requires-recent-login' })).toBe(true);
    expect(isRecentLoginRequired({ code: 'auth/other' })).toBe(false);
  });
});
