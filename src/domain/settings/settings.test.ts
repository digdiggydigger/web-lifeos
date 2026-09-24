// Ports of MomentumPreferencesTests, AppearancePreferenceTests (the parse half lives in theme) and the deletion model.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  decodePreferences,
  deletionProgressText,
  FOCUS_GOAL_RANGE,
  formatAbout,
  goalLabel,
  isDeletionBusy,
  normalizePreferences,
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  SPRINT_MINUTES_RANGE,
  writePreferences,
} from './index';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe('MomentumPreferences', () => {
  it('defaults match the seed; normalize clamps the goal and the two steppers and keeps the switches', () => {
    expect(DEFAULT_PREFERENCES.dailyGoal).toBe(5);
    expect(DEFAULT_PREFERENCES.showStreaks).toBe(true);
    expect(DEFAULT_PREFERENCES.countClearedCaptures).toBe(false);
    expect(DEFAULT_PREFERENCES.countNudges).toBe(false);
    expect(DEFAULT_PREFERENCES.showCharts).toBe(true);
    expect(DEFAULT_PREFERENCES.focusDailyGoalMinutes).toBe(30);
    expect(DEFAULT_PREFERENCES.defaultSprintMinutes).toBe(15);
    expect(DEFAULT_PREFERENCES.celebrationsEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.celebrationSoundsEnabled).toBe(false);
    expect(normalizePreferences({ ...DEFAULT_PREFERENCES, dailyGoal: 0 }).dailyGoal).toBe(1);
    expect(normalizePreferences({ ...DEFAULT_PREFERENCES, dailyGoal: 99 }).dailyGoal).toBe(12);
    expect(normalizePreferences({ ...DEFAULT_PREFERENCES, dailyGoal: 7 }).dailyGoal).toBe(7);
    const n = normalizePreferences({
      ...DEFAULT_PREFERENCES,
      focusDailyGoalMinutes: 999,
      defaultSprintMinutes: 0,
      locationTaggingEnabled: false,
      arrivalNudgesEnabled: false,
    });
    expect(n.focusDailyGoalMinutes).toBe(FOCUS_GOAL_RANGE.max);
    expect(n.defaultSprintMinutes).toBe(SPRINT_MINUTES_RANGE.min);
    expect(n.locationTaggingEnabled).toBe(false);
    expect(n.arrivalNudgesEnabled).toBe(false);
  });
  it('legacy blobs keep their choices and gain the defaults for missing keys', () => {
    const legacy = decodePreferences({ dailyGoal: 8, showStreaks: false });
    expect(legacy).toMatchObject({
      dailyGoal: 8,
      showStreaks: false,
      countClearedCaptures: false,
      countNudges: false,
      showCharts: true,
      focusDailyGoalMinutes: 30,
      defaultSprintMinutes: 15,
      hapticsEnabled: true,
      soundEnabled: true,
      arrivalNudgesEnabled: true,
    });
    const m7 = decodePreferences({ dailyGoal: 8, showStreaks: false, countClearedCaptures: true });
    expect(m7).toMatchObject({ countClearedCaptures: true, countNudges: false });
    const m9 = decodePreferences({
      dailyGoal: 8,
      showStreaks: false,
      countClearedCaptures: true,
      countNudges: true,
    });
    expect(m9?.showCharts).toBe(true);
    expect(decodePreferences({ showStreaks: true })).toBeUndefined();
    expect(decodePreferences('nope')).toBeUndefined();
  });
  it('the store round-trips, reads empty and corrupt as the defaults, and normalises what it finds', () => {
    const storage = new MemoryStorage();
    expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    const prefs = { ...DEFAULT_PREFERENCES, dailyGoal: 8, showStreaks: false };
    writePreferences(storage, prefs);
    expect(readPreferences(storage)).toEqual(prefs);
    storage.setItem(PREFERENCES_STORAGE_KEY, 'not json');
    expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ dailyGoal: 0, showStreaks: true }));
    expect(readPreferences(storage).dailyGoal).toBe(1);
    expect(readPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(goalLabel(1)).toBe('1 item');
    expect(goalLabel(5)).toBe('5 items');
  });
});

describe('account deletion model', () => {
  it('busy phases and progress text', () => {
    expect(isDeletionBusy({ kind: 'idle' })).toBe(false);
    expect(isDeletionBusy({ kind: 'reauthRequired', method: 'password' })).toBe(false);
    expect(isDeletionBusy({ kind: 'completed' })).toBe(false);
    expect(isDeletionBusy({ kind: 'deletingData' })).toBe(true);
    expect(deletionProgressText({ kind: 'deletingData' })).toBe('Deleting your data…');
    expect(deletionProgressText({ kind: 'deletingAccount' })).toBe('Removing your account…');
    expect(deletionProgressText({ kind: 'reauthenticating' })).toBe("Confirming it's you…");
    expect(deletionProgressText({ kind: 'idle' })).toBeUndefined();
    expect(formatAbout('0.1.0', '42')).toBe('0.1.0 (42)');
    expect(formatAbout(undefined, undefined)).toBe('— (—)');
  });
});
