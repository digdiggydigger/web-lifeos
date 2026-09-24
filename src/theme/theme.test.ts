import { beforeEach, describe, expect, it } from 'vitest';

import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  initAppearance,
  parseAppearance,
  readAppearance,
  setAppearance,
  writeAppearance,
} from './theme';

describe('parseAppearance', () => {
  it('accepts the three iOS raw values and falls back to system for anything else', () => {
    expect(parseAppearance('light')).toBe('light');
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('system')).toBe('system');
    expect(parseAppearance('Dark')).toBe('system');
    expect(parseAppearance(null)).toBe('system');
    expect(parseAppearance(42)).toBe('system');
  });
});

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the same storage key as the iOS AppearancePreference', () => {
    expect(APPEARANCE_STORAGE_KEY).toBe('settings.appearance');
  });

  it('round-trips light and dark, and removes the key for system', () => {
    writeAppearance('dark');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(readAppearance()).toBe('dark');

    writeAppearance('system');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
    expect(readAppearance()).toBe('system');
  });

  it('reads system when storage is unavailable', () => {
    expect(readAppearance(undefined)).toBe('system');
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readAppearance(throwing)).toBe('system');
  });
});

describe('applyAppearance', () => {
  it('sets data-theme for an override and removes it for system', () => {
    const root = document.createElement('html');
    applyAppearance('dark', root);
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyAppearance('light', root);
    expect(root.getAttribute('data-theme')).toBe('light');
    applyAppearance('system', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('initAppearance applies what was stored', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light');
    expect(initAppearance()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    setAppearance('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
