import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { choose, freshStart, setAge, trackErrors } from './helpers.ts';

// Regression tests for docs/review/integration-review.md findings M1–M4.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const catalog = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src/generated/catalog.json'), 'utf8')) as {
  activities: { title: string; places: string[] }[];
};

test('M1: plans saved in two tabs are both kept, and the other tab updates live', async ({ context }) => {
  const a = await context.newPage();
  await freshStart(a);
  const b = await context.newPage();
  await b.goto('');
  for (const [page, name] of [[b, 'From tab B'], [a, 'From tab A']] as const) {
    await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
    await page.getByLabel('Plan name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved in this browser.')).toBeVisible();
  }
  const stored = await a.evaluate(() => JSON.parse(localStorage.getItem('trunk.plans')!).plans.map((p: { title: string }) => p.title));
  expect(stored.sort()).toEqual(['From tab A', 'From tab B']);
  await b.goto('#/saved');
  await expect(b.locator('.saved-title', { hasText: 'From tab A' })).toBeVisible();
});

test('M2: "Plan the next 30 minutes" starts from now, not from when the page loaded', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T08:00:00') });
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await page.locator('details.more summary', { hasText: 'More filters' }).click();
  await choose(page, 'Where', 'Outside');
  await page.clock.fastForward('03:05:00');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(page.getByLabel('Start')).toHaveValue('11:05');
  await expect(page.locator('.plan-summary')).toContainText('11:05 AM');
  // Nothing outdoors is scheduled for a 4-month-old in the midday window.
  await expect(page.locator('.timeline .safety-line', { hasText: 'Outdoors between 10 a.m. and 4 p.m.' })).toHaveCount(0);
});

test('M3: Save and Share work when tapped while typing', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.getByLabel(/Private notes/).fill('Bring the blue blanket');
  // The notes field still has focus when Save is tapped.
  await page.getByRole('button', { name: 'Save', exact: true }).tap();
  await expect(page.getByText('Saved in this browser.')).toBeVisible();
  await page.getByLabel(/Private notes/).fill('Bring the blue blanket and a hat');
  await page.getByRole('button', { name: 'Share link' }).tap();
  await expect(page.getByRole('dialog', { name: 'Share this plan' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('M4: changing place on the planner applies to the open plan', async ({ page }) => {
  await freshStart(page);
  await setAge(page, 1, 30, 'months');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.locator('details.more summary', { hasText: 'Settings' }).click();
  await choose(page, 'Where', 'Inside');
  await page.getByRole('button', { name: /^\+ Add block/ }).click();
  await page.getByRole('menuitem', { name: 'Activity' }).click();
  const titles = await page.locator('.option-list li strong').allInnerTexts();
  expect(titles.length).toBeGreaterThan(0);
  for (const t of titles) {
    const record = catalog.activities.find((a) => a.title === t);
    expect(record?.places, t).toContain('indoors');
  }
});
