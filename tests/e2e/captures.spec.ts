import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signUpAndEnter } from './support';

async function openInbox(page: Page) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Captures' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Capture Inbox' })).toBeVisible();
}

async function captureNote(page: Page, text: string) {
  await page.getByRole('button', { name: 'Capture something' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder("What's on your mind?").fill(text);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await signUpAndEnter(page, 'captures');
  await openInbox(page);
});

test('an empty inbox reads as clear; a captured note becomes the top decision with the counts', async ({
  page,
}) => {
  await expect(page.getByText('Inbox clear')).toBeVisible();
  await captureNote(page, 'Ring the dentist about the referral');
  await captureNote(page, 'Look up the new library hours');
  await expect(page.getByRole('button', { name: 'To triage (2)' })).toBeVisible();
  await expect(page.getByText('2 notes')).toBeVisible();
  await expect(page.getByText('oldest is under an hour old')).toBeVisible();
  await expect(page.getByText('2 captured · 0 cleared this week')).toBeVisible();
  const decide = page.getByRole('region', { name: 'Decide' });
  await expect(decide.getByText('Look up the new library hours')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Then' }).getByText('Ring the dentist about the referral'),
  ).toBeVisible();
});

test('Sorted needs an area, moves the capture to Sorted with an undo, and the area detail lists it', async ({
  page,
}) => {
  await captureNote(page, 'Book a physio');
  await expect(page.getByRole('button', { name: 'To triage (1)' })).toBeVisible();
  const decide = page.getByRole('region', { name: 'Decide' });
  await expect(decide.getByRole('button', { name: 'Sorted' })).toBeDisabled();
  await decide.getByRole('radio', { name: /Health/ }).click();
  await decide.getByRole('button', { name: 'Sorted' }).click();
  await expect(page.getByText('Inbox clear')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sorted (1)' })).toBeVisible();
  const capsule = page.getByRole('status').filter({ hasText: 'Sorted to 🫀 Health' });
  await expect(capsule).toBeVisible();
  await page.getByRole('button', { name: 'Sorted (1)' }).click();
  await expect(page.getByText('1 sorted')).toBeVisible();
  await expect(page.getByRole('link', { name: /Book a physio/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Areas' })
    .click();
  await page
    .getByRole('list', { name: 'Life areas' })
    .getByRole('link', { name: /^Health\./ })
    .click();
  await page.getByRole('button', { name: 'Captures 1' }).click();
  await expect(
    page.getByRole('region', { name: 'Captures' }).getByText('Book a physio'),
  ).toBeVisible();
  await openInbox(page);
  await page.getByRole('button', { name: 'Sorted (1)' }).click();
  await page.getByRole('link', { name: /Book a physio/ }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Move back to Inbox' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Capture Inbox' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'To triage (1)' })).toBeVisible();
});

test('Task it makes a task and promotes the capture; Journal it writes an entry; Skip cycles; delete with undo', async ({
  page,
}) => {
  await captureNote(page, 'Renew the passport');
  await captureNote(page, 'Rain smelled like school');
  await expect(page.getByRole('button', { name: 'To triage (2)' })).toBeVisible();
  const decide = page.getByRole('region', { name: 'Decide' });
  await expect(decide.getByText('Rain smelled like school')).toBeVisible();
  await decide.getByRole('button', { name: 'Skip' }).click();
  await expect(decide.getByText('Renew the passport')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Skipped' })).toBeVisible();

  await decide.getByRole('button', { name: 'Task it' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Renew the passport')).toBeVisible();
  await sheet.getByRole('button', { name: '15 min' }).click();
  await sheet.getByRole('button', { name: 'Tomorrow' }).click();
  await sheet.getByRole('button', { name: 'Create Task' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'Promoted (1)' })).toBeVisible();

  await expect(decide.getByText('Rain smelled like school')).toBeVisible();
  await decide.getByRole('button', { name: 'Journal it' }).click();
  await expect(page.getByText('Inbox clear')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Journalled' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promoted (2)' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Tasks' })
    .click();
  await expect(page.getByRole('region', { name: 'Tomorrow · 2' })).toBeVisible();
  await expect(page.getByText('Renew the passport')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Journal' })
    .click();
  // The timeline shows the entry and the capture it came from.
  await expect(page.getByText('Rain smelled like school').first()).toBeVisible();

  await openInbox(page);
  await captureNote(page, 'Idle thought');
  await page
    .getByRole('region', { name: 'Decide' })
    .getByRole('link', { name: 'Idle thought' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: '📝 Note' })).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Capture Inbox' })).toBeVisible();
  await expect(page.getByText('Inbox clear')).toBeVisible();
  const capsule = page.getByRole('status').filter({ hasText: 'Deleted' });
  await capsule.getByRole('button', { name: 'Undo' }).click();
  await expect(
    page.getByRole('region', { name: 'Decide' }).getByText('Idle thought'),
  ).toBeVisible();
});

test('a link normalises to https, the detail shows its domain, notes and tags save; a closed composer keeps its draft', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Capture something' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Link' }).click();
  await dialog.getByPlaceholder('Paste a link').fill('example.com/article');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('1 link')).toBeVisible();
  await page
    .getByRole('region', { name: 'Decide' })
    .getByRole('link', { name: 'https://example.com/article' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: '🌐 Link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'example.com' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Notes' }).fill('Read before Thursday');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByRole('button', { name: 'Save notes' })).toBeDisabled();
  await page.getByPlaceholder('New tag').fill('reading');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'reading', pressed: true })).toBeVisible();
  await page.getByRole('link', { name: 'Capture Inbox' }).click();
  await expect(page.getByRole('region', { name: 'Decide' }).getByText('reading')).toBeVisible();

  await page.getByRole('button', { name: 'Capture something' }).first().click();
  await page.getByRole('dialog').getByPlaceholder("What's on your mind?").fill('Half a thought');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  const kept = page.getByRole('status').filter({ hasText: 'Kept in your inbox' });
  await expect(kept).toBeVisible();
  await expect(page.getByRole('button', { name: 'To triage (2)' })).toBeVisible();
  await kept.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '📝 Note' })).toBeVisible();
  await expect(page.getByText('Half a thought')).toBeVisible();
});
