import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import {
  captureComposerFooter,
  captureComposerHint,
  captureComposerPlaceholder,
  captureComposerTitle,
  captureKindClasses,
} from '@/domain/captures';
import type { CaptureKind, LifeArea, Tag } from '@/domain/types';
import { recentActionStore } from '@/features/undo/recentActionStore';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';

import type { CaptureClient } from './captureClient';
import type { CaptureInboxState } from './captureInboxStore';
import { fileDraftIfNeeded } from './draftFiling';
import { downscaledJPEG } from './photoProcessing';

/** Voice is Phase 4 (server transcription); the four kinds the browser can make today. */
const WEB_KINDS: readonly CaptureKind[] = ['note', 'task', 'link', 'photo'];

interface QuickCaptureDialogProps {
  readonly open: boolean;
  readonly store: StoreApi<CaptureInboxState>;
  readonly client: CaptureClient;
  readonly lifeAreas: readonly LifeArea[];
  readonly initialKind?: CaptureKind;
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly onOpenCapture: (id: string) => void;
  /** A closed composer kept its text as a note; the inbox refreshes to show it. */
  readonly onDraftKept?: (() => void) | undefined;
}

const chip = (selected: boolean) =>
  `spring min-h-11 rounded-card px-4 text-sm font-semibold ${selected ? 'bg-accent text-on-area-work' : 'bg-card-surface-secondary text-label-secondary'}`;

