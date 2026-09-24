import { ArrowUpDown, Inbox, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import {
  captureComposerTitle,
  captureKindClasses,
  capturePrimaryText,
  inboxBreakdown,
  inboxEmptyMessage,
  inboxFilterTitle,
  inboxHeadline,
  INBOX_FILTERS,
  oldestLine,
  progressFraction,
  sittingLine,
  sortedEmphasis,
  tagsForCapture,
  triageArea,
  triageAreaLabel,
} from '@/domain/captures';
import type { StagedSelection } from '@/domain/captures';
import { CAPTURE_KINDS } from '@/domain/types';
import type { Capture, CaptureKind, LifeArea, Tag } from '@/domain/types';
import { Card } from '@/shared/Card';
import { chipClass, fieldClass, primaryButtonClass } from '@/shared/Chips';
import { EmptyState } from '@/shared/EmptyState';
import { SectionLabel } from '@/shared/SectionLabel';

import { CaptureRowSummary, TagChips } from './CaptureBits';
import { PromoteSheet } from './PromoteSheet';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { useCaptureInbox, useCaptureStores } from './useCaptureStores';

const areaChip = (selected: boolean) =>
  `spring min-h-11 rounded-card px-4 text-sm font-semibold ${selected ? 'bg-accent text-on-area-work' : 'bg-card-surface-secondary text-label-secondary'}`;

/** `CaptureInboxView`: To triage / Sorted / Promoted, the summary, the top decision card, then the rest. */
export function CapturesPage() {
  const { client } = useCaptureStores();
  const store = useCaptureInbox();
  const navigate = useNavigate();
  const state = useStore(store, (s) => s.state);
  const filter = useStore(store, (s) => s.filter);
  const counts = useStore(store, (s) => s.counts);
  const skippedIds = useStore(store, (s) => s.skippedIds);
  const sortNewestFirst = useStore(store, (s) => s.sortNewestFirst);
  const kindFilter = useStore(store, (s) => s.kindFilter);
  const warning = useStore(store, (s) => s.warningMessage);
  const triageError = useStore(store, (s) => s.triageErrorMessage);
  const weekLine = useStore(store, (s) => s.weekCounterweightLine);
  const health = useStore(store, (s) => s.weekHealth);
  const undoCount = useStore(store, (s) => s.triageUndoCount);
  const [lifeAreas, setLifeAreas] = useState<readonly LifeArea[]>([]);
  const [allTags, setAllTags] = useState<readonly Tag[]>([]);
  const [staged, setStaged] = useState<StagedSelection | undefined>(undefined);
  const [capturing, setCapturing] = useState(false);
  const [promoting, setPromoting] = useState<Capture | undefined>(undefined);
  const [refining, setRefining] = useState(false);
  const now = new Date();
  const captures = state.kind === 'loaded' ? state.captures : [];
  // Read the skip order and refinement through the store so the list re-renders with them.
  const displayed = store.getState().displayedCaptures();
  void skippedIds;
  void sortNewestFirst;
  void kindFilter;

  useEffect(() => {
    void client
      .fetchLifeAreas()
      .then(setLifeAreas)
      .catch(() => setLifeAreas([]));
    void store.getState().fetchAllTags().then(setAllTags);
  }, [client, store]);
  useEffect(() => {
    setStaged(undefined);
  }, [undoCount, filter]);

  const activeAreas = lifeAreas.filter((a) => !a.archived);
  const top = filter === 'unprocessed' ? displayed[0] : undefined;
  const rest = top ? displayed.slice(1) : displayed;
  const fraction = health ? progressFraction(health.captured, health.cleared) : undefined;

  async function refreshTags() {
    setAllTags(await store.getState().fetchAllTags());
  }

  function decision(capture: Capture) {
    const area = triageArea(staged, capture);
    const ready = sortedEmphasis(area) === 'ready';
    const tags = tagsForCapture(capture, allTags);
    const age = oldestLine([capture], now)?.replace('oldest is ', '');
    return (
      <section aria-label="Decide" className="flex flex-col gap-2">
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-card px-2 py-1 text-xs font-semibold ${captureKindClasses(capture.kind).fill} ${captureKindClasses(capture.kind).on}`}
            >
              {captureComposerTitle(capture.kind)}
            </span>
            {age ? (
              <span className="rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-semibold text-label-secondary">
                {age}
              </span>
            ) : null}
          </div>
          <Link to={`/captures/${capture.id}`} className="text-lg font-bold tracking-tight">
            {capturePrimaryText(capture)}
          </Link>
          <TagChips tags={tags} />
        </Card>
        <Card>
          <SectionLabel className="mb-2 text-accent">Where does this live?</SectionLabel>
          <div role="radiogroup" aria-label="Life area" className="flex flex-wrap gap-2">
            {activeAreas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={area === a.id}
                onClick={() =>
                  setStaged({ captureId: capture.id, lifeAreaId: area === a.id ? undefined : a.id })
                }
                className={areaChip(area === a.id)}
              >
                {a.colour} {a.name}
              </button>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPromoting(capture)}
            className={primaryButtonClass}
          >
            ✓ Task it
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void store.getState().logToJournal(capture)}
              className="spring min-h-11 rounded-card border border-card-border text-sm font-semibold"
            >
              Journal it
            </button>
            <button
              type="button"
              onClick={() => store.getState().skip(capture)}
              className="spring min-h-11 rounded-card border border-card-border text-sm font-semibold"
            >
              Skip
            </button>
          </div>
          <button
            type="button"
            disabled={!ready}
            aria-describedby="sorted-hint"
            onClick={() => {
              if (!area) return;
              void store
                .getState()
                .sort(capture, area, triageAreaLabel(area, lifeAreas))
                .then((ok) => ok && setStaged(undefined));
            }}
            className={`spring min-h-11 rounded-card text-sm font-semibold ${ready ? 'bg-state-go text-on-state-go' : 'bg-card-surface-secondary text-label-tertiary'}`}
          >
            ✓ Sorted
          </button>
          <p id="sorted-hint" className="sr-only">
            {ready ? 'Files it and clears the inbox' : 'Pick a life area first'}
          </p>
        </Card>
      </section>
    );
  }

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Capture Inbox</h1>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Sort and filter"
            aria-pressed={refining}
            onClick={() => setRefining((v) => !v)}
            className="spring flex size-11 items-center justify-center rounded-card border border-card-border text-accent aria-pressed:bg-card-surface-secondary"
          >
            <ArrowUpDown aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Capture something"
            onClick={() => setCapturing(true)}
            className="spring flex size-11 items-center justify-center rounded-full bg-capture-deep text-on-area-work"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        </div>
      </header>
      {refining ? (
        <Card className="mb-4 flex flex-wrap gap-2">
          <div>
            <label htmlFor="capture-sort" className="mb-1 block text-sm text-label-secondary">
              Order
            </label>
            <select
              id="capture-sort"
              className={`${fieldClass} w-auto`}
              value={sortNewestFirst ? 'newest' : 'oldest'}
              onChange={(e) => store.getState().setSortNewestFirst(e.target.value === 'newest')}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div>
            <label htmlFor="capture-kind" className="mb-1 block text-sm text-label-secondary">
              Kind
            </label>
            <select
              id="capture-kind"
              className={`${fieldClass} w-auto`}
              value={kindFilter ?? ''}
              onChange={(e) =>
                store
                  .getState()
                  .setKindFilter((e.target.value || undefined) as CaptureKind | undefined)
              }
            >
              <option value="">All kinds</option>
              {CAPTURE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {captureComposerTitle(k)}
                </option>
              ))}
            </select>
          </div>
        </Card>
      ) : null}
      <div role="group" aria-label="Show" className="mb-6 flex flex-wrap gap-2">
        {INBOX_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => void store.getState().select(option)}
            className={chipClass}
          >
            {inboxFilterTitle(option)}
            {counts[option] !== undefined ? ` (${counts[option]})` : ''}
          </button>
        ))}
      </div>
      {warning ? (
        <button
          type="button"
          onClick={() => store.getState().clearWarning()}
          className="mb-4 flex min-h-11 w-full items-center justify-between gap-2 rounded-card border border-state-warn px-4 text-left text-sm"
        >
          <span className="text-state-warn">⚠️ {warning}</span>
          <span className="font-semibold text-accent">Dismiss</span>
        </button>
      ) : null}
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
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState
          title="Couldn't load your inbox"
          body={state.message}
          action={
            <button
              type="button"
              onClick={() => void store.getState().load()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : null}
      {state.kind === 'loaded' && captures.length === 0 ? (
        <EmptyState
          title={inboxHeadline(0, filter)}
          body={inboxEmptyMessage(filter)}
          action={
            filter === 'unprocessed' ? (
              <button
                type="button"
                onClick={() => setCapturing(true)}
                className={primaryButtonClass}
              >
                Capture something
              </button>
            ) : undefined
          }
        />
      ) : null}
      {state.kind === 'loaded' && captures.length > 0 ? (
        <div className="flex flex-col gap-4">
          <section aria-label="Summary" className="flex flex-col gap-1">
            {filter === 'unprocessed' ? (
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-state-warn tabular-nums">
                  {captures.length}
                </span>
                <span className="text-xs text-label-secondary">left</span>
              </p>
            ) : (
              <p className="text-xl font-bold tracking-tight">
                {inboxHeadline(captures.length, filter)}
              </p>
            )}
            {filter === 'unprocessed' && health && fraction !== undefined ? (
              <div
                className="h-2 overflow-hidden rounded-card bg-card-surface-secondary"
                role="img"
                aria-label={`${health.cleared} of ${health.captured} captured this week cleared`}
              >
                <div className="h-full bg-state-go-vivid" style={{ width: `${fraction * 100}%` }} />
              </div>
            ) : null}
            {inboxBreakdown(captures) ? (
              <SectionLabel>{inboxBreakdown(captures)}</SectionLabel>
            ) : null}
            {oldestLine(captures, now) ? (
              <p className="text-xs text-label-secondary">{oldestLine(captures, now)}</p>
            ) : null}
            {weekLine ? <p className="text-xs text-label-secondary">{weekLine}</p> : null}
          </section>
          {top ? decision(top) : null}
          {rest.length > 0 ? (
            <section aria-label={top ? 'Then' : 'Captures'} className="flex flex-col gap-2">
              {top ? <SectionLabel className="text-accent">Then</SectionLabel> : null}
              <ul className="flex flex-col gap-2">
                {rest.map((capture) => (
                  <li key={capture.id}>
                    <Link
                      to={`/captures/${capture.id}`}
                      aria-label={`${capturePrimaryText(capture)}. Opens this capture`}
                      className="block"
                    >
                      <Card className="flex min-h-14 items-center">
                        <CaptureRowSummary
                          capture={capture}
                          lifeAreas={lifeAreas}
                          allTags={allTags}
                        />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {filter === 'unprocessed' && health ? (
            <section aria-label="Inbox health">
              <SectionLabel className="mb-2 text-accent">Inbox health</SectionLabel>
              <Card className="flex flex-col gap-2">
                <div className="flex h-8 items-end gap-1" aria-hidden="true">
                  {health.capturedPerDay.map((n, i) => {
                    const max = Math.max(1, ...health.capturedPerDay);
                    return (
                      <span
                        key={i}
                        className="flex-1 rounded-card bg-accent"
                        style={{
                          height: `${Math.max(8, (n / max) * 100)}%`,
                          opacity: n === 0 ? 0.2 : 1,
                        }}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-label-secondary">
                  Captured this week: {health.captured}. Cleared: {health.cleared}.
                </p>
                {sittingLine(displayed.length) ? (
                  <p className="text-xs text-state-warn">{sittingLine(displayed.length)}</p>
                ) : null}
              </Card>
            </section>
          ) : null}
        </div>
      ) : null}
      <QuickCaptureDialog
        open={capturing}
        store={store}
        client={client}
        lifeAreas={lifeAreas}
        onClose={() => {
          setCapturing(false);
          void store.getState().refresh();
        }}
        onCreated={() => {
          setCapturing(false);
          void store.getState().refresh();
          void refreshTags();
        }}
        onOpenCapture={(id) => void navigate(`/captures/${id}`)}
        onDraftKept={() => void store.getState().refresh()}
      />
      <PromoteSheet
        capture={promoting}
        lifeAreaId={promoting ? triageArea(staged, promoting) : undefined}
        store={store}
        onClose={() => setPromoting(undefined)}
        onPromoted={() => {
          setPromoting(undefined);
          setStaged(undefined);
          void store.getState().refresh();
        }}
      />
      <Inbox aria-hidden="true" className="hidden" />
    </>
  );
}
