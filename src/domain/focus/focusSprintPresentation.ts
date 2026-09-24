/** `FocusSprintPresentation`, `SprintRingGeometry`, the completion and offline summary lines, and the plan summary. */
import type { CompletedFocusSession } from '@/domain/types';

import { elapsedSeconds, nextCheckpoint } from './focusSession';
import type { FocusSession } from './focusSession';
import { digitalTime, humanSpan } from './focusTimeFormatting';

export interface ActiveSprintStatus {
  readonly taskId: string | undefined;
  readonly isPaused: boolean;
}

export type ActiveGoalSprintState = 'idle' | 'running' | 'paused';

export function activeGoalSprintState(
  taskId: string | undefined,
  sprint: ActiveSprintStatus | undefined,
): ActiveGoalSprintState {
  if (!taskId || !sprint || sprint.taskId !== taskId) return 'idle';
  return sprint.isPaused ? 'paused' : 'running';
}

export function sprintStateTitle(state: ActiveGoalSprintState): string {
  return { idle: 'Start Session', running: 'Session Active', paused: 'Session Paused' }[state];
}

export function sprintStateHint(state: ActiveGoalSprintState): string {
  return {
    idle: 'Starts a focus sprint for this task',
    running: 'Pauses the running sprint',
    paused: 'Resumes the paused sprint',
  }[state];
}

export type FocusCheckpointDotState = 'reached' | 'next' | 'pending';

export function checkpointDotState(index: number, session: FocusSession): FocusCheckpointDotState {
  if (session.triggeredCheckpointIndices.has(index)) return 'reached';
  return nextCheckpoint(session)?.index === index ? 'next' : 'pending';
}

export function pausedBadge(session: FocusSession): string | undefined {
  return session.isPaused ? 'Paused' : undefined;
}

export function focusBarAccessibilityLabel(session: FocusSession): string {
  const clock = digitalTime(session.remainingSeconds);
  return session.isPaused ? `Paused, ${clock} remaining` : `${clock} remaining`;
}

export const STOP_CONFIRMATION = {
  title: 'Stop this sprint?',
  confirm: 'Stop sprint',
  cancel: 'Keep going',
} as const;

export function stopConfirmationMessage(session: FocusSession): string {
  const elapsed = elapsedSeconds(session);
  if (elapsed < 60) return 'This sprint will end and nothing will be logged.';
  return `You've focused for ${humanSpan(elapsed)}. Stopping logs that and ends the sprint.`;
}

export function ringFraction(checkpoint: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, checkpoint / durationSeconds));
}

/** Clockwise from twelve, on a ring of `size`. */
export function ringDotCenter(
  checkpoint: number,
  durationSeconds: number,
  size: number,
): { x: number; y: number } {
  const radius = size / 2;
  const angle = ringFraction(checkpoint, durationSeconds) * 2 * Math.PI - Math.PI / 2;
  return { x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) };
}

export function completionSummaryLine(record: CompletedFocusSession): string {
  const focused = `${humanSpan(record.focusedSeconds)} focused`;
  if (record.checkpointsReached <= 0) return focused;
  return `${focused} · ${record.checkpointsReached === 1 ? '1 checkpoint' : `${record.checkpointsReached} checkpoints`}`;
}

export function offlineSummaryLine(record: CompletedFocusSession): string {
  const minutes = `${Math.floor(record.focusedSeconds / 60)} of ${Math.floor(record.plannedSeconds / 60)} minutes logged`;
  if (record.checkpointsReached <= 0) return minutes;
  return `${minutes} · ${record.checkpointsReached === 1 ? '1 checkpoint' : `${record.checkpointsReached} checkpoints`}`;
}

export function sprintPlanSummary(durationSeconds: number, nudgeCount: number): string {
  return `${humanSpan(durationSeconds)} sprint · ${nudgeCount === 1 ? '1 nudge' : `${nudgeCount} nudges`}`;
}

export const COLLAPSE_SWIPE_THRESHOLD = 24;

export function collapseSwipeOutcome(
  translation: number,
  isCollapsed: boolean,
): 'collapse' | 'expand' | 'none' {
  if (Math.abs(translation) < COLLAPSE_SWIPE_THRESHOLD) return 'none';
  if (translation > 0) return isCollapsed ? 'none' : 'collapse';
  return isCollapsed ? 'expand' : 'none';
}

/** A record with no `confirmedAt` is provisional: that is the whole meaning of the field. */
export function isProvisional(record: CompletedFocusSession): boolean {
  return record.confirmedAt === undefined;
}

export function confirmedRecord(record: CompletedFocusSession, at: Date): CompletedFocusSession {
  return { ...record, confirmedAt: at };
}
