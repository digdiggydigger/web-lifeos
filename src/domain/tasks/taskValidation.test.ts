// Ports of TagDedupTests, TaskCreateValidationTests, TaskUpdateValidationTests,
// TaskDetailDirtyStateTests and TaskDetailAutosaveTests.
import { describe, expect, it } from 'vitest';

import type { Task } from '@/domain/types';

import { matchExistingTag } from './tagDedup';
import {
  normalizeCreateTagInput,
  normalizeCreateTaskInput,
  taskCreateValidationMessage,
} from './taskCreateValidation';
import { shouldAutosave, taskDetailDirtyState } from './taskDetailDirtyState';
import { editedFieldsFrom, isEmptyDelta, normalizeUpdateTaskInput } from './taskUpdateValidation';
import type { TaskEditedFields } from './taskUpdateValidation';

describe('matchExistingTag', () => {
  const tags = [
    { id: 'A', name: 'errand' },
    { id: 'B', name: 'Focus' },
  ];
  it('matches exactly, case-sensitively, or not at all', () => {
    expect(matchExistingTag(tags, 'errand')?.id).toBe('A');
    expect(matchExistingTag(tags, 'focus')).toBeUndefined();
    expect(matchExistingTag(tags, 'nope')).toBeUndefined();
    expect(matchExistingTag([], 'errand')).toBeUndefined();
  });
});

