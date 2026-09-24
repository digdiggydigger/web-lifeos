import { describe, expect, it } from 'vitest';

import {
  effortChoiceSeconds,
  effortChoiceTitle,
  STANDARD_EFFORT_CHOICE,
  TASK_EFFORT_CHOICES,
} from './taskEffortChoice';

describe('TaskEffortChoice', () => {
  it('offers the three values the fan already had, defaulting to fifteen', () => {
    expect(TASK_EFFORT_CHOICES.map(effortChoiceTitle)).toEqual(['15 min', '30 min', '1 hr']);
    expect(TASK_EFFORT_CHOICES.map(effortChoiceSeconds)).toEqual([900, 1800, 3600]);
    expect(STANDARD_EFFORT_CHOICE).toBe('fifteen');
  });
});
