import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signUpAndEnter } from './support';

async function nav(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
}

test('deleted tasks, captures and tags wait in Recently Deleted; restore, delete forever, and the tag survivor choice', async ({
  page,
}) => {
  await signUpAndEnter(page, 'deleted');

  await nav(page, 'Tasks');
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('link', { name: /Capture three things on your mind/ }).click();
  await page.getByRole('button', { name: 'Delete Task' }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto('/tags');
  await page.getByRole('link', { name: /^someday/ }).click();
  await page.getByRole('button', { name: 'Delete Tag' }).click();
  await expect(page.getByText('4 tags')).toBeVisible();

  await nav(page, 'Captures');
  await page.getByRole('button', { name: 'Capture something' }).first().click();
  await page.getByRole('dialog').getByPlaceholder("What's on your mind?").fill('Idle thought');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'To triage (1)' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Decide' })
    .getByRole('link', { name: 'Idle thought' })
    .click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByText('Inbox clear')).toBeVisible();
  // The capsule offers an undo for the capture; it is not wanted here.
  await page.getByRole('status').getByRole('button', { name: 'Dismiss' }).click();

  await nav(page, 'Tools');
  await expect(page.getByText('3 items · 30 days left')).toBeVisible();
  await page.getByRole('link', { name: /Recently Deleted/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recently Deleted' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Recently Deleted' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByText('Task · 30 days left')).toBeVisible();
  await expect(list.getByText('Capture · 30 days left')).toBeVisible();
  await expect(list.getByText('Tag · 30 days left')).toBeVisible();

  const taskRow = list
    .getByRole('listitem')
    .filter({ hasText: 'Capture three things on your mind' });
  await taskRow.getByRole('button', { name: 'Restore' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);

  const captureRow = list.getByRole('listitem').filter({ hasText: 'Idle thought' });
  await captureRow.getByRole('button', { name: 'Delete Forever' }).click();
  await expect(page.getByText('Delete this capture forever?')).toBeVisible();
  await expect(page.getByText("This can't be undone.")).toBeVisible();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await captureRow.getByRole('button', { name: 'Delete Forever' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Forever' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);

  // A live tag takes the deleted name with another spelling: restoring asks which survives.
  await page.goto('/tags');
  await page.getByRole('button', { name: 'New tag' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Someday');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('5 tags')).toBeVisible();
  await page.goto('/tools/recently-deleted');
  await list.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('“Someday” already exists')).toBeVisible();
  await page.getByRole('button', { name: 'Keep “someday”', exact: true }).click();
  await expect(page.getByText('Nothing deleted')).toBeVisible();
  await page.goto('/tags');
  await expect(page.getByText('5 tags')).toBeVisible();
  await expect(page.getByRole('link', { name: /^someday/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Someday/ })).toHaveCount(0);

  await nav(page, 'Tasks');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByText('Capture three things on your mind')).toBeVisible();
});
