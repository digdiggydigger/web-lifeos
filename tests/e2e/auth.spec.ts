import { expect, test } from '@playwright/test';

import { TEST_PASSWORD as password } from './support';

test('a signed-out visit to a tab lands on Sign in', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'ADHD LifeOS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
});

test('creating an account signs straight in, survives a reload, and signs out to Sign in', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByPlaceholder('Your name (optional)').fill('E');
  await page.getByPlaceholder('Email').fill(email);
  const passwordField = page.getByPlaceholder('Password');
  await passwordField.fill('abc');
  await expect(page.getByText('At least 6 characters.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('a wrong password says so without leaving the page', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('nobody@example.com');
  await page.getByPlaceholder('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText("don't match");
  await expect(page).toHaveURL(/\/login$/);
});

test('a brand-new account sees its six seeded life areas on Today', async ({ page }) => {
  const { signUpAndEnter } = await import('./support');
  await signUpAndEnter(page, 'seeded');
  const section = page.getByRole('region', { name: 'Your life areas' });
  for (const name of ['Health', 'Work', 'Home', 'Money', 'Relationships', 'Growth']) {
    await expect(section.getByText(name, { exact: true })).toBeVisible();
  }
});
