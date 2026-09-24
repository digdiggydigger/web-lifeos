// Port of TaskListRefinementTests + TaskSearchCopy.
import { describe, expect, it } from 'vitest';

import type { Task } from '@/domain/types';

import { applySearch, searchResultCount } from './taskListRefinement';

const t = (title: string): Task => ({ id: title, title, status: 'open', priority: 'p3' });
const tasks = [t('Renew passport'), t('buy Milk'), t('Call the dentist')];

describe('applySearch', () => {
  it('is a case-insensitive title substring search', () => {
    expect(applySearch(tasks, 'MILK').map((x) => x.title)).toEqual(['buy Milk']);
    expect(applySearch(tasks, 'the').map((x) => x.title)).toEqual(['Call the dentist']);
  });
  it('matches everything for a blank query and preserves order', () => {
    expect(applySearch(tasks, '   ')).toEqual(tasks);
    expect(applySearch(tasks, 'e').map((x) => x.title)).toEqual([
      'Renew passport',
      'Call the dentist',
    ]);
  });
  it('counts results', () => {
    expect(searchResultCount(1)).toBe('1 match');
    expect(searchResultCount(3)).toBe('3 matches');
    expect(searchResultCount(0)).toBe('0 matches');
  });
});
