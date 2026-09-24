/**
 * `PersistedFocusSprint` (`Focus/FocusSprintPersistence.swift`) and the JSON the browser keeps it in.
 * The keys are the iOS Codable ones; dates travel as ISO strings.
 */
import type { CompletedFocusSession } from '@/domain/types';

import type { FocusNudgeCadence } from './focusCheckpoints';
import { newFocusSession } from './focusSession';
import type { FocusSession } from './focusSession';

export interface PersistedFocusSprint {
  readonly taskId: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly durationSeconds: number;
  readonly nudgeCheckpoints: readonly number[];
  readonly triggeredCheckpointIndices: readonly number[];
  readonly startedAt: Date;
  readonly deadline: Date | undefined;
  readonly pausedRemainingSeconds: number | undefined;
  readonly cadenceCount: number | undefined;
  readonly cadenceIntervalSeconds: number | undefined;
}

export const FOCUS_STORAGE_KEYS = {
  running: 'focus.sprint.running',
  unacknowledgedCompletion: 'focus.sprint.unacknowledgedCompletion',
  cardCollapsed: 'focus.card.collapsed',
  unconfirmedCompletions: 'focus.sprint.unconfirmedCompletions',
} as const;

export function persistedCadence(state: PersistedFocusSprint): FocusNudgeCadence {
  if (state.cadenceIntervalSeconds !== undefined)
    return { kind: 'interval', seconds: state.cadenceIntervalSeconds };
  return { kind: 'count', count: state.cadenceCount ?? 1 };
}

export function persistedSprint(
  session: FocusSession,
  startedAt: Date,
  deadline: Date | undefined,
  cadence: FocusNudgeCadence,
): PersistedFocusSprint {
  return {
    taskId: session.taskId,
    taskTitle: session.taskTitle,
    lifeAreaEmoji: session.lifeAreaEmoji,
    durationSeconds: session.durationSeconds,
    nudgeCheckpoints: [...session.nudgeCheckpoints],
    triggeredCheckpointIndices: [...session.triggeredCheckpointIndices].sort((a, b) => a - b),
    startedAt,
    deadline: session.isPaused ? undefined : deadline,
    pausedRemainingSeconds: session.isPaused ? session.remainingSeconds : undefined,
    cadenceCount: cadence.kind === 'count' ? cadence.count : undefined,
    cadenceIntervalSeconds: cadence.kind === 'interval' ? cadence.seconds : undefined,
  };
}

export function sessionFromPersisted(state: PersistedFocusSprint): FocusSession {
  return newFocusSession({
    taskId: state.taskId,
    taskTitle: state.taskTitle,
    lifeAreaEmoji: state.lifeAreaEmoji,
    durationSeconds: state.durationSeconds,
    remainingSeconds: state.pausedRemainingSeconds ?? state.durationSeconds,
    isPaused: state.deadline === undefined,
    nudgeCheckpoints: state.nudgeCheckpoints,
    triggeredCheckpointIndices: state.triggeredCheckpointIndices,
  });
}

type Json = Record<string, unknown>;

function isoOrUndefined(date: Date | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function dateFrom(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compact(object: Json): Json {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));
}

export function serializePersistedSprint(state: PersistedFocusSprint): string {
  return JSON.stringify(
    compact({
      ...state,
      startedAt: state.startedAt.toISOString(),
      deadline: isoOrUndefined(state.deadline),
    }),
  );
}

export function parsePersistedSprint(
  text: string | null | undefined,
): PersistedFocusSprint | undefined {
  if (!text) return undefined;
  try {
    const raw = JSON.parse(text) as Json;
    const startedAt = dateFrom(raw['startedAt']);
    const durationSeconds = numberFrom(raw['durationSeconds']);
    if (!startedAt || durationSeconds === undefined || typeof raw['taskTitle'] !== 'string')
      return undefined;
    const numbers = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [];
    return {
      taskId: typeof raw['taskId'] === 'string' ? raw['taskId'] : undefined,
      taskTitle: raw['taskTitle'],
      lifeAreaEmoji: typeof raw['lifeAreaEmoji'] === 'string' ? raw['lifeAreaEmoji'] : '🎯',
      durationSeconds,
      nudgeCheckpoints: numbers(raw['nudgeCheckpoints']),
      triggeredCheckpointIndices: numbers(raw['triggeredCheckpointIndices']),
      startedAt,
      deadline: dateFrom(raw['deadline']),
      pausedRemainingSeconds: numberFrom(raw['pausedRemainingSeconds']),
      cadenceCount: numberFrom(raw['cadenceCount']),
      cadenceIntervalSeconds: numberFrom(raw['cadenceIntervalSeconds']),
    };
  } catch {
    return undefined;
  }
}

export function serializeCompletedSessions(records: readonly CompletedFocusSession[]): string {
  return JSON.stringify(
    records.map((r) =>
      compact({
        ...r,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt.toISOString(),
        confirmedAt: isoOrUndefined(r.confirmedAt),
      }),
    ),
  );
}

export function parseCompletedSessions(text: string | null | undefined): CompletedFocusSession[] {
  if (!text) return [];
  try {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return [];
    const records: CompletedFocusSession[] = [];
    for (const item of raw as Json[]) {
      const startedAt = dateFrom(item['startedAt']);
      const endedAt = dateFrom(item['endedAt']);
      if (
        typeof item['id'] !== 'string' ||
        typeof item['taskTitle'] !== 'string' ||
        !startedAt ||
        !endedAt
      )
        continue;
      const confirmedAt = dateFrom(item['confirmedAt']);
      records.push({
        id: item['id'],
        taskTitle: item['taskTitle'],
        lifeAreaEmoji: typeof item['lifeAreaEmoji'] === 'string' ? item['lifeAreaEmoji'] : '🎯',
        plannedSeconds: numberFrom(item['plannedSeconds']) ?? 0,
        focusedSeconds: numberFrom(item['focusedSeconds']) ?? 0,
        checkpointsReached: numberFrom(item['checkpointsReached']) ?? 0,
        completedNaturally: item['completedNaturally'] === true,
        startedAt,
        endedAt,
        ...(typeof item['taskId'] === 'string' ? { taskId: item['taskId'] } : {}),
        ...(typeof item['placeId'] === 'string' ? { placeId: item['placeId'] } : {}),
        ...(numberFrom(item['latitude']) !== undefined
          ? { latitude: numberFrom(item['latitude'])! }
          : {}),
        ...(numberFrom(item['longitude']) !== undefined
          ? { longitude: numberFrom(item['longitude'])! }
          : {}),
        ...(confirmedAt ? { confirmedAt } : {}),
      });
    }
    return records;
  } catch {
    return [];
  }
}
