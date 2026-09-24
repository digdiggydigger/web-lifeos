import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  activeAreasFooter,
  ARCHIVED_BADGE,
  createConflictMessage,
  createConflictTitle,
  partitionLifeAreas,
} from '@/domain/lifeAreas';
import type { LifeArea } from '@/domain/types';
import { Card } from '@/shared/Card';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';
import { ConfirmDialog } from '@/shared/Sheet';

import { AddLifeAreaDialog } from './AddLifeAreaDialog';
import { useLifeAreaEditorStore } from './useLifeAreaEditor';

/** `LifeAreaEditorListView`: active areas (with the web's Arrange controls), archived areas, add, create-conflict alert. */
export function LifeAreaEditorListPage() {
  const store = useLifeAreaEditorStore();
  const state = useStore(store, (s) => s.state);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const isMutating = useStore(store, (s) => s.isMutating);
  const conflict = useStore(store, (s) => s.pendingCreateConflict);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const infoMessage = useStore(store, (s) => s.infoMessage);
  const [adding, setAdding] = useState(false);
  const [arranging, setArranging] = useState(false);
  const { active, archived } = partitionLifeAreas(lifeAreas);

  function Row({ area, index }: { readonly area: LifeArea; readonly index: number }) {
    return (
      <li className="flex min-h-14 items-center gap-2 pl-4">
        <Link
          to={`/areas/editor/${area.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 py-2"
        >
          <span aria-hidden="true" className="text-2xl">
            {area.colour}
          </span>
          <span className="truncate text-base font-medium">{area.name}</span>
          {area.archived ? (
            <span className="rounded-card bg-card-surface-secondary px-2 py-1 text-xs text-label-secondary">
              {ARCHIVED_BADGE}
            </span>
          ) : null}
        </Link>
        {arranging && !area.archived ? (
          <span className="flex">
            <button
              type="button"
              aria-label={`Move ${area.name} up`}
              disabled={isMutating || index === 0}
              onClick={() => void store.getState().moveActive(area.id, -1)}
              className="flex size-11 items-center justify-center text-accent disabled:text-label-tertiary"
            >
              <ChevronUp aria-hidden="true" className="size-6" />
            </button>
            <button
              type="button"
              aria-label={`Move ${area.name} down`}
              disabled={isMutating || index === active.length - 1}
              onClick={() => void store.getState().moveActive(area.id, 1)}
              className="flex size-11 items-center justify-center text-accent disabled:text-label-tertiary"
            >
              <ChevronDown aria-hidden="true" className="size-6" />
            </button>
          </span>
        ) : (
          <span aria-hidden="true" className="w-4" />
        )}
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Life Areas"
        subtitle={state.kind === 'loaded' ? activeAreasFooter(active.length) : undefined}
        trailing={
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={arranging}
              onClick={() => setArranging((v) => !v)}
              className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-medium aria-pressed:border-accent aria-pressed:text-accent"
            >
              {arranging ? 'Done' : 'Arrange'}
            </button>
            <button
              type="button"
              aria-label="Add life area"
              onClick={() => setAdding(true)}
              className="spring flex size-11 items-center justify-center rounded-card bg-accent text-on-area-work"
            >
              <Plus aria-hidden="true" className="size-6" />
            </button>
          </div>
        }
      />
      <p className="mb-4 text-xs">
        <Link to="/areas" className="text-accent">
          Back to Areas
        </Link>
      </p>
      {infoMessage ? (
        <p role="status" aria-live="polite" className="mb-4 text-sm text-state-go">
          {infoMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mb-4 text-sm text-state-risk">
          {errorMessage}
        </p>
      ) : null}
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your life areas" body={state.message} />
      ) : null}
      {state.kind === 'loaded' ? (
        <>
          <section aria-label="Active">
            <SectionLabel className="mb-2">Active</SectionLabel>
            {active.length === 0 ? (
              <EmptyState title="No active life areas" body="Add one, or unarchive one below." />
            ) : (
              <Card className="p-0">
                <ul className="divide-y divide-card-border">
                  {active.map((area, index) => (
                    <Row key={area.id} area={area} index={index} />
                  ))}
                </ul>
              </Card>
            )}
          </section>
          {archived.length > 0 ? (
            <section aria-label="Archived" className="mt-6">
              <SectionLabel className="mb-2">Archived</SectionLabel>
              <Card className="p-0">
                <ul className="divide-y divide-card-border">
                  {archived.map((area, index) => (
                    <Row key={area.id} area={area} index={index} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </>
      ) : null}
      <AddLifeAreaDialog
        open={adding}
        busy={isMutating}
        onClose={() => setAdding(false)}
        onAdd={async (name, emoji) => {
          const ok = await store.getState().create(name, emoji);
          if (ok) setAdding(false);
          return ok;
        }}
      />
      <ConfirmDialog
        open={conflict !== undefined}
        title={conflict ? createConflictTitle(conflict.name) : ''}
        message={conflict ? createConflictMessage(conflict.name, conflict.archived) : ''}
        confirmLabel={conflict?.archived ? 'Unarchive' : 'OK'}
        onCancel={() => store.getState().cancelCreateConflict()}
        onConfirm={() => {
          if (conflict?.archived) {
            void store
              .getState()
              .unarchiveConflicting(conflict)
              .then((ok) => {
                if (ok) setAdding(false);
              });
          } else store.getState().cancelCreateConflict();
        }}
      />
    </>
  );
}
