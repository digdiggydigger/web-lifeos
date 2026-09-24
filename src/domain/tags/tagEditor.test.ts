// Ports of TagEditorValidationTests, TagEditorPresentationTests and TagEditorService.sorted.
import { describe, expect, it } from 'vitest';

import {
  alreadyExistsInfo,
  mergeAlertMessage,
  mergeAlertTitle,
  noOtherTagError,
  normalizeNewName,
  renameChange,
  sortTagsCaseInsensitively,
  usagePhrase,
} from './tagEditor';

describe('TagEditor', () => {
  it('rename change and new-name normalisation', () => {
    expect(renameChange('errand', '   ')).toEqual({ kind: 'invalidEmpty' });
    expect(renameChange('errand', ' errand ')).toEqual({ kind: 'unchanged' });
    expect(renameChange('errand', ' chores ')).toEqual({ kind: 'valid', name: 'chores' });
    expect(normalizeNewName(' x ')).toBe('x');
    expect(normalizeNewName('  ')).toBeUndefined();
  });
  it('usage phrase and merge copy', () => {
    expect(usagePhrase(0)).toBe('Not used yet');
    expect(usagePhrase(1)).toBe('Used on 1 item');
    expect(usagePhrase(4)).toBe('Used on 4 items');
    expect(mergeAlertTitle('chores')).toBe('“chores” already exists');
    expect(mergeAlertMessage('chores', 0)).toBe(
      "“chores” isn't used yet. Merge this tag into it? This can't be undone.",
    );
    expect(mergeAlertMessage('chores', 1)).toBe(
      "“chores” is used on 1 item. Merge this tag into it? This can't be undone.",
    );
    expect(mergeAlertMessage('chores', 3)).toBe(
      "“chores” is used on 3 items. Merge this tag into it? This can't be undone.",
    );
    expect(alreadyExistsInfo('errands')).toBe('"errands" already exists.');
    expect(noOtherTagError('chores')).toBe('There\'s no other tag named "chores" to merge into.');
  });
  it('sorts case-insensitively', () => {
    expect(
      sortTagsCaseInsensitively([{ name: 'Cherry' }, { name: 'apple' }, { name: 'Banana' }]).map(
        (t) => t.name,
      ),
    ).toEqual(['apple', 'Banana', 'Cherry']);
  });
});
