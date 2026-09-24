/**
 * `Home/DailySummaryView.swift` + `DailySummaryResultCard.swift`: the Daily Executive Summary on the
 * week review — the banner, the tone chips with Generate, the four metrics, then the highlight line,
 * the failure card or the generated summary with its provenance and Copy.
 */
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Flame,
  Footprints,
  Inbox,
  LayoutGrid,
  Leaf,
  List,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Sunrise,
  TriangleAlert,
  Trophy,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';

import {
  DAILY_SUMMARY_TONES,
  dailySummaryHeadline,
  sourceLabel,
  toneLabel,
  type DailySummaryTone,
  type GeneratedDailySummary,
} from '@/domain/dailySummary';
import { Card } from '@/shared/Card';
import { chipClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';

import { useDailySummaryStore } from './useDailySummaryStore';

const TONE_ICONS: Record<DailySummaryTone, LucideIcon> = {
  energizing: Zap,
  gentle: Leaf,
  coaching: Footprints,
  bulleted: List,
};

export interface DailySummaryCounts {
  readonly openTasks: number;
  readonly lifeAreas: number;
  readonly inbox: number;
  readonly dueNudges: number;
}

function Metric({
  value,
  label,
  Icon,
  tint,
}: {
  readonly value: number;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly tint: string;
}) {
  return (
    <li className="flex items-center gap-2 rounded-card border border-card-border bg-card-surface p-2 shadow-card">
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-card bg-card-surface-secondary ${tint}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold">{value}</span>
        <span className="block truncate font-mono text-xs text-label-secondary">{label}</span>
      </span>
    </li>
  );
}

/** The accent eyebrow (`sectionLabel()` in the tint): a label, not a heading. */
const accentLabel = 'text-xs font-bold tracking-widest text-accent uppercase';

function HighlightHeader({ trailing }: { readonly trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-accent text-on-area-work"
      >
        <Sparkles className="size-4" />
      </span>
      <span className={`flex-1 ${accentLabel}`}>Daily Highlight</span>
      {trailing}
    </div>
  );
}

function BulletSection({
  title,
  Icon,
  items,
}: {
  readonly title: string;
  readonly Icon: LucideIcon;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <SectionLabel className="flex items-center gap-1">
        <Icon aria-hidden="true" className="size-4" /> {title}
      </SectionLabel>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex gap-2">
            <span aria-hidden="true" className="text-accent">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ParagraphSection({
  title,
  Icon,
  text,
}: {
  readonly title: string;
  readonly Icon: LucideIcon;
  readonly text: string;
}) {
  if (text === '') return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <SectionLabel className="flex items-center gap-1">
        <Icon aria-hidden="true" className="size-4" /> {title}
      </SectionLabel>
      <p className="text-sm">{text}</p>
    </section>
  );
}

function ResultCard({
  generated,
  copyText,
}: {
  readonly generated: GeneratedDailySummary;
  readonly copyText: string | undefined;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const time = generated.generatedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const { content } = generated;

  async function copy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
    } catch {
      // Clipboard refused (permissions, insecure context): nothing copied, nothing claimed.
    }
  }

  return (
    <Card
      className="flex flex-col gap-4 border-2 border-accent/20"
      role="article"
      aria-label="Generated summary"
    >
      <div className="flex flex-col gap-2">
        <HighlightHeader
          trailing={
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!copyText}
              className="spring flex min-h-11 min-w-11 items-center justify-end gap-1 text-xs font-semibold text-label-secondary"
            >
              {copied ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <Copy aria-hidden="true" className="size-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          }
        />
        <p className="text-lg font-bold">{content.headline}</p>
        <p
          className="font-mono text-xs text-label-secondary"
          aria-label={`Generated by ${sourceLabel(generated.source)}, ${toneLabel(generated.tone)} tone`}
        >
          {sourceLabel(generated.source)} · {toneLabel(generated.tone)} · {time}
        </p>
      </div>
      <BulletSection title="Dopamine Wins" Icon={Trophy} items={content.dopamineWins} />
      <ParagraphSection
        title="Reflections"
        Icon={MessageSquareQuote}
        text={content.journalReflections}
      />
      <ParagraphSection title="Focus & Stamina" Icon={Zap} text={content.focusStaminaInsight} />
      <BulletSection
        title="Tomorrow's Kickstart"
        Icon={Sunrise}
        items={content.gentleTomorrowKickstart}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? 'Summary copied' : ''}
      </p>
    </Card>
  );
}

export function DailySummarySection({ counts }: { readonly counts: DailySummaryCounts }) {
  const store = useDailySummaryStore();
  const state = useStore(store, (s) => s.state);
  const tone = useStore(store, (s) => s.tone);
  const generating = state.kind === 'loading';
  const hasSummary = state.kind === 'loaded';
  const now = new Date();

  return (
    <section aria-label="Daily summary" className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <p className="flex w-fit items-center gap-1 rounded-full bg-card-surface-secondary px-2 py-1 text-accent">
          <Sparkles aria-hidden="true" className="size-4" />
          <span className={accentLabel}>Today&apos;s Highlights</span>
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Daily Executive Summary</h2>
        <p className="text-sm text-label-secondary">
          Your day at a glance — wins, open loops, and the next smallest step.
        </p>
        <p className="mt-1 flex items-center gap-2 font-mono text-xs font-bold text-label-secondary">
          <Calendar aria-hidden="true" className="size-4" />
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel id="summary-tone-label">Tone</SectionLabel>
          <button
            type="button"
            onClick={() => void store.getState().generate()}
            disabled={generating}
            className="spring flex min-h-11 items-center gap-1 rounded-card border border-card-border px-4 text-sm font-bold text-accent disabled:text-label-tertiary"
          >
            {generating ? (
              <RefreshCw aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            ) : hasSummary ? (
              <RefreshCw aria-hidden="true" className="size-4" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {generating ? 'Generating…' : hasSummary ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        <div role="group" aria-labelledby="summary-tone-label" className="flex flex-wrap gap-2">
          {DAILY_SUMMARY_TONES.map((t) => {
            const Icon = TONE_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                aria-pressed={tone === t}
                onClick={() => store.getState().setTone(t)}
                className={`${chipClass} flex items-center gap-1`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {toneLabel(t)}
              </button>
            );
          })}
        </div>
      </div>

      <ul aria-label="Today in numbers" className="grid grid-cols-2 gap-4">
        <Metric
          value={counts.openTasks}
          label="Open Tasks"
          Icon={CheckCircle2}
          tint="text-state-go"
        />
        <Metric value={counts.dueNudges} label="Nudges Due" Icon={Flame} tint="text-state-risk" />
        <Metric
          value={counts.lifeAreas}
          label="Life Areas"
          Icon={LayoutGrid}
          tint="text-area-admin-vivid"
        />
        <Metric value={counts.inbox} label="Ideas Offloaded" Icon={Inbox} tint="text-state-warn" />
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {generating ? 'Generating your summary' : state.kind === 'loaded' ? 'Summary ready' : ''}
      </p>

      {state.kind === 'failed' ? (
        <Card className="flex flex-col gap-2" role="alert">
          <p className="flex items-center gap-1 text-sm font-bold text-accent">
            <TriangleAlert aria-hidden="true" className="size-4" /> Couldn&apos;t generate
          </p>
          <p className="text-sm text-label-secondary">{state.message}</p>
        </Card>
      ) : state.kind === 'loaded' ? (
        <ResultCard generated={state.generated} copyText={store.getState().copyText()} />
      ) : (
        <Card className="flex flex-col gap-2 border-2 border-accent/20">
          <HighlightHeader />
          <p className="text-lg font-bold">{dailySummaryHeadline(counts)}</p>
        </Card>
      )}
    </section>
  );
}
