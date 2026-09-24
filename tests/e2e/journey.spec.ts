import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signUpAndEnter } from './support';

async function nav(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
}

test('the navigation is a bottom bar on phones and a sidebar on desktop, and every tab renders', async ({
  page,
}, testInfo) => {
  await signUpAndEnter(page, 'journey');
  const navBox = await page.getByRole('navigation', { name: 'Primary' }).boundingBox();
  const viewport = page.viewportSize()!;
  if (testInfo.project.name === 'phone') {
    expect(navBox!.y + navBox!.height).toBeGreaterThan(viewport.height - 2);
    expect(navBox!.width).toBeGreaterThan(viewport.width - 2);
  } else {
    expect(navBox!.x).toBeLessThan(2);
    expect(navBox!.height).toBeGreaterThan(navBox!.width);
  }
  for (const [tab, heading] of [
    ['Tasks', 'Tasks'],
    ['Areas', 'Areas'],
    ['Journal', 'Journal'],
    ['Captures', 'Capture Inbox'],
    ['Tools', 'Tools'],
    ['Today', 'Today'],
  ] as const) {
    await nav(page, tab);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('Tools lists Places as phone-only, opens Life Areas and the Tag Editor, and notes routines', async ({
  page,
}) => {
  await signUpAndEnter(page, 'tools');
  await nav(page, 'Tools');
  const tools = page.getByRole('list', { name: 'Tools' });
  await expect(tools.getByText('Places')).toBeVisible();
  await expect(tools.getByText('On your phone')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Routines' })).toContainText('need the phone');
  await tools.getByRole('link', { name: /Life Areas/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Life Areas' })).toBeVisible();
  await nav(page, 'Tools');
  await tools.getByRole('link', { name: /Tag Editor/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tag Editor' })).toBeVisible();
});

test('one loop: capture → task it → close it → the journal and the area detail both show it', async ({
  page,
}) => {
  await signUpAndEnter(page, 'loop');
  await nav(page, 'Captures');
  await page.getByRole('button', { name: 'Capture something' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder("What's on your mind?").fill('Renew the passport');
  await dialog.getByRole('radio', { name: /Home/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'To triage (1)' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Decide' })
    .getByRole('button', { name: 'Task it' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Today' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create Task' }).click();
  await expect(page.getByText('Inbox clear')).toBeVisible();

  await nav(page, 'Tasks');
  const dueToday = page.getByRole('region', { name: 'Due today · 1' });
  await expect(dueToday.getByText('Renew the passport')).toBeVisible();
  await dueToday.getByRole('button', { name: 'Close task' }).click();
  await expect(page.getByRole('region', { name: 'Closed today · 1' })).toBeVisible();

  await nav(page, 'Journal');
  await expect(page.getByText('1 closed · 1 written this week')).toBeVisible();
  await expect(page.getByRole('link', { name: /Renew the passport, closed/ })).toBeVisible();

  await nav(page, 'Areas');
  await page
    .getByRole('list', { name: 'Life areas' })
    .getByRole('link', { name: /^Home\./ })
    .click();
  await expect(page.getByText("All of this week's Home items closed")).toBeVisible();
  await page.getByRole('button', { name: 'Captures 1' }).click();
  await expect(
    page.getByRole('region', { name: 'Captures' }).getByText('Renew the passport'),
  ).toBeVisible();
});
