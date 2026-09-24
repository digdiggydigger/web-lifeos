import { expect, test } from '@playwright/test';

import { signUpAndEnter, TEST_PASSWORD } from './support';

test('name edit, preferences that persist, the streak switch, and the About row', async ({
  page,
}) => {
  await signUpAndEnter(page, 'settings');
  // The sidebar carries the Settings link on desktop; the phone bar does not, so go straight there.
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Add your name' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('  Ethan  ');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Name: Ethan/ })).toBeVisible();

  await expect(page.getByText('5 items')).toBeVisible();
  await page.getByRole('button', { name: 'Increase daily goal' }).click();
  await expect(page.getByText('6 items')).toBeVisible();
  await page.getByRole('switch', { name: 'Show streaks' }).click();
  await expect(page.getByRole('switch', { name: 'Show streaks' })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Show weekly charts' }).click();
  await page.reload();
  await expect(page.getByText('6 items')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Show streaks' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Show weekly charts' })).not.toBeChecked();
  await expect(page.getByText(/^\d+\.\d+\.\d+ \(/)).toBeVisible();

  // The radio itself is visually hidden; its label is the 44 px target.
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByText('Dark').click();
  await expect(
    page.getByText('Dark by default — the closure green reads brightest against it.'),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('deleting the account wipes its data, ends the session, and the credentials stop working', async ({
  page,
}) => {
  const email = await signUpAndEnter(page, 'delete');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete Account…' }).click();
  await expect(page.getByText('Delete your account?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete Account & All Data' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
