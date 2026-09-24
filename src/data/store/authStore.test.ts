// Port of the service half of AuthSignUpAndResetTests, AuthServiceTests and AuthDisplayNameTests.
import { describe, expect, it } from 'vitest';

import type { AuthClient, AuthUser } from '../auth/authClient';
import { createAuthStore, signedInUser } from './authStore';

class FakeAuthClient implements AuthClient {
  restored: AuthUser | null = null;
  failWith: Error | undefined;
  signUpCalls: { email: string; password: string; displayName: string | undefined }[] = [];
  signInCalls: { email: string; password: string }[] = [];
  resetCalls: string[] = [];
  displayNameCalls: (string | undefined)[] = [];
  signedOut = 0;

  subscribe(onChange: (user: AuthUser | null) => void): () => void {
    onChange(this.restored);
    return () => undefined;
  }
  signIn(email: string, password: string): Promise<AuthUser> {
    this.signInCalls.push({ email, password });
    if (this.failWith) return Promise.reject(this.failWith);
    return Promise.resolve({ uid: 'U1', email });
  }
  signUp(email: string, password: string, displayName: string | undefined): Promise<AuthUser> {
    this.signUpCalls.push({ email, password, displayName });
    if (this.failWith) return Promise.reject(this.failWith);
    const user: { uid: string; email: string; displayName?: string } = { uid: 'U1', email };
    if (displayName) user.displayName = displayName;
    return Promise.resolve(user);
  }
  sendPasswordReset(email: string): Promise<void> {
    this.resetCalls.push(email);
    return this.failWith ? Promise.reject(this.failWith) : Promise.resolve();
  }
  updateDisplayName(displayName: string | undefined): Promise<AuthUser> {
    this.displayNameCalls.push(displayName);
    if (this.failWith) return Promise.reject(this.failWith);
    const user: { uid: string; email: string; displayName?: string } = {
      uid: 'U1',
      email: 'e@example.com',
    };
    if (displayName) user.displayName = displayName;
    return Promise.resolve(user);
  }
  signOut(): Promise<void> {
    this.signedOut += 1;
    return Promise.resolve();
  }
  reauthMethod() {
    return 'password' as const;
  }
  reauthenticateWithPassword(): Promise<void> {
    return Promise.resolve();
  }
  deleteAuthUser(): Promise<void> {
    return Promise.resolve();
  }
}

function make(client = new FakeAuthClient()) {
  return { client, store: createAuthStore(client) };
}

describe('session restore', () => {
  it('starts unknown, then reports what the client restored', () => {
    const { client, store } = make();
    expect(store.getState().status.kind).toBe('unknown');
    client.restored = { uid: 'U1', email: 'e@example.com' };
    store.getState().start();
    expect(signedInUser(store.getState())?.uid).toBe('U1');
  });

  it('reports signed out when nothing was restored', () => {
    const { store } = make();
    store.getState().start();
    expect(store.getState().status.kind).toBe('signedOut');
  });
});

describe('signUp', () => {
  it('signs straight in on success', async () => {
    const { client, store } = make();
    await store.getState().signUp('e@example.com', 'sixchr', 'Ethan');
    expect(signedInUser(store.getState())).toEqual({
      uid: 'U1',
      email: 'e@example.com',
      displayName: 'Ethan',
    });
    expect(client.signUpCalls).toEqual([
      { email: 'e@example.com', password: 'sixchr', displayName: 'Ethan' },
    ]);
    expect(store.getState().errorMessage).toBeUndefined();
  });

  it('sends no name when the name is blank, and trims everything', async () => {
    const { client, store } = make();
    await store.getState().signUp(' e@example.com ', ' sixchr ', '   ');
    expect(client.signUpCalls[0]).toEqual({
      email: 'e@example.com',
      password: 'sixchr',
      displayName: undefined,
    });
  });

  it('refuses an implausible email locally, never reaching the client', async () => {
    const { client, store } = make();
    await store.getState().signUp('nope', 'sixchr', '');
    expect(client.signUpCalls).toEqual([]);
    expect(store.getState().errorMessage).toBe("That doesn't look like an email address.");
    expect(store.getState().status.kind).toBe('unknown');
  });

  it('reports a failure and stays signed out', async () => {
    const { client, store } = make();
    client.failWith = Object.assign(new Error('x'), { code: 'auth/email-already-in-use' });
    store.getState().start();
    await store.getState().signUp('e@example.com', 'sixchr', '');
    expect(store.getState().status.kind).toBe('signedOut');
    expect(store.getState().errorMessage).toMatch(/already an account/);
    expect(store.getState().busy).toBe(false);
  });
});

