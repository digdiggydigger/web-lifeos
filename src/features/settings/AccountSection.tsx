import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/auth/AuthProvider';
import { signedInUser } from '@/data/store/authStore';
import { Card } from '@/shared/Card';
import { fieldClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';
import { Sheet } from '@/shared/Sheet';

/** The iOS account section: the name (editable, cleared when blank), the email, Sign Out. */
export function AccountSection() {
  const user = useAuth(signedInUser);
  const signOut = useAuth((s) => s.signOut);
  const updateDisplayName = useAuth((s) => s.updateDisplayName);
  const busy = useAuth((s) => s.busy);
  const authError = useAuth((s) => s.errorMessage);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameFailed, setNameFailed] = useState(false);

  async function handleSignOut() {
    await signOut();
    await navigate('/login', { replace: true });
  }

  function beginEditing() {
    setNameFailed(false);
    setDraft(user?.displayName ?? '');
    setEditing(true);
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const saved = await updateDisplayName(draft);
    setNameFailed(!saved);
    if (saved) setEditing(false);
  }

  return (
    <>
      <SectionLabel className="mt-6 mb-2">Account</SectionLabel>
      <Card>
        <button
          type="button"
          onClick={beginEditing}
          aria-label={
            user?.displayName
              ? `Name: ${user.displayName}. Change the name on this account`
              : 'Add your name'
          }
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-sm text-label-secondary">Name</span>
          <span className="text-base font-semibold">{user?.displayName ?? 'Add your name'}</span>
        </button>
        <p className="flex min-h-11 items-center justify-between gap-2">
          <span className="text-sm text-label-secondary">Email</span>
          <span className="text-sm">{user?.email ?? ''}</span>
        </p>
        {nameFailed && authError ? (
          <p role="alert" className="text-sm text-state-risk">
            {authError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSignOut()}
          className="spring mt-4 min-h-11 w-full rounded-card border border-card-border px-4 text-base font-semibold text-state-risk"
        >
          Sign out
        </button>
      </Card>
      <Sheet open={editing} title="Your name" onClose={() => setEditing(false)}>
        <form onSubmit={(e) => void saveName(e)} className="flex flex-col gap-4">
          <p className="text-sm text-label-secondary">Leave it empty to remove your name.</p>
          <div>
            <label htmlFor="account-name" className="sr-only">
              Name
            </label>
            <input
              id="account-name"
              autoCapitalize="words"
              placeholder="Name"
              className={fieldClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="spring min-h-11 rounded-card bg-accent px-4 text-sm font-semibold text-on-area-work disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </Sheet>
    </>
  );
}
