// Port of AccountDeletionServiceTests.
import { describe, expect, it } from 'vitest';

import { RecentLoginRequiredError } from '@/domain/settings';

import type { AccountDeletionClient } from './accountDeletionStore';
import { createAccountDeletionStore } from './accountDeletionStore';

class FakeClient implements AccountDeletionClient {
  method: 'password' | 'apple' | undefined = 'password';
  dataError: Error | undefined;
  authErrors: (Error | undefined)[] = [];
  reauthError: Error | undefined;
  callLog: string[] = [];
  passwords: string[] = [];
  reauthMethod() {
    return this.method;
  }
  deleteAllUserData() {
    this.callLog.push('deleteAllUserData');
    return this.dataError ? Promise.reject(this.dataError) : Promise.resolve();
  }
  deleteAuthAccount() {
    this.callLog.push('deleteAuthAccount');
    const error = this.authErrors.shift();
    return error ? Promise.reject(error) : Promise.resolve();
  }
  reauthenticate(password: string) {
    this.callLog.push('reauthenticate');
    this.passwords.push(password);
    return this.reauthError ? Promise.reject(this.reauthError) : Promise.resolve();
  }
}

describe('accountDeletionStore', () => {
  it('deletes data then the account and completes', async () => {
    const client = new FakeClient();
    const store = createAccountDeletionStore(client);
    await store.getState().requestDeletion();
    expect(store.getState().phase).toEqual({ kind: 'completed' });
    expect(store.getState().errorMessage).toBeUndefined();
    expect(client.callLog).toEqual(['deleteAllUserData', 'deleteAuthAccount']);
  });
  it('a data failure aborts without touching the auth account', async () => {
    const client = new FakeClient();
    client.dataError = new Error('rules rejected the journal delete');
    const store = createAccountDeletionStore(client);
    await store.getState().requestDeletion();
    expect(store.getState().phase).toEqual({ kind: 'idle' });
    expect(store.getState().errorMessage).toBe('rules rejected the journal delete');
    expect(client.callLog).toEqual(['deleteAllUserData']);
  });
  it('a recent-login demand pauses for reauth with the client method; password reauth retries without re-running the cascade', async () => {
    const client = new FakeClient();
    client.method = 'apple';
    client.authErrors = [new RecentLoginRequiredError()];
    const store = createAccountDeletionStore(client);
    await store.getState().requestDeletion();
    expect(store.getState().phase).toEqual({ kind: 'reauthRequired', method: 'apple' });
    expect(store.getState().errorMessage).toBeUndefined();

    const pw = new FakeClient();
    pw.authErrors = [new RecentLoginRequiredError()];
    const s = createAccountDeletionStore(pw);
    await s.getState().requestDeletion();
    expect(s.getState().phase).toEqual({ kind: 'reauthRequired', method: 'password' });
    await s.getState().completeReauth('hunter2');
    expect(s.getState().phase).toEqual({ kind: 'completed' });
    expect(pw.passwords).toEqual(['hunter2']);
    expect(pw.callLog.filter((c) => c === 'deleteAllUserData')).toHaveLength(1);
    expect(pw.callLog.filter((c) => c === 'deleteAuthAccount')).toHaveLength(2);
  });
  it('a failed reauth stays in the reauth phase with the error; cancel returns to idle; a generic failure surfaces', async () => {
    const client = new FakeClient();
    client.authErrors = [new RecentLoginRequiredError()];
    client.reauthError = new Error('Wrong password.');
    const store = createAccountDeletionStore(client);
    await store.getState().requestDeletion();
    await store.getState().completeReauth('nope');
    expect(store.getState().phase).toEqual({ kind: 'reauthRequired', method: 'password' });
    expect(store.getState().errorMessage).toBe('Wrong password.');
    store.getState().cancel();
    expect(store.getState().phase).toEqual({ kind: 'idle' });
    expect(store.getState().errorMessage).toBeUndefined();

    const generic = new FakeClient();
    generic.authErrors = [new Error('network down')];
    const g = createAccountDeletionStore(generic);
    await g.getState().requestDeletion();
    expect(g.getState().phase).toEqual({ kind: 'idle' });
    expect(g.getState().errorMessage).toBe('network down');
  });
});
