import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { AUTH_MODES, authModeTitle, canRequestReset, canSubmit, passwordHint } from '@/domain/auth';
import type { AuthMode } from '@/domain/auth';
import { Card } from '@/shared/Card';

const subtitle: Record<AuthMode, string> = {
  signIn: 'Welcome back.',
  createAccount: 'One account, and everything in it stays yours.',
};

const fieldClass =
  'min-h-11 w-full rounded-card border border-card-border bg-card-surface-secondary px-4 py-2 text-base text-label-primary placeholder:text-label-tertiary';

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const ids = { name: useId(), email: useId(), password: useId(), hint: useId() };

  const busy = useAuth((s) => s.busy);
  const errorMessage = useAuth((s) => s.errorMessage);
  const passwordResetSentTo = useAuth((s) => s.passwordResetSentTo);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const sendPasswordReset = useAuth((s) => s.sendPasswordReset);
  const clearTransientMessages = useAuth((s) => s.clearTransientMessages);

  const hint = passwordHint(mode, password);
  const submittable = canSubmit(mode, email, password) && !busy;

  function switchMode(next: AuthMode) {
    setMode(next);
    clearTransientMessages();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!submittable) return;
    void (mode === 'signIn' ? signIn(email, password) : signUp(email, password, displayName));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">ADHD LifeOS</h1>
      <p className="mt-1 mb-6 text-label-secondary">{subtitle[mode]}</p>

      <div
        role="tablist"
        aria-label="Sign in or create account"
        className="mb-4 grid grid-cols-2 gap-2"
      >
        {AUTH_MODES.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => switchMode(option)}
            className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-semibold text-label-secondary aria-selected:border-accent aria-selected:bg-card-surface-secondary aria-selected:text-label-primary"
          >
            {authModeTitle(option)}
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {mode === 'createAccount' ? (
            <div>
              <label htmlFor={ids.name} className="sr-only">
                Your name (optional)
              </label>
              <input
                id={ids.name}
                className={fieldClass}
                placeholder="Your name (optional)"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={ids.email} className="sr-only">
              Email
            </label>
            <input
              id={ids.email}
              className={fieldClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={ids.password} className="sr-only">
              Password
            </label>
            <div className="relative">
              <input
                id={ids.password}
                className={`${fieldClass} pr-12`}
                type={revealed ? 'text' : 'password'}
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={hint ? ids.hint : undefined}
              />
              <button
                type="button"
                aria-label={revealed ? 'Hide password' : 'Show password'}
                aria-pressed={revealed}
                onClick={() => setRevealed((v) => !v)}
                className="absolute top-0 right-0 flex size-11 items-center justify-center text-label-secondary"
              >
                {revealed ? (
                  <EyeOff aria-hidden="true" className="size-6" />
                ) : (
                  <Eye aria-hidden="true" className="size-6" />
                )}
              </button>
            </div>
            {hint ? (
              <p id={ids.hint} className="mt-1 text-sm text-label-secondary">
                {hint}
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm font-medium text-state-risk">
              {errorMessage}
            </p>
          ) : null}
          {passwordResetSentTo ? (
            <p role="status" className="text-sm font-medium text-state-go">
              If {passwordResetSentTo} has an account, a reset link is on its way.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!submittable}
            className="spring min-h-11 rounded-card bg-accent px-4 text-base font-semibold text-on-area-work disabled:opacity-50"
          >
            {authModeTitle(mode)}
          </button>

          {mode === 'signIn' ? (
            <button
              type="button"
              disabled={!canRequestReset(email) || busy}
              onClick={() => void sendPasswordReset(email)}
              className="min-h-11 text-sm font-medium text-accent disabled:text-label-tertiary"
            >
              Forgot password?
            </button>
          ) : null}
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-label-tertiary">
        Your data is yours, and stays in your account.
      </p>
    </main>
  );
}
