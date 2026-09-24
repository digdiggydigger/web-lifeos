import { expect, test } from '@playwright/test';

import { signUpAndEnter, uidFor } from './support';

test.use({ permissions: ['notifications'] });

test('start from Today, pause, extend, collapse, the detail, cadence, stop with confirmation, the analytics', async ({
  page,
}) => {
  await signUpAndEnter(page, 'focus');
  const card = page.getByRole('region', { name: 'Best next move' });
  await card.getByRole('button', { name: 'Start session' }).click();

  const bar = page.getByRole('region', { name: 'Focus sprint' });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Take a 10-minute walk' })).toBeVisible();
  await expect(bar.getByRole('img', { name: /^1[45]:\d\d remaining$/ })).toBeVisible();
  await expect(bar.getByText(/Next checkpoint in/)).toBeVisible();
  await expect(card.getByRole('button', { name: /session/i })).toHaveCount(0);

  await bar.getByRole('button', { name: 'Pause' }).click();
  await expect(bar.getByText('Paused')).toBeVisible();
  await expect(bar.getByRole('img', { name: /^Paused, / })).toBeVisible();
  await bar.getByRole('button', { name: 'Resume' }).click();
  await bar.getByRole('button', { name: '+5m' }).click();
  await expect(bar.getByRole('img', { name: /^(19|20):\d\d remaining$/ })).toBeVisible();

  await bar.getByRole('button', { name: 'Collapse the sprint card' }).click();
  await expect(bar.getByRole('button', { name: 'Pause sprint' })).toBeVisible();
  await page.reload();
  const restored = page.getByRole('region', { name: 'Focus sprint' });
  await expect(restored.getByRole('button', { name: 'Pause sprint' })).toBeVisible();
  await restored.getByRole('button', { name: 'Expand the sprint card' }).click();

  await restored.getByRole('link', { name: 'Take a 10-minute walk' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Focus sprint' })).toBeVisible();
  await expect(page.getByText('Active focus sprint')).toBeVisible();
  await expect(page.getByText('2 checkpoints', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change cadence' }).click();
  await page.getByRole('button', { name: 'By interval' }).click();
  await page.getByRole('button', { name: 'Every 120 seconds' }).click();
  await expect(page.getByText(/^\d+ nudges — every 2m$/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply to sprint' }).click();
  await expect(page.getByText(/^\d+ of (9|10) passed$/)).toBeVisible();

  await page.getByRole('button', { name: 'Close it' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('This sprint will end and nothing will be logged.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Focus sprint' })).toBeVisible();
  await page.getByRole('button', { name: 'Close it' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop sprint' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sprint finished' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Focus sprint' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Start session' })).toBeVisible();

  const trend = page.getByRole('region', { name: '7-Day Trend' });
  await expect(trend).toBeVisible();
  await trend.getByRole('button', { name: 'Sessions' }).click();
  await expect(trend.getByText('1 sessions')).toBeVisible();
});

test('a sprint persisted by a previous tab: an expired one reports itself, a live one finishes and asks for a Confirm', async ({
  page,
}) => {
  const email = await signUpAndEnter(page, 'focus-restore');
  const uid = await uidFor(email);
  const key = `focus.sprint.running.${uid}`;

  await page.evaluate(
    ([storageKey, value]) => localStorage.setItem(storageKey!, value!),
    [
      key,
      JSON.stringify({
        taskTitle: 'Died mid-sprint',
        lifeAreaEmoji: '💼',
        durationSeconds: 600,
        nudgeCheckpoints: [300],
        triggeredCheckpointIndices: [],
        startedAt: new Date(Date.now() - 900_000).toISOString(),
        deadline: new Date(Date.now() - 300_000).toISOString(),
        cadenceCount: 1,
      }),
    ],
  );
  await page.reload();
  const offline = page.getByRole('region', { name: 'Sprint finished while you were away' });
  await expect(offline).toBeVisible();
  await expect(offline.getByText('10 of 10 minutes logged · 1 checkpoint')).toBeVisible();
  await offline.getByRole('button', { name: 'Got it' }).click();
  await expect(offline).toHaveCount(0);

  await page.evaluate(
    ([storageKey, value]) => localStorage.setItem(storageKey!, value!),
    [
      key,
      JSON.stringify({
        taskTitle: 'Nearly done',
        lifeAreaEmoji: '🫀',
        durationSeconds: 60,
        nudgeCheckpoints: [30],
        triggeredCheckpointIndices: [0],
        startedAt: new Date(Date.now() - 56_000).toISOString(),
        deadline: new Date(Date.now() + 4_000).toISOString(),
        cadenceCount: 1,
      }),
    ],
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Focus sprint' })).toBeVisible();
  const finished = page.getByRole('region', { name: 'Finished sprint' });
  await expect(finished).toBeVisible({ timeout: 15_000 });
  await expect(finished.getByText('1m focused · 1 checkpoint')).toBeVisible();
  await finished.getByRole('button', { name: 'Confirm this finished sprint' }).click();
  await expect(finished).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Focus sprint' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: "This Week's Focus" })).toContainText('11m');
});
