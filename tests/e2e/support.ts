import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const TEST_PASSWORD = 'correct horse battery staple';

/** Creates a fresh account through the real sign-up form and waits for Today. */
export async function signUpAndEnter(page: Page, label = 'e2e'): Promise<string> {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  return email;
}