describe('signIn', () => {
  it('trims the email and password before the network sees them', async () => {
    const { client, store } = make();
    await store.getState().signIn('  e@example.com ', ' pw ');
    expect(client.signInCalls).toEqual([{ email: 'e@example.com', password: 'pw' }]);
    expect(store.getState().status.kind).toBe('signedIn');
  });

  it('maps a bad credential to plain copy', async () => {
    const { client, store } = make();
    client.failWith = Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
    await store.getState().signIn('e@example.com', 'pw');
    expect(store.getState().errorMessage).toMatch(/don't match/);
  });
});

describe('sendPasswordReset', () => {
  it('confirms with the normalized address without revealing whether the account exists', async () => {
    const { client, store } = make();
    await store.getState().sendPasswordReset(' e@example.com ');
    expect(client.resetCalls).toEqual(['e@example.com']);
    expect(store.getState().passwordResetSentTo).toBe('e@example.com');
    expect(store.getState().errorMessage).toBeUndefined();
  });

  it('never reaches the network for an implausible email', async () => {
    const { client, store } = make();
    await store.getState().sendPasswordReset('nope');
    expect(client.resetCalls).toEqual([]);
    expect(store.getState().errorMessage).toBe("That doesn't look like an email address.");
    expect(store.getState().passwordResetSentTo).toBeUndefined();
  });

  it('reports a failure and confirms nothing', async () => {
    const { client, store } = make();
    client.failWith = new Error('Mail is down');
    await store.getState().sendPasswordReset('e@example.com');
    expect(store.getState().errorMessage).toBe('Mail is down');
    expect(store.getState().passwordResetSentTo).toBeUndefined();
  });
});

describe('clearTransientMessages', () => {
  it('wipes both the error and the confirmation', async () => {
    const { client, store } = make();
    await store.getState().sendPasswordReset('e@example.com');
    client.failWith = new Error('boom');
    await store.getState().signIn('e@example.com', 'pw');
    store.getState().clearTransientMessages();
    expect(store.getState().errorMessage).toBeUndefined();
    expect(store.getState().passwordResetSentTo).toBeUndefined();
  });
});

describe('updateDisplayName', () => {
  it('normalizes through the one rule, takes the user back from the client, and reports success', async () => {
    const { client, store } = make();
    client.restored = { uid: 'U1', email: 'e@example.com' };
    store.getState().start();
    expect(await store.getState().updateDisplayName('  Ethan  ')).toBe(true);
    expect(client.displayNameCalls).toEqual(['Ethan']);
    expect(signedInUser(store.getState())?.displayName).toBe('Ethan');
  });

  it('clears the name for a blank value and refuses when signed out', async () => {
    const { client, store } = make();
    expect(await store.getState().updateDisplayName('Ethan')).toBe(false);
    client.restored = { uid: 'U1' };
    store.getState().start();
    await store.getState().updateDisplayName('   ');
    expect(client.displayNameCalls).toEqual([undefined]);
  });

  it('does not swallow a failure: the displayed name stays untouched', async () => {
    const { client, store } = make();
    client.restored = { uid: 'U1', displayName: 'Old' };
    store.getState().start();
    client.failWith = new Error('nope');
    expect(await store.getState().updateDisplayName('New')).toBe(false);
    expect(signedInUser(store.getState())?.displayName).toBe('Old');
    expect(store.getState().errorMessage).toBe('nope');
  });
});

describe('signOut', () => {
  it('ends the session', async () => {
    const { client, store } = make();
    client.restored = { uid: 'U1' };
    store.getState().start();
    await store.getState().signOut();
    expect(client.signedOut).toBe(1);
    expect(store.getState().status.kind).toBe('signedOut');
  });
});
