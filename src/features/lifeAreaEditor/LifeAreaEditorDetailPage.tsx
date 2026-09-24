import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import {
  AREA_FAMILIES,
  familyDisplayName,
  familyFor,
  familyFromKey,
  familyTokens,
  renameConflictMessage,
  renameConflictTitle,
} from '@/domain/lifeAreas';
import type { AreaFamily } from '@/domain/lifeAreas';
import { Card } from '@/shared/Card';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';
import { ConfirmDialog } from '@/shared/Sheet';

import { EmojiPicker } from './EmojiPicker';
import { useLifeAreaEditorStore } from './useLifeAreaEditor';

const AUTOMATIC = 'automatic';

/** `LifeAreaEditorDetailView`: name, emoji, colour (Automatic or a family), archive/unarchive, Save. */
export function LifeAreaEditorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const store = useLifeAreaEditorStore();
  const state = useStore(store, (s) => s.state);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const isMutating = useStore(store, (s) => s.isMutating);
  const conflict = useStore(store, (s) => s.pendingRenameConflict);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const area = lifeAreas.find((a) => a.id === id);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [palette, setPalette] = useState<string>(AUTOMATIC);
  const [seeded, setSeeded] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  useEffect(() => {
    if (area && !seeded) {
      setName(area.name);
      setEmoji(area.colour);
      setPalette(familyFromKey(area.palette) ?? AUTOMATIC);
      setSeeded(true);
    }
  }, [area, seeded]);

  if (state.kind === 'loading' && !area) {
    return (
      <p role="status" className="text-sm text-label-secondary">
        Loading…
      </p>
    );
  }
  if (!area) {
    return (
      <EmptyState
        title="That life area isn't here"
        action={
          <Link to="/areas/editor" className="min-h-11 font-semibold text-accent">
            Back to Life Areas
          </Link>
        }
      />
    );
  }

  const dirty =
    name.trim() !== area.name ||
    emoji !== area.colour ||
    palette !== (familyFromKey(area.palette) ?? AUTOMATIC);

  async function save() {
    if (!area) return;
    const ok = await store
      .getState()
      .saveEdits(area, name, emoji, palette === AUTOMATIC ? undefined : palette);
    if (ok) await navigate('/areas/editor');
  }

  const swatch = (family: AreaFamily) => `bg-${familyTokens(family).base}`;
  const automaticFamily = familyFor({ id: area.id, colour: emoji });

  return (
    <>
      <PageHeader
        title={area.name}
        subtitle={area.archived ? 'Archived' : undefined}
        trailing={
          <button
            type="button"
            disabled={!dirty || name.trim().length === 0 || isMutating}
            onClick={() => void save()}
            className={primaryButtonClass}
          >
            {isMutating ? 'Saving…' : 'Save'}
          </button>
        }
      />
      <p className="mb-4 text-xs">
        <Link to="/areas/editor" className="text-accent">
          Life Areas
        </Link>
      </p>
      {errorMessage ? (
        <p role="alert" className="mb-4 text-sm text-state-risk">
          {errorMessage}
        </p>
      ) : null}
      <Card className="flex flex-col gap-4">
        <div>
          <label htmlFor="area-name" className="mb-1 block text-sm text-label-secondary">
            Name
          </label>
          <input
            id="area-name"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="mb-2">
            <SectionLabel>Emoji</SectionLabel>
          </legend>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </fieldset>
        <fieldset>
          <legend className="mb-2">
            <SectionLabel>Colour</SectionLabel>
          </legend>
          <div role="radiogroup" aria-label="Colour" className="flex flex-col">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 has-checked:font-semibold">
              <input
                type="radio"
                name="palette"
                value={AUTOMATIC}
                checked={palette === AUTOMATIC}
                onChange={() => setPalette(AUTOMATIC)}
                className="size-4"
              />
              <span
                aria-hidden="true"
                className={`size-6 rounded-card ${swatch(automaticFamily)}`}
              />
              Automatic
            </label>
            {AREA_FAMILIES.map((family) => (
              <label
                key={family}
                className="flex min-h-11 cursor-pointer items-center gap-2 has-checked:font-semibold"
              >
                <input
                  type="radio"
                  name="palette"
                  value={family}
                  checked={palette === family}
                  onChange={() => setPalette(family)}
                  className="size-4"
                />
                <span aria-hidden="true" className={`size-6 rounded-card ${swatch(family)}`} />
                {familyDisplayName(family)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      <Card className="mt-6">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => (area.archived ? void unarchive() : setArchiveConfirm(true))}
          className={`spring min-h-11 w-full rounded-card border border-card-border px-4 text-base font-semibold ${area.archived ? 'text-accent' : 'text-state-risk'}`}
        >
          {area.archived ? 'Unarchive' : 'Archive'}
        </button>
        <p className="mt-2 text-xs text-label-tertiary">
          Archiving hides the area from pickers and the Areas tab. Its tasks and entries keep their
          filing.
        </p>
      </Card>
      <ConfirmDialog
        open={archiveConfirm}
        title={`Archive “${area.name}”?`}
        message="It leaves the Areas tab and every picker. You can unarchive it from this screen later."
        confirmLabel="Archive"
        destructive
        onCancel={() => setArchiveConfirm(false)}
        onConfirm={() => {
          setArchiveConfirm(false);
          void store
            .getState()
            .setArchived(area, true)
            .then((ok) => ok && navigate('/areas/editor'));
        }}
      />
      <ConfirmDialog
        open={conflict !== undefined}
        title={conflict ? renameConflictTitle(conflict.name) : ''}
        message={conflict ? renameConflictMessage(conflict.name, conflict.archived) : ''}
        confirmLabel="OK"
        onCancel={() => store.getState().cancelRenameConflict()}
        onConfirm={() => store.getState().cancelRenameConflict()}
      />
    </>
  );

  async function unarchive() {
    if (!area) return;
    if (await store.getState().setArchived(area, false)) await navigate('/areas/editor');
  }
}
