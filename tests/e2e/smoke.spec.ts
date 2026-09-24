import { expect, test } from '@playwright/test';

test('the app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ADHD LifeOS' })).toBeVisible();
});
