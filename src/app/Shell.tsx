import { Outlet } from 'react-router';
import { useStore } from 'zustand';

import { FocusBar } from '@/features/focus/FocusBar';
import { useFocusStore } from '@/features/focus/useFocusStore';
import { useRecentlyDeletedPurge } from '@/features/recentlyDeleted/useRecentlyDeleted';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { UndoCapsule } from '@/features/undo/UndoCapsule';

import { PrimaryNav } from './PrimaryNav';

export function Shell() {
  useRecentlyDeletedPurge();
  // While the capsule is up on a phone it sits above the bottom bar; give the page room to scroll past it.
  const capsuleShowing = useStore(recentActionStore, (s) => s.current !== undefined);
  const focus = useFocusStore();
  const focusShowing = useStore(
    focus,
    (s) =>
      s.session !== undefined ||
      s.offlineCompletionSummary !== undefined ||
      s.unconfirmedCompletions.length > 0,
  );
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-card-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <PrimaryNav />
      <main
        id="main"
        className={`mx-auto w-full max-w-3xl flex-1 px-4 pt-4 md:px-6 md:pb-8 ${focusShowing ? 'pb-72' : capsuleShowing ? 'pb-40' : 'pb-24'}`}
      >
        <Outlet />
      </main>
      <UndoCapsule lifted={focusShowing} />
      <FocusBar />
    </div>
  );
}
