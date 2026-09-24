/**
 * `Home/MomentumPreferences.swift`: the local preference set, one JSON blob under the same key the
 * phone uses in UserDefaults (the two stores never meet). Missing keys read as their defaults so a
 * blob from an earlier build keeps its choices.
 */
export interface MomentumPreferences {
  readonly dailyGoal: number;
  readonly showStreaks: boolean;
  readonly countClearedCaptures: boolean;
  readonly countNudges: boolean;
  readonly showCharts: boolean;
  readonly focusDailyGoalMinutes: number;
  readonly defaultSprintMinutes: number;
  readonly hapticsEnabled: boolean;
  readonly soundEnabled: boolean;
  readonly locationTaggingEnabled: boolean;
  readonly arrivalNudgesEnabled: boolean;
  readonly celebrationsEnabled: boolean;
  readonly celebrationSoundsEnabled: boolean;
}

export const GOAL_RANGE = { min: 1, max: 12 } as const;
export const FOCUS_GOAL_RANGE = { min: 10, max: 120 } as const;
export const SPRINT_MINUTES_RANGE = { min: 5, max: 120 } as const;
export const PREFERENCES_STORAGE_KEY = 'settings.momentum.preferences';

export const DEFAULT_PREFERENCES: MomentumPreferences = {
  dailyGoal: 5,
  showStreaks: true,
  countClearedCaptures: false,
  countNudges: false,
  showCharts: true,
  focusDailyGoalMinutes: 30,
  defaultSprintMinutes: 15,
  hapticsEnabled: true,
  soundEnabled: true,
  locationTaggingEnabled: true,
  arrivalNudgesEnabled: true,
  celebrationsEnabled: true,
  celebrationSoundsEnabled: false,
};

function clamp(value: number, range: { readonly min: number; readonly max: number }): number {
  return Math.min(Math.max(value, range.min), range.max);
}

export function normalizePreferences(p: MomentumPreferences): MomentumPreferences {
  return {
    ...p,
    dailyGoal: clamp(p.dailyGoal, GOAL_RANGE),
    focusDailyGoalMinutes: clamp(p.focusDailyGoalMinutes, FOCUS_GOAL_RANGE),
    defaultSprintMinutes: clamp(p.defaultSprintMinutes, SPRINT_MINUTES_RANGE),
  };
}

function int(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** `dailyGoal` and `showStreaks` are required (the first build's shape); everything later defaults. */
export function decodePreferences(raw: unknown): MomentumPreferences | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o['dailyGoal'] !== 'number' || typeof o['showStreaks'] !== 'boolean') return undefined;
  const d = DEFAULT_PREFERENCES;
  return {
    dailyGoal: int(o['dailyGoal'], d.dailyGoal),
    showStreaks: bool(o['showStreaks'], d.showStreaks),
    countClearedCaptures: bool(o['countClearedCaptures'], d.countClearedCaptures),
    countNudges: bool(o['countNudges'], d.countNudges),
    showCharts: bool(o['showCharts'], d.showCharts),
    focusDailyGoalMinutes: int(o['focusDailyGoalMinutes'], d.focusDailyGoalMinutes),
    defaultSprintMinutes: int(o['defaultSprintMinutes'], d.defaultSprintMinutes),
    hapticsEnabled: bool(o['hapticsEnabled'], d.hapticsEnabled),
    soundEnabled: bool(o['soundEnabled'], d.soundEnabled),
    locationTaggingEnabled: bool(o['locationTaggingEnabled'], d.locationTaggingEnabled),
    arrivalNudgesEnabled: bool(o['arrivalNudgesEnabled'], d.arrivalNudgesEnabled),
    celebrationsEnabled: bool(o['celebrationsEnabled'], d.celebrationsEnabled),
    celebrationSoundsEnabled: bool(o['celebrationSoundsEnabled'], d.celebrationSoundsEnabled),
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** `UserDefaultsMomentumPreferencesStore.read`: empty or corrupt reads as the defaults; what it finds is normalised. */
export function readPreferences(storage: StorageLike | undefined): MomentumPreferences {
  try {
    const text = storage?.getItem(PREFERENCES_STORAGE_KEY);
    if (!text) return DEFAULT_PREFERENCES;
    const decoded = decodePreferences(JSON.parse(text));
    return decoded ? normalizePreferences(decoded) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(storage: StorageLike | undefined, p: MomentumPreferences): void {
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(p)));
  } catch {
    // Storage can be unavailable; the in-memory value still applies for the session.
  }
}

export function goalLabel(goal: number): string {
  return `${goal} ${goal === 1 ? 'item' : 'items'}`;
}