describe('normalizeCreateTaskInput', () => {
  it('trims the title and defaults priority to p4', () => {
    const r = normalizeCreateTaskInput({ title: '  Renew passport  ' });
    expect(r).toEqual({ ok: true, value: { title: 'Renew passport', priority: 'p4' } });
  });
  it('fails an empty title with the copy', () => {
    const r = normalizeCreateTaskInput({ title: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(taskCreateValidationMessage(r.error)).toBe('Title is required.');
  });
  it('normalizes notes and passes area, due date through', () => {
    const due = new Date(2026, 7, 14);
    const r = normalizeCreateTaskInput({
      title: 'x',
      notes: '  ',
      lifeAreaId: 'AREA',
      dueDate: due,
    });
    expect(r).toEqual({
      ok: true,
      value: { title: 'x', priority: 'p4', lifeAreaId: 'AREA', dueDate: due },
    });
    const trimmed = normalizeCreateTaskInput({ title: 'x', notes: ' keep ' });
    if (trimmed.ok) expect(trimmed.value.notes).toBe('keep');
  });
  it('trims a tag name and refuses an empty one', () => {
    expect(normalizeCreateTagInput('  errand ')).toEqual({ ok: true, value: 'errand' });
    const r = normalizeCreateTagInput('  ');
    if (!r.ok) expect(taskCreateValidationMessage(r.error)).toBe('Tag name is required.');
  });
});

const original: Task = {
  id: 'T',
  title: 'Original title',
  notes: 'Original notes',
  status: 'open',
  priority: 'p3',
};
const edited = (overrides: Partial<TaskEditedFields> = {}): TaskEditedFields => ({
  ...editedFieldsFrom(original),
  ...overrides,
});
function withoutDueDate(fields: TaskEditedFields): TaskEditedFields {
  const copy: Record<string, unknown> = { ...fields };
  delete copy['dueDate'];
  return copy as unknown as TaskEditedFields;
}
const ok = (fields: TaskEditedFields, base = original) => {
  const r = normalizeUpdateTaskInput(base, fields);
  if (!r.ok) throw new Error('expected success');
  return r.value;
};

describe('normalizeUpdateTaskInput', () => {
  it('fails an empty title', () => {
    expect(normalizeUpdateTaskInput(original, edited({ title: '   ' }))).toEqual({
      ok: false,
      error: 'emptyTitle',
    });
  });
  it('returns an empty delta when nothing changed, focus fields untouched', () => {
    expect(isEmptyDelta(ok(edited()))).toBe(true);
  });
  it('carries only the changed title, trimmed', () => {
    expect(ok(edited({ title: '  Updated title  ' }))).toEqual({ title: 'Updated title' });
  });
  it('clears notes with an explicit null', () => {
    expect(ok(edited({ notes: '   ' }))).toEqual({ notes: null });
  });
  it('carries a new life area, priority, and a cleared due date', () => {
    expect(ok(edited({ lifeAreaId: 'NEW' }))).toEqual({ lifeAreaId: 'NEW' });
    expect(ok(edited({ priority: 'p1' }))).toEqual({ priority: 'p1' });
    const dated: Task = { ...original, dueDate: new Date(2026, 7, 14) };
    expect(ok(withoutDueDate(editedFieldsFrom(dated)), dated)).toEqual({
      dueDate: null,
    });
  });
  it('writes nothing for staged defaults over a nil original, and clamps real changes', () => {
    expect(isEmptyDelta(ok(edited({ focusDurationSeconds: 900, nudgesCount: 2 })))).toBe(true);
    expect(ok(edited({ focusDurationSeconds: 300 }))).toEqual({ focusDurationSeconds: 300 });
    expect(ok(edited({ focusDurationSeconds: 4 }))).toEqual({ focusDurationSeconds: 30 });
    expect(ok(edited({ nudgesCount: 99 }))).toEqual({ nudgesCount: 10 });
  });
});

describe('taskDetailDirtyState', () => {
  const state = (fields: TaskEditedFields, base = original) => taskDetailDirtyState(base, fields);
  it('is clean with no edits, whitespace churn, empty-vs-absent notes, or staged defaults', () => {
    expect(state(edited())).toEqual({ hasUnsavedChanges: false, isDueDateDirty: false });
    expect(state(edited({ title: '  Original title  ' })).hasUnsavedChanges).toBe(false);
    const noNotes: Task = { id: 'T', title: 'Buy milk', status: 'open', priority: 'p3' };
    expect(state({ ...editedFieldsFrom(noNotes), notes: '' }, noNotes).hasUnsavedChanges).toBe(
      false,
    );
    expect(state({ ...editedFieldsFrom(noNotes), notes: '   ' }, noNotes).hasUnsavedChanges).toBe(
      false,
    );
    expect(state(edited({ focusDurationSeconds: 900, nudgesCount: 2 })).hasUnsavedChanges).toBe(
      false,
    );
  });
  it('is dirty for title, notes, area, priority, focus edits, but not due-date dirty', () => {
    for (const fields of [
      edited({ title: 'A different title' }),
      edited({ notes: 'Rewritten notes' }),
      edited({ lifeAreaId: 'X' }),
      edited({ priority: 'p1' }),
      edited({ focusDurationSeconds: 300 }),
      edited({ nudgesCount: 5 }),
    ]) {
      expect(state(fields)).toEqual({ hasUnsavedChanges: true, isDueDateDirty: false });
    }
  });
  it('tracks the due date separately, and reverting clears both', () => {
    expect(state(edited({ dueDate: new Date(1_700_000_000_000) }))).toEqual({
      hasUnsavedChanges: true,
      isDueDateDirty: true,
    });
    const dated: Task = { ...original, dueDate: new Date(1_700_000_000_000) };
    expect(state(withoutDueDate(editedFieldsFrom(dated)), dated)).toEqual({
      hasUnsavedChanges: true,
      isDueDateDirty: true,
    });
    expect(
      state(
        { ...editedFieldsFrom(dated), title: 'New title', priority: 'p1', notes: 'New notes' },
        dated,
      ),
    ).toEqual({
      hasUnsavedChanges: true,
      isDueDateDirty: false,
    });
  });
  it('treats a title cleared to whitespace as an unsaved change', () => {
    expect(state(edited({ title: '   ' })).hasUnsavedChanges).toBe(true);
  });
});

describe('shouldAutosave', () => {
  it("is exactly the Save button's enabled condition", () => {
    expect(shouldAutosave(true, 'Title', false)).toBe(true);
    expect(shouldAutosave(false, 'Title', false)).toBe(false);
    expect(shouldAutosave(true, '   ', false)).toBe(false);
    expect(shouldAutosave(true, 'Title', true)).toBe(false);
  });
});
