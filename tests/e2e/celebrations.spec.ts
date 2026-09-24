import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signUpAndEnter, uidFor } from './support';

test.use({ permissions: ['notifications'] });

/** The layer records what it played: a pop lives one second, so the spec reads the record. */
function layer(page: Page) {
  return page.getByTestId('celebration-layer');
}

/** Seeds a sprint that finishes a few seconds after the reload, then waits for its Confirm card. */
async function finishASprint(page: Page, uid: string): Promise<void> {
  await page.evaluate(
    ([storageKey, value]) => localStorage.setItem(storageKey!, value!),
    [
      `focus.sprint.running.${uid}`,
      JSON.stringify({
        taskTitle: 'Nearly done',
        lifeAreaEmoji: '🫀',
        durationSeconds: 60,
        nudgeCheckpoints: [30],
        triggeredCheckpointIndices: [0],
        startedAt: new Date(Date.now() - 57_000).toISOString(),
        deadline: new Date(Date.now() + 3_000).toISOString(),
        cadenceCount: 1,
      }),
    ],
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Finished sprint' })).toBeVisible({
    timeout: 15_000,
  });
}

test('a close pops in place, the daily goal and a Confirm celebrate full screen', async ({
  page,
}) => {
  const email = await signUpAndEnter(page, 'celebrate');
  const uid = await uidFor(email);
  await expect(layer(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(layer(page)).toHaveAttribute('data-burst-count', '0');

  // A goal of one, so the first close crosses it.
  await page.goto('/settings');
  const goal = page.getByRole('button', { name: 'Decrease daily goal' });
  for (let i = 0; i < 4; i += 1) await goal.click();
  await page.getByRole('link', { name: 'Today' }).first().click();
  await expect(page.getByRole('img', { name: '0 of 1 closed today' })).toBeVisible();

  const card = page.getByRole('region', { name: 'Best next move' });
  await card.getByRole('button', { name: 'Close it' }).click();
  // The pop from the button, then the daily-goal milestone over it.
  await expect(layer(page)).toHaveAttribute('data-burst-count', '2');
  await expect(layer(page)).toHaveAttribute('data-last-burst', 'milestone');
  await expect(layer(page)).toHaveAttribute('data-celebrating', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Daily goal reached' })).toHaveText(
    'Daily goal reached — 1 of 1 closed today',
  );
  // A 5.4 s celebration, then the layer stops drawing.
  await expect(layer(page)).toHaveAttribute('data-celebrating', 'false', { timeout: 10_000 });

  await finishASprint(page, uid);
  const before = Number(await layer(page).getAttribute('data-burst-count'));
  await page
    .getByRole('region', { name: 'Finished sprint' })
    .getByRole('button', { name: 'Confirm this finished sprint' })
    .click();
  await expect(layer(page)).toHaveAttribute('data-last-burst', 'confirm');
  await expect(layer(page)).toHaveAttribute('data-burst-count', String(before + 1));
  await expect(layer(page)).toHaveAttribute('data-celebrating', 'true');
});

test('with Celebrations off a Confirm plays nothing while a close still pops', async ({ page }) => {
  const email = await signUpAndEnter(page, 'celebrate-off');
  const uid = await uidFor(email);

  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Celebrations', exact: true });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Celebration sounds' })).not.toBeChecked();

  await finishASprint(page, uid);
  await page
    .getByRole('region', { name: 'Finished sprint' })
    .getByRole('button', { name: 'Confirm this finished sprint' })
    .click();
  await expect(page.getByRole('region', { name: 'Finished sprint' })).toHaveCount(0);
  await expect(layer(page)).toHaveAttribute('data-burst-count', '0');

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Close task' }).first().click();
  await expect(layer(page)).toHaveAttribute('data-last-burst', 'pop');
  await expect(layer(page)).toHaveAttribute('data-burst-count', '1');
});
