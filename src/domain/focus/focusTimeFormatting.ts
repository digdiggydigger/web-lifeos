/** `FocusTimeFormatting`: the clock, the human span, and the hours-and-minutes duration. */

export function digitalTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function humanSpan(seconds: number): string {
  const clamped = Math.max(0, seconds);
  if (clamped < 60) return `${clamped}s`;
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

export function durationLabel(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
