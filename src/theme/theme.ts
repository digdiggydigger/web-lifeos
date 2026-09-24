/**
 * Appearance override, mirroring the iOS `AppearancePreference` (Settings/AppearancePreference.swift):
 * three raw values under the same storage key. `system` follows the OS; the other two force it.
 */
export type Appearance = 'system' | 'light' | 'dark';

export const APPEARANCES: readonly Appearance[] = ['system', 'light', 'dark'];

/** Same key the iOS app uses in UserDefaults, kept for symmetry (the two stores never meet). */
export const APPEARANCE_STORAGE_KEY = 'settings.appearance';

export function parseAppearance(raw: unknown): Appearance {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function appearanceLabel(appearance: Appearance): string {
  switch (appearance) {
    case 'system':
      return 'System';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
  }
}

/** `AppearancePreference.explanation`: the footer under the picker. */
export function appearanceExplanation(appearance: Appearance): string {
  switch (appearance) {
    case 'system':
      return 'Follows your device. The palette carries light and dark variants for every token.';
    case 'light':
      return 'Light for daylight. Area colours darken so labels stay readable.';
    case 'dark':
      return 'Dark by default — the closure green reads brightest against it.';
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readAppearance(storage: StorageLike | undefined = defaultStorage()): Appearance {
  try {
    return parseAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function writeAppearance(
  appearance: Appearance,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  try {
    if (appearance === 'system') {
      storage?.removeItem(APPEARANCE_STORAGE_KEY);
    } else {
      storage?.setItem(APPEARANCE_STORAGE_KEY, appearance);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked). The attribute below still applies.
  }
}

/** Applies the override to the document root; `system` removes the attribute entirely. */
export function applyAppearance(
  appearance: Appearance,
  root: HTMLElement | undefined = globalThis.document?.documentElement,
): void {
  if (!root) return;
  if (appearance === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', appearance);
  }
}

export function setAppearance(appearance: Appearance): void {
  writeAppearance(appearance);
  applyAppearance(appearance);
}

/** Read the stored preference and apply it. Call once before the first render to avoid a flash. */
export function initAppearance(): Appearance {
  const appearance = readAppearance();
  applyAppearance(appearance);
  return appearance;
}
