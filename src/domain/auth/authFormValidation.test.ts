// Port of the form-rule half of AuthSignUpAndResetTests.
import { describe, expect, it } from 'vitest';

import {
  canRequestReset,
  canSubmit,
  MAXIMUM_DISPLAY_NAME_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  normalizedDisplayName,
  normalizedEmail,
  passwordHint,
} from './authFormValidation';

describe('normalizedEmail', () => {
  it('is trimmed and must look like an address', () => {
    expect(normalizedEmail('  e@example.com ')).toBe('e@example.com');
    expect(normalizedEmail('')).toBeUndefined();
    expect(normalizedEmail('   ')).toBeUndefined();
    expect(normalizedEmail('not-an-address')).toBeUndefined();
    expect(normalizedEmail('@example.com')).toBeUndefined();
    expect(normalizedEmail('e@')).toBeUndefined();
    expect(normalizedEmail('e@example'), 'a domain needs a dot').toBeUndefined();
    expect(normalizedEmail('two@at@example.com')).toBeUndefined();
    expect(normalizedEmail('spaced address@example.com')).toBeUndefined();
  });
});

describe('canSubmit', () => {
  it('sign-in needs a plausible email and some password', () => {
    expect(canSubmit('signIn', 'e@example.com', 'x')).toBe(true);
    expect(canSubmit('signIn', 'e@example.com', '')).toBe(false);
    expect(canSubmit('signIn', 'nope', 'correct-horse')).toBe(false);
  });

  it("create account enforces the password floor, at Firebase's own minimum", () => {
    expect(canSubmit('createAccount', 'e@example.com', 'short')).toBe(false);
    expect(canSubmit('createAccount', 'e@example.com', 'sixchr')).toBe(true);
    expect(MINIMUM_PASSWORD_LENGTH).toBe(6);
  });
});

describe('passwordHint', () => {
  it('only nags while creating, and only once typing starts', () => {
    expect(passwordHint('createAccount', '')).toBeUndefined();
    expect(passwordHint('createAccount', 'abc')).toBe('At least 6 characters.');
    expect(passwordHint('createAccount', 'sixchr')).toBeUndefined();
    expect(passwordHint('signIn', 'abc')).toBeUndefined();
  });
});

describe('normalizedDisplayName', () => {
  it('is trimmed to nothing and capped rather than rejected', () => {
    expect(normalizedDisplayName('  Ethan  ')).toBe('Ethan');
    expect(normalizedDisplayName('   ')).toBeUndefined();
    expect(normalizedDisplayName('')).toBeUndefined();
    expect(normalizedDisplayName('e'.repeat(200))).toHaveLength(MAXIMUM_DISPLAY_NAME_LENGTH);
  });
});

describe('canRequestReset', () => {
  it('needs only a plausible email', () => {
    expect(canRequestReset(' e@example.com ')).toBe(true);
    expect(canRequestReset('')).toBe(false);
    expect(canRequestReset('nope')).toBe(false);
  });
});
