/**
 * `Home/DailySummaryModels.swift`, `DailySummaryStore.swift` (the snapshot), the decode rules of
 * `FirebaseDailySummaryGenerator.swift` and `DailySummaryHeadline` from `DailySummaryView.swift`.
 *
 * The request shape and the tone raw values are a WIRE contract with the iOS repo's
 * `functions/index.js` `dailySummary`: renaming a tone silently changes the summary's voice.
 */
import { completedTasks } from '@/domain/tasks/taskCompletionStamp';
import { isSameDay } from '@/domain/time/calendar';
import type { CompletedFocusSession, Log, Task } from '@/domain/types';

export const DAILY_SUMMARY_TONES = ['energizing', 'gentle', 'coaching', 'bulleted'] as const;
export type DailySummaryTone = (typeof DAILY_SUMMARY_TONES)[number];

export function toneLabel(tone: DailySummaryTone): string {
  switch (tone) {
    case 'energizing':
      return 'Energizing';
    case 'gentle':
      return 'Gentle';
    case 'coaching':
      return 'Coaching';
    case 'bulleted':
      return 'Bulleted';
  }
}

export function isDailySummaryTone(raw: unknown): raw is DailySummaryTone {
  return typeof raw === 'string' && (DAILY_SUMMARY_TONES as readonly string[]).includes(raw);
}

/** The five fields the endpoint returns, identical on both clients. */
export interface DailySummaryContent {
  readonly headline: string;
  readonly dopamineWins: readonly string[];
  readonly journalReflections: string;
  readonly focusStaminaInsight: string;
  readonly gentleTomorrowKickstart: readonly string[];
}

export type DailySummarySource = 'model' | 'localSynthesis';

export function sourceLabel(source: DailySummarySource): string {
  return source === 'model' ? 'Claude' : 'On-device synthesis';
}

/** A summary plus where it came from and when — a stale summary shown as fresh is worse than none. */
export interface GeneratedDailySummary {
  readonly content: DailySummaryContent;
  readonly tone: DailySummaryTone;
  readonly generatedAt: Date;
  readonly source: DailySummarySource;
}

// MARK: - Request

export interface DailySummaryRequest {
  readonly date: Date;
  readonly tone: DailySummaryTone;
  readonly focusMinutesTotal: number;
  readonly capturesCount: number;
  readonly completedTasks: readonly {
    readonly title: string;
    readonly lifeAreaName: string;
    readonly priority: string;
    readonly focusMinutesLogged: number;
  }[];
  readonly inProgressTasks: readonly { readonly title: string; readonly lifeAreaName: string }[];
  readonly journalEntries: readonly {
    readonly body: string;
    readonly lifeAreaName: string;
    readonly energyLevel?: string;
    readonly moodEmoji?: string;
  }[];
}

/** What an unassigned task or entry is called in the prompt. */
export const UNASSIGNED_LIFE_AREA_NAME = 'General';
const IN_PROGRESS_LIMIT = 5;

export interface DailySummaryInputs {
  readonly date: Date;
  readonly tone: DailySummaryTone;
  readonly tasks: readonly Task[];
  readonly focusSessions: readonly CompletedFocusSession[];
  readonly journalEntries: readonly Log[];
  readonly capturesCount: number;
  readonly lifeAreaNames: ReadonlyMap<string, string>;
}

/**
 * `DailySummaryRequest.init`: "what counts as today" decided in one place. Completed tasks come
 * through the completion stamp (stamped today), focus minutes count sprints that ENDED today
 * (floored on the total), and journal entries are journal-type logs dated today.
 */
