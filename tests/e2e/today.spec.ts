import { expect, test } from '@playwright/test';

import { signUpAndEnter } from './support';

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page, 'today');
});

test('ring, best next move, close with undo, closed today, inbox peek and the week review', async ({
  page,
}) => {
  await expect(page.getByRole('img', { name: '0 of 5 closed today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Still open' })).toBeVisible();
  await expect(page.getByText('Close one to start a streak.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Capture inbox, Inbox clear' })).toBeVisible();

  const card = page.getByRole('region', { name: 'Best next move' });
  await expect(card.getByRole('link', { name: 'Take a 10-minute walk' })).toBeVisible();
  await expect(card.getByText('🫀 Health')).toBeVisible();
  await card.getByRole('button', { name: 'Close it' }).click();

  await expect(page.getByRole('img', { name: '1 of 5 closed today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Streak' })).toBeVisible();
  await expect(page.getByText('Streak kept. Best is 1.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Closed today' }).getByText('Take a 10-minute walk'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Week review/ })).toContainText(
    '1 closed · 0 focus minutes',
  );
  await expect(
    page.getByRole('list', { name: 'Life areas' }).getByRole('link').first(),
  ).toHaveAccessibleName('Health, 1 closed this week, 0 open');

  const capsule = page.getByRole('status').filter({ hasText: 'Closed' });
  await capsule.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('img', { name: '0 of 5 closed today' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Take a 10-minute walk' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Closed today' })).toHaveCount(0);

  await page.getByRole('link', { name: /Week review/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Week review' })).toBeVisible();
  await expect(page.getByText('0 closed · 0 focus minutes')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Quiet this week' })).toContainText(
    'Nothing closed in Health or Growth this week. Neither is a failure',
  );
  await expect(page.getByRole('region', { name: 'Dopamine wins' })).toHaveCount(0);
});

test('life areas: Arrange moves an area and the order persists; collapsing shows the summary', async ({
  page,
}) => {
  const list = page.getByRole('list', { name: 'Life areas' });
  await expect(list.getByRole('link')).toHaveCount(6);
  await expect(list.getByRole('link').first()).toHaveAccessibleName(
    'Health, 0 closed this week, 1 open',
  );

  await page.getByRole('button', { name: 'Arrange' }).click();
  await expect(page.getByRole('button', { name: 'Move Health up' })).toBeDisabled();
  await page.getByRole('button', { name: 'Move Health down' }).click();
  await expect(page.getByRole('button', { name: 'Move Health up' })).toBeEnabled();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(list.getByRole('link').first()).toHaveAccessibleName(/^Work,/);
  await expect(list.getByRole('link').nth(1)).toHaveAccessibleName(/^Health,/);

  await page.reload();
  await expect(
    page.getByRole('list', { name: 'Life areas' }).getByRole('link').first(),
  ).toHaveAccessibleName(/^Work,/);

  await page.getByRole('button', { name: 'Your life areas', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Your life areas, 6 areas · 2 open' }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Life areas' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Your life areas, 6 areas · 2 open' }).click();
  await expect(page.getByRole('list', { name: 'Life areas' })).toBeVisible();
});
