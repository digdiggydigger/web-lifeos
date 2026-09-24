import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import { mergeAlertMessage, mergeAlertTitle, renameChange, usagePhrase } from '@/domain/tags';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { Card } from '@/shared/Card';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { ConfirmDialog } from '@/shared/Sheet';

import { useTagEditorStore } from './useTagEditor';

/** `TagEditorDetailView`: rename (merge on clash), usage, Delete Tag with undo. */
export function TagEditorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const store = useTagEditorStore();
  const state = useStore(store, (s) => s.state);
  const tags = useStore(store, (s) => s.tags);
  const isMutating = useStore(store, (s) => s.isMutating);
  const conflict = useStore(store, (s) => s.pendingMergeConflict);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const tag = tags.find((t) => t.id === id);
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (tag && name === undefined) setName(tag.name);
  }, [tag, name]);

  if (state.kind === 'loading' && !tag) {
    return (
      <p role="status" className="text-sm text-label-secondary">
        Loading…
      </p>
    );
  }
  if (!tag) {
    return (
      <EmptyState
        title="That tag isn't here"
        action={
          <Link to="/tags" className="min-h-11 font-semibold text-accent">
            Back to Tag Editor
          </Link>
        }
      />
    );
  }

  const change = renameChange(tag.name, name ?? tag.name);

  async function save() {
    if (!tag) return;
    if (await store.getState().rename(tag, name ?? '')) await navigate('/tags');
  }

  async function remove() {
    if (!tag) return;
    const deleted = tag;
    if (await store.getState().softDelete(deleted)) {
      recentActionStore.getState().record({
        kind: 'tagDeleted',
        subject: deleted.name,
        undo: () => store.getState().restore(deleted.id),
      });
      await navigate('/tags');
    }
  }

  return (
    <>
      <PageHeader
        title={tag.name}
        subtitle={usagePhrase(tag.usageCount)}
        trailing={
          <button
            type="button"
            disabled={change.kind !== 'valid' || isMutating}
            onClick={() => void save()}
            className={primaryButtonClass}
          >
            {isMutating ? 'Saving…' : 'Save'}
          </button>
        }
      />
      <p className="mb-4 text-xs">
        <Link to="/tags" className="text-accent">
          Tag Editor
        </Link>
      </p>
      {errorMessage ? (
        <p role="alert" className="mb-4 text-sm text-state-risk">
          {errorMessage}
        </p>
      ) : null}
      <Card>
        <label htmlFor="tag-name" className="mb-1 block text-sm text-label-secondary">
          Name
        </label>
        <input
          id="tag-name"
          className={fieldClass}
          value={name ?? ''}
          onChange={(e) => setName(e.target.value)}
        />
        {change.kind === 'invalidEmpty' ? (
          <p role="alert" className="mt-1 text-sm text-state-risk">
            A tag needs a name.
          </p>
        ) : null}
      </Card>
      <Card className="mt-6">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => void remove()}
          className="spring min-h-11 w-full rounded-card border border-card-border px-4 text-base font-semibold text-state-risk"
        >
          Delete Tag
        </button>
        <p className="mt-2 text-xs text-label-tertiary">
          It comes off every task and capture. Undo from the capsule, or from Recently Deleted.
        </p>
      </Card>
      <ConfirmDialog
        open={conflict !== undefined}
        title={conflict ? mergeAlertTitle(conflict.name) : ''}
        message={conflict ? mergeAlertMessage(conflict.name, conflict.usageCount) : ''}
        confirmLabel="Merge"
        destructive
        onCancel={() => store.getState().cancelMerge()}
        onConfirm={() => {
          if (!conflict) return;
          void store
            .getState()
            .confirmMerge(tag, conflict.name)
            .then((ok) => ok && navigate('/tags'));
        }}
      />
    </>
  );
}