export function buildDailySummaryRequest(inputs: DailySummaryInputs): DailySummaryRequest {
  const { date, lifeAreaNames } = inputs;
  const areaName = (id: string | undefined) =>
    (id !== undefined ? lifeAreaNames.get(id) : undefined) ?? UNASSIGNED_LIFE_AREA_NAME;
  const secondsToday = inputs.focusSessions
    .filter((s) => isSameDay(s.endedAt, date))
    .reduce((sum, s) => sum + s.focusedSeconds, 0);
  return {
    date,
    tone: inputs.tone,
    capturesCount: inputs.capturesCount,
    completedTasks: completedTasks(inputs.tasks, date).map((t) => ({
      title: t.title,
      lifeAreaName: areaName(t.lifeAreaId),
      priority: t.priority,
      focusMinutesLogged: Math.floor((t.focusDurationSeconds ?? 0) / 60),
    })),
    inProgressTasks: inputs.tasks
      .filter((t) => t.status === 'open')
      .slice(0, IN_PROGRESS_LIMIT)
      .map((t) => ({ title: t.title, lifeAreaName: areaName(t.lifeAreaId) })),
    focusMinutesTotal: Math.floor(secondsToday / 60),
    journalEntries: inputs.journalEntries
      .filter((l) => l.type === 'journal' && isSameDay(l.entryDate, date))
      .map((l) => ({
        body: l.body,
        lifeAreaName: areaName(l.lifeAreaId),
        ...(l.energyLevel !== undefined ? { energyLevel: l.energyLevel } : {}),
        ...(l.moodEmoji !== undefined ? { moodEmoji: l.moodEmoji } : {}),
      })),
  };
}

/** The POST body: camelCase keys, the date as ISO-8601 UTC (Swift's `.iso8601` strategy). */
export function dailySummaryRequestBody(request: DailySummaryRequest): string {
  return JSON.stringify({ ...request, date: request.date.toISOString() });
}

/** An empty day gets an honest empty state rather than a round trip that can only invent. */
export function hasSomethingToSummarise(request: DailySummaryRequest): boolean {
  return (
    request.completedTasks.length > 0 ||
    request.journalEntries.length > 0 ||
    request.focusMinutesTotal > 0 ||
    request.capturesCount > 0
  );
}

// MARK: - On-device synthesis

/**
 * `StubDailySummaryGenerator`, copy verbatim: it only restates what happened, in the chosen voice,
 * and invents nothing. The fallback when the endpoint fails.
 */
export function stubDailySummary(request: DailySummaryRequest): DailySummaryContent {
  return {
    headline: stubHeadline(request),
    dopamineWins: request.completedTasks.map((t) => {
      switch (request.tone) {
        case 'bulleted':
          return `${t.title} (${t.lifeAreaName})`;
        case 'gentle':
          return `You finished ${t.title}.`;
        case 'coaching':
          return `${t.title} — done, in ${t.lifeAreaName}.`;
        case 'energizing':
          return `Shipped: ${t.title}.`;
      }
    }),
    journalReflections: stubReflections(request),
    focusStaminaInsight: stubFocusInsight(request),
    gentleTomorrowKickstart: stubKickstart(request),
  };
}

function stubHeadline(request: DailySummaryRequest): string {
  const wins = request.completedTasks.length;
  switch (request.tone) {
    case 'energizing':
      return wins > 0
        ? `${wins} finished today — that momentum is real.`
        : 'Nothing finished yet, and the day is still yours.';
    case 'gentle':
      return wins > 0
        ? `You closed ${wins} today. That was enough.`
        : 'A quiet day so far, and that is allowed.';
    case 'coaching':
      return wins > 0
        ? `${wins} done. Name the next one and you keep the streak.`
        : 'No completions yet — pick the smallest open loop and start there.';
    case 'bulleted':
      return wins > 0
        ? `Today: ${wins} completed, ${request.focusMinutesTotal}m focused.`
        : `Today: nothing completed yet, ${request.focusMinutesTotal}m focused.`;
  }
}

function stubReflections(request: DailySummaryRequest): string {
  const entries = request.journalEntries;
  if (entries.length === 0) return 'No journal entries today — nothing to reflect back yet.';
  const noun = entries.length === 1 ? '1 entry' : `${entries.length} entries`;
  const dominant = entries.find((e) => e.energyLevel !== undefined)?.energyLevel;
  if (dominant === undefined) return `${noun} written today.`;
  return `${noun} written today, energy running ${dominant}.`;
}

