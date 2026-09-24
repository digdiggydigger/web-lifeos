import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import {
  canReturnToInbox,
  captureCaption,
  captureDetailHeadline,
  captureNavTitle,
  captureSourceDomain,
  captureSourceURL,
  captureTranscript,
  detailCanSort,
  sortHint,
  triageAreaLabel,
} from '@/domain/captures';
import { DEFAULT_MOOD_EMOJI } from '@/domain/journal';
import type { Capture, LifeArea, Tag } from '@/domain/types';
import { errorText } from '@/features/tasks/tasksClient';
import { Card } from '@/shared/Card';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { SectionLabel } from '@/shared/SectionLabel';

import { CaptureKindGlyph } from './CaptureBits';
import { PromoteSheet } from './PromoteSheet';
import { useCaptureStores } from './useCaptureStores';

type DetailState =
  { kind: 'loading' } | { kind: 'loaded'; capture: Capture } | { kind: 'failed'; message: string };

const areaChip = (selected: boolean) =>
  `spring min-h-11 rounded-card px-4 text-sm font-semibold ${selected ? 'bg-accent text-on-area-work' : 'bg-card-surface-secondary text-label-secondary'}`;

/** `CaptureDetailView`: content, notes, Filed in (area + tags), Make a task / Sorted, and the overflow verbs. */
export function CaptureDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { client, inbox: store } = useCaptureStores();
  const triageError = useStore(store, (s) => s.triageErrorMessage);
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  const [lifeAreas, setLifeAreas] = useState<readonly LifeArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<readonly Tag[]>([]);
  const [allTags, setAllTags] = useState<readonly Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const capture = await store.getState().fetchCaptureDetail(id);
      setSelectedArea(capture.lifeAreaId);
      setNotes(capture.notes ?? '');
      setState({ kind: 'loaded', capture });
      setTags(await store.getState().fetchTags(capture));
      setAllTags(await store.getState().fetchAllTags());
    } catch (error) {
      setState({ kind: 'failed', message: errorText(error) });
    }
  }

  useEffect(() => {
    void load();
    void client
      .fetchLifeAreas()
      .then(setLifeAreas)
      .catch(() => setLifeAreas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-sm text-label-secondary">
        Loading…
      </p>
    );
  }
  if (state.kind === 'failed') {
    return (
      <EmptyState
        title="Couldn't load this capture"
        body={state.message}
        action={
          <button type="button" onClick={() => void load()} className={primaryButtonClass}>
            Try again
          </button>
        }
      />
    );
  }

  const capture = state.capture;
  const canSortNow = detailCanSort(selectedArea);
  const sourceURL = captureSourceURL(capture);
  const transcript = captureTranscript(capture);
  const leave = () => void navigate('/captures');

  async function setArea(lifeAreaId: string | undefined) {
    const previous = selectedArea;
    setSelectedArea(lifeAreaId);
    const ok = await store.getState().updateLifeArea(capture, lifeAreaId);
    if (ok)
      setState({ kind: 'loaded', capture: { ...capture, ...(lifeAreaId ? { lifeAreaId } : {}) } });
    else setSelectedArea(previous);
  }

  async function saveNotes() {
    setSavingNotes(true);
    const updated = await store.getState().saveNotes(capture, notes);
    setSavingNotes(false);
    if (updated) setState({ kind: 'loaded', capture: updated });
  }

  async function sortCapture() {
    if (sorting || !selectedArea) return;
    setSorting(true);
    const ok = await store
      .getState()
      .sort(capture, selectedArea, triageAreaLabel(selectedArea, lifeAreas));
    setSorting(false);
    if (ok) leave();
  }

  async function toggleTag(tag: Tag) {
    const has = tags.some((t) => t.id === tag.id);
    const ok = has
      ? await store.getState().removeTag(capture, tag.id)
      : await store.getState().addExistingTag(capture, tag.id);
    if (ok) setTags(has ? tags.filter((t) => t.id !== tag.id) : [...tags, tag]);
  }

  async function createTag() {
    const name = newTag.trim();
    if (!name) return;
    const tag = await store.getState().createAndAddTag(capture, name);
    if (tag) {
      setNewTag('');
      if (!tags.some((t) => t.id === tag.id)) setTags([...tags, tag]);
      if (!allTags.some((t) => t.id === tag.id)) setAllTags([...allTags, tag]);
    }
  }

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs">
            <Link to="/captures" className="text-accent">
              Capture Inbox
            </Link>
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {captureNavTitle(capture.kind)}
          </h1>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="More actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="spring flex size-11 items-center justify-center rounded-card border border-card-border"
          >
            <MoreHorizontal aria-hidden="true" className="size-6" />
          </button>
          {menuOpen ? (
            <ul
              role="menu"
              className="absolute right-0 z-10 mt-2 w-56 rounded-card border border-card-border bg-card-surface p-2 shadow-card"
            >
              <li role="none">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() =>
                    void store
                      .getState()
                      .logToJournal(capture, 'medium', DEFAULT_MOOD_EMOJI)
                      .then((ok) => ok && leave())
                  }
                  className="flex min-h-11 w-full items-center px-2 text-left text-sm"
                >
                  Log to journal
                </button>
              </li>
              {canReturnToInbox(capture) ? (
                <li role="none">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() =>
                      void store
                        .getState()
                        .undoSeen(capture)
                        .then((ok) => ok && leave())
                    }
                    className="flex min-h-11 w-full items-center px-2 text-left text-sm"
                  >
                    Move back to Inbox
                  </button>
                </li>
              ) : null}
              <li role="none">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() =>
                    void store
                      .getState()
                      .discard(capture)
                      .then((ok) => ok && leave())
                  }
                  className="flex min-h-11 w-full items-center px-2 text-left text-sm text-state-risk"
                >
                  Delete
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </header>
      {triageError ? (
        <div role="alert" className="mb-4 rounded-card border border-state-risk px-4 py-2 text-sm">
          <p className="font-semibold">Couldn't do that</p>
          <p className="text-label-secondary">{triageError}</p>
          <button
            type="button"
            onClick={() => store.getState().clearErrors()}
            className="min-h-11 font-semibold text-accent"
          >
            OK
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CaptureKindGlyph kind={capture.kind} />
            <p className="text-xs text-label-secondary">{captureCaption(capture, new Date())}</p>
          </div>
          {capture.kind === 'photo' && (capture.thumbnailURL ?? capture.mediaURL) ? (
            <a
              href={capture.mediaURL ?? capture.thumbnailURL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open photo"
            >
              <img
                src={capture.thumbnailURL ?? capture.mediaURL}
                alt={captureDetailHeadline(capture)}
                className="max-h-96 w-full rounded-card object-contain"
              />
            </a>
          ) : null}
          <p className="text-lg font-bold tracking-tight whitespace-pre-line">
            {captureDetailHeadline(capture)}
          </p>
          {sourceURL ? (
            <a
              href={sourceURL.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-1 text-sm text-accent"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              {captureSourceDomain(capture)}
            </a>
          ) : null}
          {capture.kind === 'voice' && capture.mediaURL ? (
            <audio
              controls
              src={capture.mediaURL}
              aria-label="Voice recording"
              className="w-full"
            />
          ) : null}
          {transcript ? (
            <div>
              <SectionLabel>Transcript</SectionLabel>
              <p className="mt-1 text-sm whitespace-pre-line">{transcript}</p>
            </div>
          ) : null}
        </Card>
        <section aria-labelledby="capture-notes-label">
          <SectionLabel id="capture-notes-label" className="mb-2">
            Notes
          </SectionLabel>
          <Card className="flex flex-col gap-2">
            <label htmlFor="capture-notes" className="sr-only">
              Notes
            </label>
            <textarea
              id="capture-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this mattered, what to do with it…"
              className={`${fieldClass} resize-y`}
            />
            <button
              type="button"
              disabled={savingNotes || notes.trim() === (capture.notes ?? '')}
              onClick={() => void saveNotes()}
              className="min-h-11 self-end px-4 text-sm font-semibold text-accent disabled:text-label-tertiary"
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </button>
          </Card>
        </section>
        <section aria-label="Filed in">
          <SectionLabel className="mb-2">Filed in</SectionLabel>
          <Card className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="Life area" className="flex flex-wrap gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={selectedArea === undefined}
                onClick={() => void setArea(undefined)}
                className={areaChip(selectedArea === undefined)}
              >
                No life area
              </button>
              {lifeAreas
                .filter((a) => !a.archived || a.id === selectedArea)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedArea === a.id}
                    onClick={() => void setArea(a.id)}
                    className={areaChip(selectedArea === a.id)}
                  >
                    {a.colour} {a.name}
                  </button>
                ))}
            </div>
            <p className="text-xs text-label-tertiary">
              Applies to this capture and any task made from it.
            </p>
            <div>
              <SectionLabel className="mb-2">Tags</SectionLabel>
              {allTags.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Tags">
                  {allTags.map((tag) => {
                    const selected = tags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => void toggleTag(tag)}
                        className={areaChip(selected)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="flex gap-2">
                <label htmlFor="capture-detail-new-tag" className="sr-only">
                  New tag
                </label>
                <input
                  id="capture-detail-new-tag"
                  placeholder="New tag"
                  autoCapitalize="none"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className={`${fieldClass} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={newTag.trim().length === 0}
                  onClick={() => void createTag()}
                  className="min-h-11 px-4 text-sm font-semibold text-accent disabled:text-label-tertiary"
                >
                  Create
                </button>
              </div>
            </div>
          </Card>
        </section>
        {!capture.processed ? (
          <Card className="flex flex-col gap-2">
            <button type="button" onClick={() => setPromoting(true)} className={primaryButtonClass}>
              Make a task
            </button>
            <p className="text-center text-xs text-label-secondary">
              The new task inherits this capture's life area, tags and notes.
            </p>
            {!capture.seen ? (
              <>
                <button
                  type="button"
                  disabled={!canSortNow || sorting}
                  aria-describedby="detail-sort-hint"
                  onClick={() => void sortCapture()}
                  className={`spring min-h-11 rounded-card text-sm font-semibold ${canSortNow ? 'bg-state-go text-on-state-go' : 'bg-card-surface-secondary text-label-tertiary'}`}
                >
                  ✓ Sorted
                </button>
                <p id="detail-sort-hint" className="text-center text-xs text-label-secondary">
                  {sortHint(canSortNow)}
                </p>
              </>
            ) : null}
          </Card>
        ) : null}
      </div>
      <PromoteSheet
        capture={promoting ? capture : undefined}
        lifeAreaId={selectedArea}
        store={store}
        onClose={() => setPromoting(false)}
        onPromoted={() => {
          setPromoting(false);
          leave();
        }}
      />
    </>
  );
}
