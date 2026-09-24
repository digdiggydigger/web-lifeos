import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth } from '@/app/auth/AuthProvider';
import { FirebaseAuthClient } from '@/data/auth';
import { firebase } from '@/data/firebase';
import { deleteAllUserData } from '@/data/repos/accountDeletionRepo';
import { signedInUser } from '@/data/store/authStore';
import {
  DELETE_ACCOUNT_CONFIRM_ACTION,
  DELETE_ACCOUNT_CONFIRM_MESSAGE,
  DELETE_ACCOUNT_CONFIRM_TITLE,
  DELETE_ACCOUNT_FOOTER,
  DELETE_ACCOUNT_HEADER,
  DELETE_ACCOUNT_ROW,
  DELETE_FAILED_TITLE,
  deletionProgressText,
  REAUTH_ACTION,
  REAUTH_APPLE_MESSAGE,
  REAUTH_PASSWORD_MESSAGE,
  REAUTH_TITLE,
} from '@/domain/settings';
import { Card } from '@/shared/Card';
import { fieldClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';
import { ConfirmDialog, Sheet } from '@/shared/Sheet';

import { createAccountDeletionStore } from './accountDeletionStore';

/** `AccountDeletionSection`: confirm, wipe data, delete the user; a recent-login demand asks for the password. */
export function AccountDeletionSection() {
  const uid = useAuth((s) => signedInUser(s)?.uid) ?? '';
  const completeAccountDeletion = useAuth((s) => s.completeAccountDeletion);
  const navigate = useNavigate();
  const store = useMemo(() => {
    const authClient = new FirebaseAuthClient();
    const { db, storage } = firebase();
    return createAccountDeletionStore({
      reauthMethod: () => authClient.reauthMethod(),
      deleteAllUserData: () => deleteAllUserData(db, storage, uid),
      deleteAuthAccount: () => authClient.deleteAuthUser(),
      reauthenticate: (password) => authClient.reauthenticateWithPassword(password),
    });
  }, [uid]);
  const phase = useStore(store, (s) => s.phase);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const progress = deletionProgressText(phase);

  if (phase.kind === 'completed') {
    completeAccountDeletion();
    void navigate('/login', { replace: true });
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const entered = password;
    setPassword('');
    await store.getState().completeReauth(entered);
  }

  return (
    <section aria-label={DELETE_ACCOUNT_HEADER} className="mt-6">
      <SectionLabel className="mb-2">{DELETE_ACCOUNT_HEADER}</SectionLabel>
      <Card>
        {progress ? (
          <p role="status" className="min-h-11 text-sm text-label-secondary">
            {progress}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="spring min-h-11 w-full rounded-card border border-card-border px-4 text-base font-semibold text-state-risk"
          >
            {DELETE_ACCOUNT_ROW}
          </button>
        )}
        <p className="mt-2 text-xs text-label-tertiary">{DELETE_ACCOUNT_FOOTER}</p>
        {errorMessage && phase.kind !== 'reauthRequired' ? (
          <p role="alert" className="mt-2 text-sm text-state-risk">
            {DELETE_FAILED_TITLE}: {errorMessage}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={confirming}
        title={DELETE_ACCOUNT_CONFIRM_TITLE}
        message={DELETE_ACCOUNT_CONFIRM_MESSAGE}
        confirmLabel={DELETE_ACCOUNT_CONFIRM_ACTION}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void store.getState().requestDeletion();
        }}
      />
      <Sheet
        open={phase.kind === 'reauthRequired'}
        title={REAUTH_TITLE}
        onClose={() => store.getState().cancel()}
      >
        {phase.kind === 'reauthRequired' && phase.method === 'password' ? (
          <form onSubmit={(e) => void submitPassword(e)} className="flex flex-col gap-4">
            <p className="text-sm text-label-secondary">{REAUTH_PASSWORD_MESSAGE}</p>
            <div>
              <label htmlFor="reauth-password" className="sr-only">
                Password
              </label>
              <input
                id="reauth-password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errorMessage ? (
              <p role="alert" className="text-sm text-state-risk">
                {errorMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={password.length === 0}
              className="spring min-h-11 rounded-card bg-state-risk px-4 text-sm font-semibold text-on-state-warn disabled:opacity-50"
            >
              {REAUTH_ACTION}
            </button>
          </form>
        ) : (
          <p className="text-sm text-label-secondary">{REAUTH_APPLE_MESSAGE}</p>
        )}
      </Sheet>
    </section>
  );
}
