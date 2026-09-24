import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import {
  chipPalette,
  COMPOSER_FOOTER,
  COMPOSER_GUIDANCE,
  COMPOSER_PLACEHOLDER,
  composerBackground,
  composerChrome,
  composerChromeInk,
  composerExplainer,
  composerInk,
  isPaper,
  placeholderInk,
  writingSurface,
} from '@/domain/journal';
import { LOG_TYPES } from '@/domain/types';
import type { LogType } from '@/domain/types';

import { EnergyMoodPicker } from './EnergyMoodPicker';
import type { JournalState } from './journalStore';

interface LogComposerDialogProps {
  readonly open: boolean;
  readonly store: StoreApi<JournalState>;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

const TYPE_LABEL: Record<LogType, string> = { log: 'Log', journal: 'Journal' };

/**
 * `LogComposerView`: "New entry". A journal entry is written on paper (the gold pad), a quick log
 * on the ordinary page. Location tagging is Phase 3; draft-to-inbox on close is M1.4.
 */
export function LogComposerDialog({ open, store, onClose, onCreated }: LogComposerDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const composer = useStore(store, (s) => s.composer);
  const lifeAreas = useStore(store, (s) => s.lifeAreas);
  const availableTags = useStore(store, (s) => s.availableTags);
  const isCreating = useStore(store, (s) => s.isCreating);
  const errorMessage = useStore(store, (s) => s.createErrorMessage);
  const [draftTag, setDraftTag] = useState('');
  const type = composer.type;
  const chips = chipPalette(type);
  const soft = chips.softInk ?? 'text-label-secondary';
  const valid = composer.body.trim().length > 0;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function chip(selected: boolean): string {
    return `spring min-h-11 rounded-card px-4 text-sm font-semibold ${selected ? `${chips.selectedFill} ${chips.selectedLabel}` : `${chips.quietSurface} ${chips.quietLabel}`}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || isCreating) return;
    if (await store.getState().createLog()) onCreated();
  }

  async function addTag() {
    const name = draftTag.trim();
    if (!name) return;
    if (await store.getState().createTagForComposer(name)) setDraftTag('');
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="new-entry-title"
      onClose={onClose}
      className={`fixed inset-x-0 bottom-0 m-0 max-h-[90vh] w-full max-w-none rounded-t-card p-0 backdrop:bg-scrim md:inset-0 md:m-auto md:max-w-lg md:rounded-card ${composerChrome(type)} ${composerChromeInk(type) ?? 'text-label-primary'}`}
    >
      {open ? (
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4">
            <button type="button" onClick={onClose} className="min-h-11 text-sm font-medium">
              Close
            </button>
            <h2 id="new-entry-title" className="text-base font-bold">
              New entry
            </h2>
            <span aria-hidden="true" className="w-11" />
          </div>
          <div
            className={`spring m-2 flex flex-col gap-4 rounded-card p-4 ${composerBackground(type)} ${composerInk(type)}`}
          >
            <p className={`text-xs ${soft}`}>{COMPOSER_GUIDANCE}</p>
            <div>
              <label htmlFor="entry-body" className="sr-only">
                Entry
              </label>
              <textarea
                id="entry-body"
                rows={5}
                placeholder={COMPOSER_PLACEHOLDER}
                value={composer.body}
                onChange={(e) => store.getState().setComposer({ body: e.target.value })}
                className={`min-h-24 w-full resize-y rounded-card p-4 text-base ${writingSurface(type)} ${placeholderInk(type) ?? ''} ${isPaper(type) ? 'bg-[repeating-linear-gradient(transparent,transparent_27px,var(--color-journal-paper-rule)_28px)] leading-7' : ''}`}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className={`mb-2 text-xs font-bold tracking-widest uppercase ${soft}`}>
                What kind of entry?
              </legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entry type">
                {LOG_TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={type === option}
                    onClick={() => store.getState().setComposer({ type: option })}
                    className={chip(type === option)}
                  >
                    {TYPE_LABEL[option]}
                  </button>
                ))}
              </div>
              <p className={`text-xs ${soft}`}>{composerExplainer(type)}</p>
            </fieldset>
            {type === 'journal' ? (
              <EnergyMoodPicker
                energyLevel={composer.energyLevel}
                moodEmoji={composer.moodEmoji}
                palette={chips}
                onEnergy={(energyLevel) => store.getState().setComposer({ energyLevel })}
                onMood={(moodEmoji) => store.getState().setComposer({ moodEmoji })}
              />
            ) : null}
            {lifeAreas.some((a) => !a.archived) ? (
              <fieldset>
                <legend className={`mb-2 text-xs font-bold tracking-widest uppercase ${soft}`}>
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
              <legend className={`mb-2 text-xs font-bold tracking-widest uppercase ${soft}`}>
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
                <label htmlFor="entry-new-tag" className="sr-only">
                  New tag
                </label>
                <input
                  id="entry-new-tag"
                  placeholder="New tag"
                  autoCapitalize="none"
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value)}
                  className={`min-h-11 min-w-0 flex-1 rounded-card px-4 text-base ${chips.quietSurface} ${chips.quietLabel} ${placeholderInk(type) ?? ''}`}
                />
                <button
                  type="button"
                  disabled={draftTag.trim().length === 0}
                  onClick={() => void addTag()}
                  className="min-h-11 px-4 text-sm font-semibold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </fieldset>
            {errorMessage ? (
              <p role="alert" className="text-xs text-state-risk">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 border-t border-card-border px-4 pt-2 pb-4">
            <p className="text-xs">{COMPOSER_FOOTER}</p>
            <button
              type="submit"
              disabled={!valid || isCreating}
              className={`spring min-h-11 w-full rounded-card text-base font-semibold disabled:opacity-50 ${chips.selectedFill} ${chips.selectedLabel}`}
            >
              {isCreating ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
