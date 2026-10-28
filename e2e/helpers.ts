import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const ARTIFACTS = join(import.meta.dirname, '..', 'review-artifacts');
mkdirSync(ARTIFACTS, { recursive: true });

export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Set a child's age with the explicit typed input (the accessible alternative to the slider). */
export async function setAge(page: Page, child: 1 | 2, value: number, unit: 'weeks' | 'months' | 'years') {
  const card = page.getByRole('group', { name: `Child ${child}`, exact: true });
  await card.getByRole('button', { name: 'Type an age' }).click();
  await card.getByLabel('Age', { exact: true }).fill(String(value));
  await card.getByLabel('Unit').selectOption({ label: unit });
  await card.getByRole('button', { name: 'Set age' }).click();
}

export async function addSecondChild(page: Page) {
  await page.getByRole('button', { name: '+ Add a second child' }).click();
  await expect(page.getByRole('group', { name: 'Child 2', exact: true })).toBeVisible();
}

export async function choose(page: Page, group: string, option: string) {
  await page.getByRole('radiogroup', { name: group }).getByLabel(option, { exact: true }).check();
}

export async function freshStart(page: Page, path = '') {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.goto(path);
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}