function stubFocusInsight(request: DailySummaryRequest): string {
  const minutes = request.focusMinutesTotal;
  if (minutes <= 0) return 'No focus sprints logged today — even five minutes would count.';
  return `${minutes} minute${minutes === 1 ? '' : 's'} of focused work today.`;
}

function stubKickstart(request: DailySummaryRequest): string[] {
  const steps: string[] = [];
  const next = request.inProgressTasks[0];
  if (next) steps.push(`Start with ${next.title} — smallest possible first move.`);
  if (request.capturesCount > 0) {
    const noun = request.capturesCount === 1 ? '1 capture' : `${request.capturesCount} captures`;
    steps.push(`Triage ${noun} waiting in the inbox.`);
  }
  if (steps.length === 0)
    steps.push('Add one small task tonight so tomorrow starts with a target.');
  return steps;
}

// MARK: - Clipboard

/** `DailySummaryCopyFormatter`: empty list sections are dropped, not left as a bare header. */
export function dailySummaryCopyText(
  content: DailySummaryContent,
  on: Date,
  locale?: string,
): string {
  const day = on.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [`✨ ADHD LifeOS Daily Summary (${day})`, content.headline];
  if (content.dopamineWins.length > 0) {
    lines.push('\n🏆 Dopamine Wins:', ...content.dopamineWins.map((w) => `• ${w}`));
  }
  lines.push('\n💭 Reflections:', content.journalReflections);
  lines.push('\n⚡ Focus & Stamina:', content.focusStaminaInsight);
  if (content.gentleTomorrowKickstart.length > 0) {
    lines.push(
      "\n🚀 Tomorrow's Kickstart:",
      ...content.gentleTomorrowKickstart.map((s) => `• ${s}`),
    );
  }
  return lines.join('\n');
}

// MARK: - The Daily Highlight line shown before anything is generated

export function dailySummaryHeadline(counts: {
  readonly openTasks: number;
  readonly lifeAreas: number;
  readonly inbox: number;
  readonly dueNudges: number;
}): string {
  const { openTasks, lifeAreas, inbox, dueNudges } = counts;
  if (dueNudges > 0) {
    const noun = dueNudges === 1 ? '1 nudge is' : `${dueNudges} nudges are`;
    return `${noun} due — a tiny step right now counts.`;
  }
  if (inbox > 0) {
    const phrase =
      inbox === 1 ? '1 idea captured — triage it' : `${inbox} ideas captured — triage one`;
    return `${phrase} to clear your head.`;
  }
  if (openTasks === 0) return 'A clean slate today. Add one small task to build momentum.';
  const tasks = openTasks === 1 ? '1 open task' : `${openTasks} open tasks`;
  const areas = lifeAreas === 1 ? '1 area' : `${lifeAreas} areas`;
  return `${tasks} across ${areas} — start with the smallest one.`;
}

// MARK: - The endpoint's answer

export type DailySummaryEndpointErrorKind =
  'notSignedIn' | 'notConfigured' | 'unauthorized' | 'server' | 'badResponse';

const ENDPOINT_MESSAGES: Record<Exclude<DailySummaryEndpointErrorKind, 'server'>, string> = {
  notSignedIn: "You're signed out — sign in to generate a summary.",
  notConfigured: "The summary service isn't configured yet.",
  unauthorized: 'Your session expired. Sign out and back in, then try again.',
  badResponse: "The summary came back in a shape the app couldn't read.",
};

export class DailySummaryEndpointError extends Error {
  readonly kind: DailySummaryEndpointErrorKind;

