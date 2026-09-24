import { useNavigate } from 'react-router';

import { useAuth } from '@/app/auth/AuthProvider';
import { signedInUser } from '@/data/store/authStore';
import { Card } from '@/shared/Card';
import { SectionLabel } from '@/shared/SectionLabel';

export function AccountSection() {
  const user = useAuth(signedInUser);
  const signOut = useAuth((s) => s.signOut);
  const busy = useAuth((s) => s.busy);
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    await navigate('/login', { replace: true });
  }

  return (
    <>
      <SectionLabel className="mt-6 mb-2">Account</SectionLabel>
      <Card>
        <p className="text-base font-semibold">{user?.displayName ?? 'No name yet'}</p>
        <p className="text-sm text-label-secondary">{user?.email ?? ''}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSignOut()}
          className="spring mt-4 min-h-11 w-full rounded-card border border-card-border px-4 text-base font-semibold text-state-risk"
        >
          Sign out
        </button>
      </Card>
    </>
  );
}
