import { expect, test } from '@playwright/test';

import { signUpAndEnter } from './support';

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page, 'tasks');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Tasks' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
});

test('Momentum shows the seeded walk under Tomorrow and Open shows all three starters', async ({
  page,
}) => {
  await expect(page.getByRole('region', { name: 'Tomorrow · 1' })).toBeVisible();
  await expect(page.getByText('Take a 10-minute walk')).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByText('Check off your first task')).toBeVisible();
  await expect(page.getByText('Capture three things on your mind')).toBeVisible();
  await expect(page.getByText(/3 open · 0 overdue/)).toBeVisible();
});

test('create → close → undo → autosaved edit → delete', async ({ page }) => {
  await page.getByRole('button', { name: 'New task' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Add the task' })).toBeDisabled();
  await dialog.getByPlaceholder('What needs doing?').fill('Ring the dentist');
  await dialog.getByRole('button', { name: 'Today' }).click();
  await dialog.getByRole('button', { name: 'Add the task' }).click();

  const dueToday = page.getByRole('region', { name: 'Due today · 1' });
  await expect(dueToday).toBeVisible();
  await expect(dueToday.getByText('Ring the dentist')).toBeVisible();
  await expect(dueToday.getByText(/15 min/)).toBeVisible();

  await dueToday.getByRole('button', { name: 'Close task' }).click();
  await expect(page.getByRole('region', { name: 'Closed today · 1' })).toBeVisible();
  const capsule = page.getByRole('status').filter({ hasText: 'Closed' });
  await expect(capsule.getByRole('button', { name: 'Undo' })).toBeVisible();
  await capsule.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'Due today · 1' })).toBeVisible();

  await page.getByRole('link', { name: /Ring the dentist/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Task' })).toBeVisible();
  await page.getByLabel('Title').fill('Ring the dentist tomorrow');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Tasks' })
    .click();
  await expect(page.getByText('Ring the dentist tomorrow')).toBeVisible();

  await page.getByRole('link', { name: /Ring the dentist tomorrow/ }).click();
  await page.getByRole('button', { name: 'Delete Task' }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  // The undo capsule still names it; the list must not.
  await expect(page.getByRole('link', { name: /Ring the dentist tomorrow/ })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Deleted' })).toBeVisible();
});

test('search filters across every status with a match count', async ({ page }) => {
  await page.getByPlaceholder('Search tasks').fill('walk');
  await expect(page.getByText('1 match')).toBeVisible();
  await expect(page.getByText('Take a 10-minute walk')).toBeVisible();
  await page.getByPlaceholder('Search tasks').fill('zzz');
  await expect(page.getByText('Nothing matches “zzz”')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('region', { name: 'Tomorrow · 1' })).toBeVisible();
});
