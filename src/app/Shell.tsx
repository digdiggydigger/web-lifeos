import { Outlet } from 'react-router';

import { UndoCapsule } from '@/features/undo/UndoCapsule';

import { PrimaryNav } from './PrimaryNav';

export function Shell() {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-card-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <PrimaryNav />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24 md:px-6 md:pb-8">
        <Outlet />
      </main>
      <UndoCapsule />
    </div>
  );
}
