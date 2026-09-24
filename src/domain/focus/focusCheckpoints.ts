/** `FocusCheckpoints` and `FocusNudgeCadence` (`Focus/FocusModels.swift`, `FocusNudgeCadence.swift`). */

export const MINIMUM_CHECKPOINT_INTERVAL_SECONDS = 30;
export const MINIMUM_DURATION_FOR_CHECKPOINTS = 10;

export function evenlySpacedCheckpoints(durationSeconds: number, count: number): number[] {
  if (count <= 0 || durationSeconds < MINIMUM_DURATION_FOR_CHECKPOINTS) return [];
  const segment = durationSeconds / (count + 1);
  const checkpoints: number[] = [];
  for (let step = 1; step <= count; step += 1) {
    const elapsed = Math.round(segment * step);
    if (elapsed > 0 && elapsed < durationSeconds && !checkpoints.includes(elapsed))
      checkpoints.push(elapsed);
  }
  return checkpoints.sort((a, b) => a - b);
}

export function intervalCheckpoints(durationSeconds: number, intervalSeconds: number): number[] {
  const safe = Math.max(MINIMUM_CHECKPOINT_INTERVAL_SECONDS, intervalSeconds);
  if (durationSeconds <= 0) return [];
  const checkpoints: number[] = [];
  for (let mark = safe; mark < durationSeconds; mark += safe) checkpoints.push(mark);
  return checkpoints;
}

/** Keeps the marks already heard (as the leading prefix) and re-spaces only what is still ahead. */
export function replannedCheckpoints(
  existing: readonly number[],
  triggeredIndices: ReadonlySet<number>,
  proposed: readonly number[],
  elapsedSeconds: number,
): { checkpoints: number[]; triggeredIndices: Set<number> } {
  const kept = existing.filter((_, index) => triggeredIndices.has(index)).sort((a, b) => a - b);
  const upcoming = proposed.filter((mark) => mark > elapsedSeconds).sort((a, b) => a - b);
  return { checkpoints: [...kept, ...upcoming], triggeredIndices: new Set(kept.map((_, i) => i)) };
}

export type FocusNudgeCadence =
  | { readonly kind: 'count'; readonly count: number }
  | { readonly kind: 'interval'; readonly seconds: number };

export const STANDARD_SPRINT_SECONDS = 15 * 60;

/** A sprint of a minute or less gets one nudge, longer ones two (the web rule both clients share). */
export function standardCadenceCount(durationSeconds: number): number {
  return durationSeconds <= 60 ? 1 : 2;
}

export function standardCadence(durationSeconds: number): FocusNudgeCadence {
  return { kind: 'count', count: standardCadenceCount(durationSeconds) };
}

export function cadenceCheckpoints(cadence: FocusNudgeCadence, durationSeconds: number): number[] {
  return cadence.kind === 'count'
    ? evenlySpacedCheckpoints(durationSeconds, cadence.count)
    : intervalCheckpoints(durationSeconds, cadence.seconds);
}

export function sameCadence(a: FocusNudgeCadence, b: FocusNudgeCadence): boolean {
  return a.kind === 'count'
    ? b.kind === 'count' && a.count === b.count
    : b.kind === 'interval' && a.seconds === b.seconds;
}
