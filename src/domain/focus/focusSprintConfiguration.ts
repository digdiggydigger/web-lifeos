/** The sprint numbers the Tasks logic depends on (`Focus/FocusSprintConfiguration.swift`, `FocusNudgeCadence`). */

export const MINIMUM_DURATION_SECONDS = 30;
export const MAXIMUM_DURATION_SECONDS = 7200;
export const DEFAULT_DURATION_SECONDS = 900;
export const MAXIMUM_NUDGE_COUNT = 10;
export const PRESET_DURATIONS_SECONDS: readonly number[] = [30, 60, 120, 300, 600, 900, 1500];

export function clampDuration(seconds: number): number {
  return Math.min(Math.max(seconds, MINIMUM_DURATION_SECONDS), MAXIMUM_DURATION_SECONDS);
}

export function resolvedDuration(
  explicit: number | undefined,
  defaultSeconds = DEFAULT_DURATION_SECONDS,
): number {
  return clampDuration(explicit ?? defaultSeconds);
}

export function clampNudgeCount(count: number): number {
  return Math.min(Math.max(count, 0), MAXIMUM_NUDGE_COUNT);
}

/** `FocusNudgeCadence.standardCount`: a sprint of a minute or less gets one nudge, longer ones two. */
export function standardNudgeCount(durationSeconds: number): number {
  return durationSeconds <= 60 ? 1 : 2;
}

export function resolvedNudgeCount(explicit: number | undefined, durationSeconds: number): number {
  return explicit === undefined ? standardNudgeCount(durationSeconds) : clampNudgeCount(explicit);
}
