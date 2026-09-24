import { expect, test } from '@playwright/test';

import { signUpAndEnter } from './support';

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page, 'journal');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Journal' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
});

test('the seeded welcome entry shows under Today with the week line', async ({ page }) => {
  await expect(page.getByText('0 closed · 1 written this week')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Today/ })).toBeVisible();
  await expect(page.getByText(/Welcome to ADHD LifeOS/)).toBeVisible();
  await page.getByRole('button', { name: /^Today/ }).click();
  await expect(page.getByText('1 entry')).toBeVisible();
  await expect(page.getByText(/Welcome to ADHD LifeOS/)).toBeHidden();
});

test('write a journal entry with energy, mood, area and a new tag; filters and the area picker apply', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Write an entry' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Save entry' })).toBeDisabled();
  await dialog.getByPlaceholder("What's on your mind?").fill('  Felt sharp after the walk  ');
  await dialog.getByRole('radio', { name: 'Journal' }).click();
  await expect(dialog.getByText('A fuller entry — energy and mood ride along.')).toBeVisible();
  await dialog.getByRole('radio', { name: 'High energy, Hyperfocus' }).click();
  await dialog.getByRole('radio', { name: 'Mood 🔥' }).click();
  await dialog.getByRole('radio', { name: /Health/ }).click();
  await dialog.getByPlaceholder('New tag').fill('deep-work');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog.getByRole('button', { name: 'deep-work', pressed: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save entry' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('0 closed · 2 written this week')).toBeVisible();
  await expect(page.getByText('Felt sharp after the walk')).toBeVisible();
  await expect(page.getByText('Journal · 🫀 Health')).toBeVisible();
  await expect(page.getByText('high energy')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tags' }).getByText('deep-work')).toBeVisible();

  await page.getByRole('button', { name: 'Closed' }).click();
  await expect(
    page.getByText('Nothing here yet — one line about today is enough to start.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Written' }).click();
  await page.getByLabel('Life Area').selectOption({ label: '🫀 Health' });
  await expect(page.getByText('Felt sharp after the walk')).toBeVisible();
  await expect(page.getByText(/Welcome to ADHD LifeOS/)).toBeHidden();
});

test('closing a task shows it in the timeline as a door to the task', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Tasks' })
    .click();
  await page.getByRole('button', { name: 'Close task' }).first().click();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Journal' })
    .click();
  await expect(page.getByText('1 closed · 1 written this week')).toBeVisible();
  await page.getByRole('link', { name: /Take a 10-minute walk, closed/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Task' })).toBeVisible();
});
