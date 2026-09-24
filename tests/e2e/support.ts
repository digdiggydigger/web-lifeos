import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const TEST_PASSWORD = 'correct horse battery staple';

// The emulator ports from firebase.emulators.json; the Firestore emulator honours `Bearer owner` as admin.
const FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT = 'demo-adhdlifeos';

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

/** A daily 09:00 nudge created two days ago: due whatever the clock says now. */
export async function seedDueNudge(uid: string, label: string): Promise<void> {
  const id = crypto.randomUUID().toUpperCase();
  const created = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/nudges?documentId=${id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        fields: {
          id: { stringValue: id },
          label: { stringValue: label },
          schedule: { stringValue: '0 9 * * *' },
          active: { booleanValue: true },
          created_at: { timestampValue: created },
          updated_at: { timestampValue: created },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Seeding the nudge failed: ${response.status} ${await response.text()}`);
}
