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
  const field = card.getByLabel('Age', { exact: true });
  if (!(await field.isVisible())) await card.getByRole('button', { name: 'Type an age' }).click();
  await field.fill(String(value));
  await card.getByLabel('Unit').selectOption({ label: unit });
  await card.getByRole('button', { name: 'Set age' }).click();
}

export async function addSecondChild(page: Page) {
  await page.getByRole('button', { name: '+ Second child' }).click();
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

/** Open the planner without generating anything ("Any" → "Make a plan"), then start a blank plan at `start`. */
export async function blankPlan(page: Page, start = '13:00') {
  await choose(page, 'Minutes you have', 'Any');
  await page.getByRole('button', { name: 'Make a plan' }).click();
  await page.getByRole('button', { name: 'Start a blank plan' }).click();
  await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
  await page.getByLabel('Start', { exact: true }).fill(start);
}

export async function addBlock(page: Page, item: string) {
  await page.getByRole('button', { name: /^\+ Add block/ }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/** Add a nap, milk feed, meal, or snack with the routine form. Length is a quick chip label such as "1 hr". */
export async function addRoutine(page: Page, opts: { routine: 'Nap' | 'Milk feed' | 'Meal' | 'Snack'; who?: 'Child 1' | 'Child 2' | 'Both'; at?: string; length: string; adult?: string }) {
  await addBlock(page, opts.routine);
  const form = page.getByRole('form', { name: `Add a ${opts.routine.toLowerCase()}` });
  await expect(form).toBeVisible();
  if (opts.who) await form.getByRole('radio', { name: opts.who, exact: true }).check();
  if (opts.at) await form.getByLabel('Starts').fill(opts.at);
  await form.getByRole('radio', { name: opts.length, exact: true }).check();
  if (opts.adult) await form.getByLabel(/naps, you’re/).selectOption({ label: opts.adult });
  await form.getByRole('button', { name: `Add ${opts.routine.toLowerCase()}` }).click();
  await expect(form).toHaveCount(0);
}

/** A plan row by its visible title (routines, activities, custom entries). */
export function row(page: Page, title: string | RegExp) {
  return page.locator('li.seg').filter({ has: page.locator('.seg-title-text', { hasText: title }) });
}

export async function readPngSize(path: string) {
  const { readFileSync } = await import('node:fs');
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
