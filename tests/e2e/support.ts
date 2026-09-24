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

/** The Auth emulator's sign-in endpoint, so a spec can address an account's documents directly. */
export async function uidFor(email: string): Promise<string> {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
    },
  );
  const json = (await response.json()) as { localId?: string };
  if (!json.localId) throw new Error(`No uid for ${email}: ${JSON.stringify(json)}`);
  return json.localId;
}