/** `QuickCaptureView`: kind, content (or a photo), area, tags. Closing with text keeps it as a note in the inbox. */
export function QuickCaptureDialog({
  open,
  store,
  client,
  lifeAreas,
  initialKind = 'note',
  onClose,
  onCreated,
  onOpenCapture,
  onDraftKept,
}: QuickCaptureDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const composer = useStore(store, (s) => s.composer);
  const isSubmitting = useStore(store, (s) => s.isSubmittingCapture);
  const errorMessage = useStore(store, (s) => s.createCaptureErrorMessage);
  const [availableTags, setAvailableTags] = useState<readonly Tag[]>([]);
  const [draftTag, setDraftTag] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | undefined>(undefined);
  const submitted = useRef(false);
  /** The Close button and the native close event both land here; file the draft once per opening. */
  const closed = useRef(false);
  const kind = composer.kind;
  const colours = captureKindClasses(kind);
  const contentValid = composer.content.trim().length > 0;
  const saveDisabled = isSubmitting || (kind === 'photo' ? photo === undefined : !contentValid);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      submitted.current = false;
      closed.current = false;
      store.getState().setComposer({ kind: initialKind });
      void store.getState().fetchAllTags().then(setAvailableTags);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, initialKind, store]);

  function handleClose() {
    if (!submitted.current && !closed.current) {
      closed.current = true;
      const text = store.getState().composer.content;
      void fileDraftIfNeeded(
        client,
        text,
        (a) => recentActionStore.getState().record(a),
        onOpenCapture,
      ).then((filed) => {
        if (filed) {
          store.getState().setComposer({ content: '' });
          onDraftKept?.();
        }
      });
    }
    setPhoto(undefined);
    onClose();
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const blob = await downscaledJPEG(file).catch(() => file);
    setPhoto({ blob, url: URL.createObjectURL(blob) });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saveDisabled) return;
    const ok =
      kind === 'photo' && photo
        ? await store.getState().createPhotoCapture(photo.blob)
        : await store.getState().createCapture();
    if (ok) {
      submitted.current = true;
      setPhoto(undefined);
      onCreated();
    }
  }

  async function addTag() {
    const name = draftTag.trim();
    if (!name) return;
    const tag = await store.getState().createTagForDraft(name);
    if (tag) {
      setDraftTag('');
      if (!availableTags.some((t) => t.id === tag.id)) setAvailableTags([...availableTags, tag]);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quick-capture-title"
      onClose={handleClose}
      className="fixed inset-x-0 bottom-0 m-0 max-h-[90vh] w-full max-w-none rounded-t-card bg-page-background p-0 text-label-primary backdrop:bg-scrim md:inset-0 md:m-auto md:max-w-lg md:rounded-card"
    >
      {open ? (
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 text-sm font-medium text-accent"
            >
              Close
            </button>
            <h2 id="quick-capture-title" className="flex items-center gap-2 text-base font-bold">
              <span aria-hidden="true" className={`size-2 rounded-full ${colours.fill}`} />
              {captureComposerTitle(kind)}
            </h2>
            <span aria-hidden="true" className="w-11" />
          </div>
          <div role="radiogroup" aria-label="Kind" className="grid grid-cols-4 gap-2">
            {WEB_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                onClick={() => store.getState().setComposer({ kind: option })}
                className={chip(kind === option)}
              >
                {captureComposerTitle(option)}
              </button>
            ))}
          </div>
          <p className="text-xs text-label-secondary">{captureComposerHint(kind)}</p>
          {kind === 'photo' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="capture-photo" className="text-sm text-label-secondary">
                Photo
              </label>
              <input
                id="capture-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
                className="min-h-11 text-sm"
              />
              {photo ? (
                <img
                  src={photo.url}
                  alt="Selected photo"
                  className="max-h-48 rounded-card object-contain"
                />
              ) : null}
            </div>
          ) : null}
          <div>
            <label htmlFor="capture-content" className="sr-only">
              {kind === 'photo' ? 'Caption' : 'Content'}
            </label>
            {kind === 'link' ? (
              <input
                id="capture-content"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                className={fieldClass}
                placeholder={captureComposerPlaceholder(kind)}
                value={composer.content}
                onChange={(e) => store.getState().setComposer({ content: e.target.value })}
              />
            ) : (
              <textarea
                id="capture-content"
                rows={kind === 'photo' ? 2 : 4}
                className={`${fieldClass} resize-y`}
                placeholder={captureComposerPlaceholder(kind)}
                value={composer.content}
                onChange={(e) => store.getState().setComposer({ content: e.target.value })}
              />
            )}
          </div>
          {errorMessage ? (
            <p role="alert" className="text-xs text-state-risk">
              {errorMessage}
            </p>
          ) : null}
          <p className="text-xs text-label-secondary">🔒 {captureComposerFooter(kind)}</p>
          {lifeAreas.some((a) => !a.archived) ? (
            <fieldset>
              <legend className="mb-2 text-xs font-bold tracking-widest text-label-secondary uppercase">
                Life area <span className="font-normal normal-case">optional</span>
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Life area">
                <button
                  type="button"
                  role="radio"
                  aria-checked={composer.lifeAreaId === undefined}
                  onClick={() => store.getState().setComposer({ lifeAreaId: undefined })}
                  className={chip(composer.lifeAreaId === undefined)}
                >
                  No life area
                </button>
                {lifeAreas
                  .filter((a) => !a.archived)
                  .map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      role="radio"
                      aria-checked={composer.lifeAreaId === area.id}
                      onClick={() => store.getState().setComposer({ lifeAreaId: area.id })}
                      className={chip(composer.lifeAreaId === area.id)}
                    >
                      {area.colour} {area.name}
                    </button>
                  ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-xs font-bold tracking-widest text-label-secondary uppercase">
              Tags <span className="font-normal normal-case">optional</span>
            </legend>
            {availableTags.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Tags">
                {availableTags.map((tag) => {
                  const selected = composer.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => store.getState().toggleComposerTag(tag.id)}
                      className={chip(selected)}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex gap-2">
              <label htmlFor="capture-new-tag" className="sr-only">
                New tag
              </label>
              <input
                id="capture-new-tag"
                placeholder="New tag"
                autoCapitalize="none"
                value={draftTag}
                onChange={(e) => setDraftTag(e.target.value)}
                className={`${fieldClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                disabled={draftTag.trim().length === 0}
                onClick={() => void addTag()}
                className="min-h-11 px-4 text-sm font-semibold text-accent disabled:text-label-tertiary"
              >
                Add
              </button>
            </div>
          </fieldset>
          <button type="submit" disabled={saveDisabled} className={primaryButtonClass}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : null}
    </dialog>
  );
}
