import { X } from 'lucide-react';
import { useStore } from 'zustand';

import {
  recentActionAnnouncement,
  recentActionButtonLabel,
  recentActionTint,
  recentActionVerb,
} from '@/domain/undo/recentAction';
import type { RecentActionTint } from '@/domain/undo/recentAction';

import { recentActionStore } from './recentActionStore';

const tintClass: Record<RecentActionTint, string> = {
  completion: 'text-state-go',
  accent: 'text-accent',
  secondary: 'text-label-secondary',
};

/** The one app-wide undo slot, above the bottom bar on phones and bottom-left on desktop. */
export function UndoCapsule() {
  const current = useStore(recentActionStore, (s) => s.current);
  const undoing = useStore(recentActionStore, (s) => s.undoing);
  const undo = useStore(recentActionStore, (s) => s.undo);
  const dismiss = useStore(recentActionStore, (s) => s.dismiss);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 md:inset-x-auto md:bottom-4 md:left-64"
    >
      {current ? (
        <div className="spring pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-card border border-card-border bg-card-surface py-1 pl-4 shadow-card">
          <span className="sr-only">{recentActionAnnouncement(current)}</span>
          <p aria-hidden="true" className="min-w-0 flex-1 truncate text-sm">
            <span className={`font-semibold ${tintClass[recentActionTint(current.kind)]}`}>
              {recentActionVerb(current.kind, current.areaLabel)}
            </span>
            <span className="text-label-secondary"> · {current.subject}</span>
          </p>
          <button
            type="button"
            disabled={undoing}
            onClick={() => void undo()}
            className="min-h-11 px-4 text-sm font-semibold text-accent disabled:text-label-tertiary"
          >
            {recentActionButtonLabel(current.kind)}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="flex size-11 items-center justify-center text-label-secondary"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
