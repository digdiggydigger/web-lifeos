import { expect, test } from '@playwright/test';

import { seedDueNudge, signUpAndEnter, uidFor } from './support';

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
