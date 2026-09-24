import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, isSameDay, startOfDay } from './calendar';

describe('calendar', () => {
  it('starts the day at local midnight and adds whole days', () => {
    const noon = new Date(2026, 7, 14, 12, 30);
    expect(startOfDay(noon)).toEqual(new Date(2026, 7, 14));
    expect(addDays(noon, 1)).toEqual(new Date(2026, 7, 15, 12, 30));
    expect(addDays(noon, -2)).toEqual(new Date(2026, 7, 12, 12, 30));
  });

  it('compares and counts by calendar day, not by 24-hour windows', () => {
    expect(isSameDay(new Date(2026, 7, 14, 0, 1), new Date(2026, 7, 14, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 7, 14, 23, 59), new Date(2026, 7, 15, 0, 1))).toBe(false);
    expect(daysBetween(new Date(2026, 7, 12, 23), new Date(2026, 7, 14, 1))).toBe(2);
    expect(daysBetween(new Date(2026, 7, 14, 9), new Date(2026, 7, 14, 23))).toBe(0);
  });
});
