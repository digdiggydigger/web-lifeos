/** `Home/DailyGoalTracker.swift`: a rise across the goal counts once, never on the first observation or a rule change. */

export interface DailyGoalRules {
  readonly goal: number;
  readonly countsClearedCaptures: boolean;
  readonly countsNudges: boolean;
}

export function dailyGoalCrossed(previous: number, current: number, goal: number): boolean {
  return goal > 0 && previous < goal && current >= goal;
}

function sameRules(a: DailyGoalRules | undefined, b: DailyGoalRules): boolean {
  return (
    a !== undefined &&
    a.goal === b.goal &&
    a.countsClearedCaptures === b.countsClearedCaptures &&
    a.countsNudges === b.countsNudges
  );
}

export interface DailyGoalTracker {
  /** Returns true exactly when a settled count rises across the goal under unchanged rules. */
  observe(count: number, rules: DailyGoalRules, settled: boolean): boolean;
}

export function createDailyGoalTracker(): DailyGoalTracker {
  let previous: number | undefined;
  let rules: DailyGoalRules | undefined;
  return {
    observe(count, newRules, settled) {
      if (!settled) return false;
      const known = previous;
      const unchanged = sameRules(rules, newRules);
      previous = count;
      rules = newRules;
      if (known === undefined || !unchanged) return false;
      return dailyGoalCrossed(known, count, newRules.goal);
    },
  };
}

export function dailyGoalAnnouncement(count: number, goal: number): string {
  return `Daily goal reached — ${count} of ${goal} closed today`;
}
