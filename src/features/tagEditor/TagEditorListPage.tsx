import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { normalizeNewName, tagsFooter, usagePhrase } from '@/domain/tags';
import { Card } from '@/shared/Card';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { Sheet } from '@/shared/Sheet';

import { useTagEditorStore } from './useTagEditor';

/** `TagEditorListView`: every live tag with its usage, plus "New tag". */
export function TagEditorListPage() {
  const store = useTagEditorStore();
  const state = useStore(store, (s) => s.state);
  const tags = useStore(store, (s) => s.tags);
  const isMutating = useStore(store, (s) => s.isMutating);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const infoMessage = useStore(store, (s) => s.infoMessage);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizeNewName(name) || isMutating) return;
    if (await store.getState().create(name)) {
      setName('');
      setAdding(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tag Editor"
        subtitle={state.kind === 'loaded' ? tagsFooter(tags.length) : undefined}
        trailing={
          <button
            type="button"
            aria-label="New tag"
            onClick={() => setAdding(true)}
            className="spring flex size-11 items-center justify-center rounded-card bg-accent text-on-area-work"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        }
      />
      <p className="mb-4 text-xs">
        <Link to="/settings" className="text-accent">
          Settings
        </Link>
      </p>
      {infoMessage ? (
        <p role="status" aria-live="polite" className="mb-4 text-sm text-state-warn">
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
        <EmptyState title="Couldn't load your tags" body={state.message} />
      ) : null}
      {state.kind === 'loaded' && tags.length === 0 ? (
        <EmptyState title="No tags yet" body="Tags you add to tasks and captures show up here." />
      ) : null}
      {state.kind === 'loaded' && tags.length > 0 ? (
        <Card className="p-0">
          <ul className="divide-y divide-card-border" aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  to={`/tags/${tag.id}`}
                  className="flex min-h-14 items-center justify-between gap-2 px-4 py-2"
                >
                  <span className="truncate text-base font-medium">{tag.name}</span>
                  <span className="shrink-0 text-xs text-label-secondary">
                    {usagePhrase(tag.usageCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Sheet open={adding} title="New tag" onClose={() => setAdding(false)}>
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-tag-name" className="mb-1 block text-sm text-label-secondary">
              Name
            </label>
            <input
              id="new-tag-name"
              className={fieldClass}
              placeholder="Tag name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!normalizeNewName(name) || isMutating}
            className={primaryButtonClass}
          >
            {isMutating ? 'Adding…' : 'Add'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
