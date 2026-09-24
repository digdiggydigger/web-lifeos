import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from './AuthProvider';

/** The signed-in half of the app. Unknown shows a status line; signed out goes to /login. */
export function RequireAuth() {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status.kind === 'unknown') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <p role="status" className="text-label-secondary">
          Restoring your session…
        </p>
      </main>
    );
  }
  if (status.kind === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** /login: a signed-in person is sent on to where they were going. */
export function PublicOnly() {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status.kind === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/today'} replace />;
  }
  return <Outlet />;
}
