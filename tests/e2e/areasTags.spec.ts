import { expect, test } from '@playwright/test';

import { signUpAndEnter } from './support';

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page, 'areas');
});

test('Areas shows the seeded cards, an area detail lists its task, and closing it updates the ring line', async ({
  page,
}) => {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Areas' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Areas' })).toBeVisible();
  const grid = page.getByRole('list', { name: 'Life areas' });
  await expect(grid.getByRole('link')).toHaveCount(6);
  await expect(page.getByText('Everything waiting has an area')).toBeVisible();

  await grid.getByRole('link', { name: /^Health\./ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Health/ })).toBeVisible();
  await expect(page.getByText("0% of this week's Health items closed")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasks 1' })).toBeVisible();
  await expect(page.getByText('Take a 10-minute walk')).toBeVisible();

  await page.getByRole('button', { name: 'Close task' }).click();
  await expect(page.getByText("All of this week's Health items closed")).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Closed' })).toBeVisible();

  await page.getByRole('button', { name: 'Add to Health' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Area')).toHaveValue(/./);
  await dialog.getByPlaceholder('What needs doing?').fill('Book a physio');
  await dialog.getByRole('button', { name: 'Add the task' }).click();
  await expect(page.getByText('Book a physio')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasks 1' })).toBeVisible();
});

test('Life Areas editor: add, conflict, rename, colour, archive, unarchive, arrange', async ({
  page,
}) => {
  await page.goto('/areas/editor');
  await expect(page.getByRole('heading', { level: 1, name: 'Life Areas' })).toBeVisible();
  await expect(page.getByText('6 active areas')).toBeVisible();

  await page.getByRole('button', { name: 'Add life area' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name').fill('  Garden ');
  await sheet.getByRole('radio', { name: '🌱' }).click();
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('7 active areas')).toBeVisible();
  await expect(page.getByRole('link', { name: /Garden/ })).toBeVisible();

  await page.getByRole('button', { name: 'Add life area' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('garden');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('“garden” already exists')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  // The add sheet stays open behind the alert, as on iOS; close it to get back to the list.
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: /Garden/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Garden' })).toBeVisible();
  await page.getByLabel('Name').fill('Allotment');
  await page.getByRole('radio', { name: 'Green' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Life Areas' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Allotment/ })).toBeVisible();

  await page.getByRole('link', { name: /Allotment/ }).click();
  await page.getByLabel('Name').fill('Health');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('“Health” is taken')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();

  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: 'Archive' }).last().click();
  await expect(page.getByText('Archived “Allotment”.')).toBeVisible();
  await expect(page.getByText('6 active areas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Archived' })).toContainText('Allotment');

  await page.getByRole('button', { name: 'Add life area' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('allotment');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('“allotment” already exists')).toBeVisible();
  await page.getByRole('button', { name: 'Unarchive' }).click();
  await expect(page.getByText('7 active areas')).toBeVisible();

  await page.getByRole('button', { name: 'Arrange' }).click();
  await page.getByRole('button', { name: 'Move Work up' }).click();
  const active = page.getByRole('region', { name: 'Active' });
  await expect(active.getByRole('link').first()).toContainText('Work');
  await expect(active.getByRole('link').nth(1)).toContainText('Health');
  await page.getByRole('button', { name: 'Done' }).click();
});

test('Tag Editor: create, already exists, rename, merge, delete with undo', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Tag Editor' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tag Editor' })).toBeVisible();
  await expect(page.getByText('5 tags')).toBeVisible();

  await page.getByRole('button', { name: 'New tag' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('errand');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('6 tags')).toBeVisible();

  await page.getByRole('button', { name: 'New tag' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Errand');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('"Errand" already exists.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('6 tags')).toBeVisible();

  await page.getByRole('link', { name: /^errand/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'errand' })).toBeVisible();
  await expect(page.getByText('Not used yet')).toBeVisible();
  await page.getByLabel('Name').fill('errands');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /^errands/ })).toBeVisible();

  await page.getByRole('link', { name: /^errands/ }).click();
  await page.getByLabel('Name').fill('Quick-Win');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('“quick-win” already exists')).toBeVisible();
  await page.getByRole('button', { name: 'Merge' }).click();
  await expect(page.getByText('5 tags')).toBeVisible();
  await expect(page.getByRole('link', { name: /^errands/ })).toHaveCount(0);

  await page.getByRole('link', { name: /^someday/ }).click();
  await page.getByRole('button', { name: 'Delete Tag' }).click();
  await expect(page.getByText('4 tags')).toBeVisible();
  const capsule = page.getByRole('status').filter({ hasText: 'Deleted' });
  await expect(capsule).toContainText('someday');
  await capsule.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('5 tags')).toBeVisible();
  await expect(page.getByRole('link', { name: /^someday/ })).toBeVisible();
});
