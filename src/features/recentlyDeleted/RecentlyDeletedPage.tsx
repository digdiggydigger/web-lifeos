import { CheckSquare, Inbox, Tag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  DELETE_FOREVER_CANCEL,
  DELETE_FOREVER_CONFIRM,
  DELETE_FOREVER_MESSAGE,
  deleteForeverTitle,
  EMPTY_BODY,
  EMPTY_HEADLINE,
  RESTORE_TITLE,
  SCREEN_TITLE,
  SECTION_CAPTION,
  survivorChoice,
} from '@/domain/recentlyDeleted';
import type { RecentlyDeletedItem, RecentlyDeletedKind } from '@/domain/recentlyDeleted';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { ConfirmDialog, Sheet } from '@/shared/Sheet';

import { useRecentlyDeleted } from './useRecentlyDeleted';

const GLYPHS: Record<RecentlyDeletedKind, typeof Tag> = {
  task: CheckSquare,
  capture: Inbox,
  tag: Tag,
};

/** `RecentlyDeletedView`: the caption, one card per waiting item with Restore and Delete Forever, and the two alerts. */
export function RecentlyDeletedPage() {
  const store = useRecentlyDeleted();
  const screen = useStore(store, (s) => s.screen);
  const busyItemId = useStore(store, (s) => s.busyItemId);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const pendingChoice = useStore(store, (s) => s.pendingSurvivorChoice);
  const [confirming, setConfirming] = useState<RecentlyDeletedItem | undefined>(undefined);
  const choice = pendingChoice
    ? survivorChoice(pendingChoice.title, pendingChoice.collision?.liveName ?? pendingChoice.title)
    : undefined;

  return (
    <>
      <PageHeader title={SCREEN_TITLE} subtitle={SECTION_CAPTION} />
      <p className="mb-4 text-xs">
        <Link to="/tools" className="text-accent">
          Tools
        </Link>
      </p>
      {screen.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {screen.kind === 'failed' ? (
        <Card role="alert" className="text-sm text-state-risk">
          ⚠️ {screen.message}
        </Card>
      ) : null}
      {screen.kind === 'empty' ? (
        <Card role="status">
          <p className="text-base font-semibold">{EMPTY_HEADLINE}</p>
          <p className="mt-1 text-sm text-label-secondary">{EMPTY_BODY}</p>
        </Card>
      ) : null}
      {screen.kind === 'rows' ? (
        <ul className="flex flex-col gap-2" aria-label={SCREEN_TITLE}>
          {screen.rows.map((row) => {
            const Glyph = GLYPHS[row.glyph];
            const busy = busyItemId !== undefined;
            return (
              <li key={row.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-card-surface-secondary text-label-secondary">
                      <Glyph aria-hidden="true" className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base font-medium">{row.title}</p>
                      <p className="text-xs text-label-secondary">{row.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void store.getState().restore(row.item)}
                      className="spring min-h-11 rounded-card border border-card-border text-sm font-semibold text-accent disabled:text-label-tertiary"
                    >
                      {RESTORE_TITLE}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(row.item)}
                      className="min-h-11 text-sm font-medium text-label-secondary disabled:text-label-tertiary"
                    >
                      {DELETE_FOREVER_CONFIRM}
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
      {screen.kind === 'rows' && errorMessage ? (
        <p role="alert" className="mt-4 text-sm text-state-risk">
          ⚠️ {errorMessage}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming !== undefined}
        title={confirming ? deleteForeverTitle(confirming.kind) : ''}
        message={DELETE_FOREVER_MESSAGE}
        confirmLabel={DELETE_FOREVER_CONFIRM}
        cancelLabel={DELETE_FOREVER_CANCEL}
        destructive
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => {
          const item = confirming;
          setConfirming(undefined);
          if (item) void store.getState().deleteForever(item);
        }}
      />
      <Sheet
        open={pendingChoice !== undefined}
        title={choice?.title ?? ''}
        onClose={() => store.getState().cancelSurvivorChoice()}
      >
        {pendingChoice && choice ? (
          <>
            <p
              role="alertdialog"
              aria-label={choice.title}
              className="text-sm text-label-secondary"
            >
              {choice.message}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void store.getState().resolveSurvivor(pendingChoice, true)}
                className="spring min-h-11 rounded-card bg-accent px-4 text-sm font-semibold text-on-area-work"
              >
                {choice.keepRestoredTitle}
              </button>
              {choice.keepLiveTitle ? (
                <button
                  type="button"
                  onClick={() => void store.getState().resolveSurvivor(pendingChoice, false)}
                  className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-semibold"
                >
                  {choice.keepLiveTitle}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => store.getState().cancelSurvivorChoice()}
                className="min-h-11 text-sm font-medium text-label-secondary"
              >
                {choice.cancelTitle}
              </button>
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
