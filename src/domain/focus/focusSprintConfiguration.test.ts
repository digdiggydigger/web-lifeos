import { describe, expect, it } from 'vitest';

import {
  clampDuration,
  clampNudgeCount,
  resolvedDuration,
  resolvedNudgeCount,
} from './focusSprintConfiguration';

describe('focus sprint configuration', () => {
  it('clamps the duration to 30 s – 7200 s and defaults to 15 minutes', () => {
    expect(clampDuration(4)).toBe(30);
    expect(clampDuration(99_999)).toBe(7200);
    expect(resolvedDuration(undefined)).toBe(900);
    expect(resolvedDuration(undefined, 60)).toBe(60);
    expect(resolvedDuration(300)).toBe(300);
  });

  it('clamps nudges to 0–10 and resolves the standard count from the duration', () => {
    expect(clampNudgeCount(99)).toBe(10);
    expect(clampNudgeCount(-1)).toBe(0);
    expect(resolvedNudgeCount(undefined, 60)).toBe(1);
    expect(resolvedNudgeCount(undefined, 61)).toBe(2);
    expect(resolvedNudgeCount(5, 900)).toBe(5);
  });
});
