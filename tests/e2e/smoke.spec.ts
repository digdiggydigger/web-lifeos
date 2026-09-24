import { expect, test } from '@playwright/test';

import { signUpAndEnter } from './support';

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page);
});

test('the shell loads on Today with the six-tab primary navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  for (const label of ['Today', 'Tasks', 'Areas', 'Journal', 'Captures', 'Tools']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
});

test('every tab link is at least 44px tall', async ({ page }) => {
  await page.goto('/today');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  const links = nav.getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < count; i += 1) {
    const box = await links.nth(i).boundingBox();
    expect(box, `link ${i} has a box`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test('the appearance override applies to the document and survives a reload', async ({ page }) => {
  await page.goto('/settings');
  const group = page.getByRole('radiogroup', { name: 'Appearance' });
  // The inputs are visually hidden inside their labels, so the label is the click target.
  await group.getByText('Dark', { exact: true }).click();
  await expect(group.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await group.getByText('System', { exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});
