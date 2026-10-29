import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addSecondChild, freshStart, setAge } from './helpers.ts';

// Automated accessibility scan (WCAG 2.1 A/AA rules in axe-core). Automated
// checks catch only part of accessibility; keyboard and zoom checks live in
// journeys.spec.ts.
test.use({ viewport: { width: 390, height: 844 } });

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('find, detail, plan, saved, and about pages have no axe violations', async ({ page }) => {
  await freshStart(page);
  expect(await scan(page)).toEqual([]);
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await page.locator('details.more summary', { hasText: 'More filters' }).click();
  expect(await scan(page)).toEqual([]);
  await page.goto('#/a/act.tummy-time-floor-face-to-face');
  await page.locator('details.sources summary').click();
  expect(await scan(page)).toEqual([]);
  await page.goto('#/');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.goto('#/saved');
  expect(await scan(page)).toEqual([]);
  await page.goto('#/about');
  expect(await scan(page)).toEqual([]);
});

test('share and image dialogs have no axe violations', async ({ page }) => {
  await freshStart(page);
  await setAge(page, 1, 20, 'months');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(page.getByLabel(/Link \(/)).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Save as image' }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /^Download/ }).first()).toBeVisible({ timeout: 20_000 });
  expect(await scan(page)).toEqual([]);
});
