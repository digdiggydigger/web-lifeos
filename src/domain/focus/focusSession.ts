/** `FocusSession` (`Focus/FocusModels.swift`) as an immutable value with pure transitions. */
import { cadenceCheckpoints, replannedCheckpoints } from './focusCheckpoints';
import type { FocusNudgeCadence } from './focusCheckpoints';

export interface FocusSession {
  readonly taskId: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly durationSeconds: number;
  readonly remainingSeconds: number;
  readonly isPaused: boolean;
  readonly nudgeCheckpoints: readonly number[];
  readonly triggeredCheckpointIndices: ReadonlySet<number>;
}

export function newFocusSession(input: {
  readonly taskId?: string | undefined;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly durationSeconds: number;
  readonly remainingSeconds?: number;
  readonly isPaused?: boolean;
  readonly nudgeCheckpoints?: readonly number[];
  readonly triggeredCheckpointIndices?: Iterable<number>;
}): FocusSession {
  return {
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    lifeAreaEmoji: input.lifeAreaEmoji,
    durationSeconds: input.durationSeconds,
    remainingSeconds: input.remainingSeconds ?? input.durationSeconds,
    isPaused: input.isPaused ?? false,
    nudgeCheckpoints: input.nudgeCheckpoints ?? [],
    triggeredCheckpointIndices: new Set(input.triggeredCheckpointIndices ?? []),
  };
}

export function elapsedSeconds(session: FocusSession): number {
  return Math.max(0, session.durationSeconds - session.remainingSeconds);
}

export function sessionProgress(session: FocusSession): number {
  if (session.durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedSeconds(session) / session.durationSeconds));
}

export function isSessionComplete(session: FocusSession): boolean {
  return session.remainingSeconds <= 0;
}

export function nextCheckpoint(
  session: FocusSession,
): { index: number; atSeconds: number } | undefined {
  const elapsed = elapsedSeconds(session);
  let best: { index: number; atSeconds: number } | undefined;
  session.nudgeCheckpoints.forEach((mark, index) => {
    if (session.triggeredCheckpointIndices.has(index) || mark <= elapsed) return;
    if (!best || mark < best.atSeconds) best = { index, atSeconds: mark };
  });
  return best;
}

export function secondsUntilNextCheckpoint(session: FocusSession): number | undefined {
  const next = nextCheckpoint(session);
  return next ? Math.max(0, next.atSeconds - elapsedSeconds(session)) : undefined;
}

/** Moves the playhead and reports every checkpoint it crossed, each exactly once, ascending. */
export function advanceSession(
  session: FocusSession,
  newRemaining: number,
): { session: FocusSession; crossed: number[] } {
  const remainingSeconds = Math.max(0, Math.min(session.durationSeconds, newRemaining));
  const moved = { ...session, remainingSeconds };
  const elapsed = elapsedSeconds(moved);
  const crossed: number[] = [];
  session.nudgeCheckpoints.forEach((mark, index) => {
    if (!session.triggeredCheckpointIndices.has(index) && mark <= elapsed) crossed.push(index);
  });
  crossed.sort((a, b) => a - b);
  const triggered = new Set(session.triggeredCheckpointIndices);
  for (const index of crossed) triggered.add(index);
  return { session: { ...moved, triggeredCheckpointIndices: triggered }, crossed };
}

export function replanSession(session: FocusSession, cadence: FocusNudgeCadence): FocusSession {
  const replanned = replannedCheckpoints(
    session.nudgeCheckpoints,
    session.triggeredCheckpointIndices,
    cadenceCheckpoints(cadence, session.durationSeconds),
    elapsedSeconds(session),
  );
  return {
    ...session,
    nudgeCheckpoints: replanned.checkpoints,
    triggeredCheckpointIndices: replanned.triggeredIndices,
  };
}

export function checkpointPrompt(index: number, total: number): string {
  if (total === 1)
    return 'Midpoint check-in: take one grounding breath. Still on your single micro-step?';
  if (index === 0)
    return 'Flow calibration: check your posture, relax your shoulders, re-affirm the task.';
  if (index === total - 1)
    return "Final cadence: you're near the finish line — bring this to a clean close.";
  return `Checkpoint ${index + 1}: gentle reset. Keep momentum without context switching.`;
}
