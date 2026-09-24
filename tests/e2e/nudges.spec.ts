import { expect, test } from '@playwright/test';

import { signUpAndEnter, TEST_PASSWORD } from './support';

// The emulator ports from firebase.emulators.json; the Firestore emulator honours `Bearer owner` as admin.
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT = 'demo-adhdlifeos';

async function uidFor(email: string): Promise<string> {
  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
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
async function seedDueNudge(uid: string, label: string): Promise<void> {
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

test.use({ permissions: ['notifications'] });

test('first-run door → a due nudge on Today → Done for now with undo → the Nudges screen', async ({
  page,
}) => {
  const email = await signUpAndEnter(page, 'nudges');
  await expect(page.getByRole('link', { name: 'Nudges, None yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add your first nudge' })).toBeVisible();

  await seedDueNudge(await uidFor(email), 'Take the meds');
  await page.reload();
  const card = page.getByRole('article', { name: 'Take the meds, due' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Daily at 09:00')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nudges, 1 due' })).toBeVisible();

  await card.getByRole('button', { name: 'Dismiss Take the meds' }).click();
  const capsule = page.getByRole('status').filter({ hasText: 'Done for now' });
  await expect(capsule.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Take the meds, due' })).toHaveCount(0);
  const door = page.getByRole('link', { name: 'Nudges, 1 scheduled' });
  await expect(door).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nudges' })).toContainText(
    /Take the meds(Today|Tomorrow) /,
  );

  await capsule.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('article', { name: 'Take the meds, due' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nudges, 1 due' })).toBeVisible();

  await page.getByRole('link', { name: 'Nudges, 1 due' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nudges' })).toBeVisible();
  await expect(page.getByText('1 due · 0 scheduled')).toBeVisible();

  await page.getByRole('button', { name: 'New nudge', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
  await sheet.getByPlaceholder('Drink water').fill('Drink water');
  await sheet.getByRole('button', { name: 'Weekdays' }).click();
  await expect(sheet.getByText('Every weekday')).toBeVisible();
  await sheet.getByLabel('Time').fill('18:30');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Mon, Tue, Wed, Thu, Fri at 18:30')).toBeVisible();
  await expect(page.getByText('1 due · 1 scheduled')).toBeVisible();

  await page.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  await expect(page.getByText('1 due · 0 scheduled')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Label').fill('Drink more water');
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.getByRole('group', { name: 'Days' }).getByRole('button', { name: 'Mon' }).click();
  await expect(page.getByText('Tue, Wed, Thu, Fri', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Drink more water')).toBeVisible();
  await expect(page.getByText('Tue, Wed, Thu, Fri at 18:30')).toBeVisible();

  await card.getByRole('button', { name: 'Dismiss Take the meds' }).click();
  await expect(page.getByRole('region', { name: 'Recent' })).toContainText('Take the meds');
  await expect(page.getByText('Nothing due · 1 scheduled')).toBeVisible();
});