  constructor(kind: DailySummaryEndpointErrorKind, serverMessage?: string) {
    super(kind === 'server' ? (serverMessage ?? '') : ENDPOINT_MESSAGES[kind]);
    this.name = 'DailySummaryEndpointError';
    this.kind = kind;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function parseContent(raw: unknown): DailySummaryContent | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const {
    headline,
    dopamineWins,
    journalReflections,
    focusStaminaInsight,
    gentleTomorrowKickstart,
  } = o;
  if (
    typeof headline !== 'string' ||
    !isStringArray(dopamineWins) ||
    typeof journalReflections !== 'string' ||
    typeof focusStaminaInsight !== 'string' ||
    !isStringArray(gentleTomorrowKickstart)
  )
    return undefined;
  return {
    headline,
    dopamineWins,
    journalReflections,
    focusStaminaInsight,
    gentleTomorrowKickstart,
  };
}

/**
 * `FirebaseDailySummaryGenerator.decode`: a non-2xx is `unauthorized` at 401, else the envelope's
 * `error` or a message naming the status; a 2xx without `success: true` and a whole `summary` is a
 * bad response.
 */
export function decodeDailySummaryResponse(status: number, bodyText: string): DailySummaryContent {
  let envelope: Record<string, unknown> | undefined;
  try {
    envelope = asRecord(JSON.parse(bodyText));
  } catch {
    envelope = undefined;
  }
  if (status < 200 || status >= 300) {
    if (status === 401) throw new DailySummaryEndpointError('unauthorized');
    const message = envelope?.['error'];
    throw new DailySummaryEndpointError(
      'server',
      typeof message === 'string' ? message : `The summary service returned an error (${status}).`,
    );
  }
  const content = envelope?.['success'] === true ? parseContent(envelope['summary']) : undefined;
  if (!content) throw new DailySummaryEndpointError('badResponse');
  return content;
}

// MARK: - The remembered snapshot (per account; only today's summary restores)

export const DAILY_SUMMARY_SNAPSHOT_VERSION = 1;
export const DAILY_SUMMARY_SNAPSHOT_KEY = 'home.dailySummary.snapshot';

export interface DailySummarySnapshot {
  readonly version: number;
  readonly userId: string | null;
  readonly tone: DailySummaryTone;
  readonly summary: GeneratedDailySummary | null;
}

/** Nobody owns an unattributed snapshot, and a signed-out scope owns nothing. */
export function snapshotBelongsTo(snapshot: DailySummarySnapshot, userId: string | null): boolean {
  return snapshot.userId !== null && userId !== null && snapshot.userId === userId;
}

export function snapshotSummaryOn(
  snapshot: DailySummarySnapshot,
  date: Date,
): GeneratedDailySummary | null {
  const summary = snapshot.summary;
  return summary && isSameDay(summary.generatedAt, date) ? summary : null;
}

export function serializeDailySummarySnapshot(snapshot: DailySummarySnapshot): string {
  return JSON.stringify({
    ...snapshot,
    summary: snapshot.summary
      ? { ...snapshot.summary, generatedAt: snapshot.summary.generatedAt.toISOString() }
      : null,
  });
}

function parseGenerated(raw: unknown): GeneratedDailySummary | null | undefined {
  if (raw === null || raw === undefined) return null;
  const o = asRecord(raw);
  const content = parseContent(o?.['content']);
  const generatedAt = typeof o?.['generatedAt'] === 'string' ? new Date(o['generatedAt']) : null;
  const source = o?.['source'];
  if (
    !content ||
    !isDailySummaryTone(o?.['tone']) ||
    !generatedAt ||
    Number.isNaN(generatedAt.getTime()) ||
    (source !== 'model' && source !== 'localSynthesis')
  )
    return undefined;
  return { content, tone: o['tone'], generatedAt, source };
}

/** `UserDefaultsDailySummaryStore.read`: an unknown version or corrupt data reads as nothing. */
export function parseDailySummarySnapshot(
  text: string | null | undefined,
): DailySummarySnapshot | null {
  if (!text) return null;
  try {
    const o = asRecord(JSON.parse(text));
    if (!o || o['version'] !== DAILY_SUMMARY_SNAPSHOT_VERSION || !isDailySummaryTone(o['tone']))
      return null;
    const userId = typeof o['userId'] === 'string' ? o['userId'] : null;
    const summary = parseGenerated(o['summary']);
    if (summary === undefined) return null;
    return { version: DAILY_SUMMARY_SNAPSHOT_VERSION, userId, tone: o['tone'], summary };
  } catch {
    return null;
  }
}
