/**
 * The app's one celebration centre. Owned by the app rather than by a signed-in screen, as on iOS,
 * so an auth-state swap never drops what is in the air.
 */
import type { Point } from '@/domain/celebrations';
import { preferencesStore } from '@/features/settings/preferencesStore';

import { createCelebrationCenter } from './celebrationCenter';
import { createWebAudioChime } from './celebrationChime';

/** Epoch milliseconds with sub-millisecond precision, so the choreography clock never steps. */
export function celebrationNow(): number {
  return performance.timeOrigin + performance.now();
}

/**
 * Whether a modal the centre was never told about is up. Every modal on the web is a native
 * `<dialog>` opened with `showModal()`, which sits in the top layer above any z-index, so one query
 * is the whole search (the web equivalent of iOS's key-window probe).
 */
export function anyDialogOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null;
}

const chime = createWebAudioChime(
  () => preferencesStore.getState().preferences.celebrationSoundsEnabled,
);

export const celebrations = createCelebrationCenter({
  now: celebrationNow,
  celebrationsGate: () => preferencesStore.getState().preferences.celebrationsEnabled,
  chime: () => chime.play(),
  // No haptics in a browser. The seam stays so the daily goal's rule is still the centre's.
  feel: () => undefined,
  probe: anyDialogOpen,
});

/** The centre of `element` in viewport coordinates — where a pop leaves from. */
export function centreOf(element: Element | null | undefined): Point | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The in-place pop from the control that was pressed. Call AFTER the action has landed. */
export function popFrom(element: Element | null | undefined): void {
  celebrations.request({ kind: 'pop' }, centreOf(element));
}
