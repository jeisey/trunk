import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { addRoutine, addSecondChild, ARTIFACTS, blankPlan, choose, freshStart, noHorizontalOverflow, row, setAge, trackErrors } from './helpers.ts';

// Regression checks for docs/review/ui-review.md: menus on narrow phones (B1), one-child
// labels (M1), safety in shared previews (M2), focus targets (M3), keyboard Undo (M4),
// "Add to plan" placement (M6), compact detail timing (M7), focus never under the nav (M9),
// and a few minors.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const timeline = (page: Page) => page.getByRole('list', { name: 'Plan timeline' });
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a && a !== document.body ? `${a.tagName}|${a.getAttribute('aria-label') ?? ''}|${(a.textContent ?? '').trim().slice(0, 40)}|${a.className}` : 'BODY';
});

/** Two children (4 and 28 months), a nap for Child 1 with a settling time, filled around. */
async function napPlan(page: Page) {
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await blankPlan(page, '10:00');
  await addRoutine(page, { routine: 'Nap', who: 'Child 1', at: '10:00', length: '1 hr', adult: 'Free after settling about 10 min' });
  await page.getByRole('button', { name: 'Fill around these blocks' }).click();
  await expect(page.locator('.along-track li.seg-activity').first()).toBeVisible();
}

for (const width of [320, 360, 375]) {
  test(`B1: menus stay on screen at ${width}px (and at 200% text), and "⋯" never wraps alone`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width, height: 700 });
    await napPlan(page);
    const inView = async (label: string) => {
      const box = await page.getByRole('menu').boundingBox();
      expect(box, label).not.toBeNull();
      expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(width);
      await noHorizontalOverflow(page);
    };
    const menus = page.locator('.seg-tools .menu-button');
    const n = await menus.count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) {
      await menus.nth(i).click();
      await inView(`row menu ${i}`);
      await page.keyboard.press('Escape');
    }
    // "⋯" stays on the same line as the ↑ / ↓ buttons.
    const lines = await page.$$eval('.seg-tools', (els) =>
      els.map((el) => {
        const up = el.querySelector('[data-move="-1"]')!.getBoundingClientRect().top;
        const more = el.querySelector('.menu-button')!.getBoundingClientRect().top;
        return Math.abs(up - more);
      }),
    );
    expect(Math.max(...lines)).toBeLessThan(2);
    await page.getByRole('button', { name: /^\+ Add block/ }).click();
    await inView('Add block');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^\+ Add for Child 2/ }).click();
    await inView('Add for Child 2');
    await page.keyboard.press('Escape');
    // 200% text: menus are no wider than the screen.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: /^\+ Add block/ }).click();
    await inView('Add block at 200%');
    await page.keyboard.press('Escape');
    await menus.first().click();
    await inView('row menu at 200%');
    await page.keyboard.press('Escape');
    if (width === 320) await page.screenshot({ path: join(ARTIFACTS, 'ui-menus-320.png') });
    expect(errors).toEqual([]);
  });
}

test('M1: a one-child plan for Child 2 uses one label everywhere', async ({ page, browser }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 28, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 4, 'months');
  await choose(page, 'Who’s this for?', 'Child 2');
  await page.getByRole('group', { name: 'Child 2', exact: true }).getByRole('button', { name: 'Nap soon' }).click();
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(timeline(page)).toBeVisible();
  await expect(page.locator('.moment-line')).toHaveText('Planned for: nap soon');
  await expect(page.locator('main')).not.toContainText(/Child 1|Child 2/);
  await expect(timeline(page).locator('.tracks .who', { hasText: 'Your child' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this plan' });
  await expect(dialog.locator('.preview-box')).toContainText('Your child: about 4 months');
  await expect(dialog.locator('.preview-box')).not.toContainText(/Child [12]/);
  const url = await dialog.getByLabel(/Link \(/).inputValue();
  await dialog.getByRole('button', { name: 'Close' }).click();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
  await expect(other.locator('main')).not.toContainText(/Child [12]/);
  // The image header uses the same label (saved for visual review).
  await page.getByRole('button', { name: 'Save as image' }).click();
  const exp = page.getByRole('dialog', { name: 'Save as image' });
  await expect(exp.getByRole('link', { name: /^Download/ }).first()).toBeVisible({ timeout: 20_000 });
  const d = page.waitForEvent('download');
  await exp.getByRole('link', { name: /^Download/ }).first().click();
  await (await d).saveAs(join(ARTIFACTS, 'ui-m1-one-child-feed-1.png'));
  await ctx.close();
  expect(errors).toEqual([]);
});

test('M2: the shared preview shows the same safety lines as the editor', async ({ page, browser }) => {
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(timeline(page)).toBeVisible();
  const editor = await timeline(page).locator('li.seg-recipe, li.seg-activity').evaluateAll((els) => els.map((el) => [...el.querySelectorAll('.safety-line')].map((x) => x.textContent)));
  expect(editor.flat().length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Share link' }).click();
  const url = await page.getByRole('dialog').getByLabel(/Link \(/).inputValue();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  await other.goto(url);
  const shared = other.getByRole('list', { name: 'Plan timeline' });
  await expect(shared).toBeVisible();
  const preview = await shared.locator('li.seg-recipe, li.seg-activity').evaluateAll((els) => els.map((el) => [...el.querySelectorAll('.safety-line')].map((x) => x.textContent)));
  expect(preview).toEqual(editor);
  await ctx.close();
});

test('M3: focus lands somewhere sensible after actions that remove the control used', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  // Reset on Find → the filters disclosure.
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('details.filters > summary')).toBeFocused();
  // Remove child → "+ Second child".
  await addSecondChild(page);
  await page.getByRole('button', { name: 'Remove child 2' }).click();
  await expect(page.getByRole('button', { name: '+ Second child' })).toBeFocused();
  // Start a blank plan → "+ Add block".
  await choose(page, 'Minutes you have', 'Any');
  await page.getByRole('button', { name: 'Make a plan' }).click();
  await page.getByRole('button', { name: 'Start a blank plan' }).click();
  await expect(page.getByRole('button', { name: /^\+ Add block/ })).toBeFocused();
  // Close plan → the page heading; Fill the next N minutes → the first entry.
  await page.getByRole('button', { name: 'Close plan' }).click();
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Fill the next 90 minutes' }).click();
  await expect(page.locator('.plan-editor .seg-title-text').first()).toBeFocused();
  // Extend → the plan summary.
  await page.getByRole('radiogroup', { name: 'Minutes' }).getByLabel('30', { exact: true }).check();
  await page.getByRole('button', { name: /^Extend to \d+ min$/ }).click();
  await expect(page.locator('.plan-summary')).toBeFocused();
  // Share and image dialogs: Escape returns focus to the button that opened them.
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(page.getByRole('dialog', { name: 'Share this plan' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share link' })).toBeFocused();
  await page.getByRole('button', { name: 'Save as image' }).click();
  await expect(page.getByRole('dialog', { name: 'Save as image' }).getByRole('link', { name: /^Download/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save as image' })).toBeFocused();
  // A repair keeps focus on the entry it fixed. A nap 10 minutes in collides with the first entry.
  const start = await page.getByLabel('Start', { exact: true }).inputValue();
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m + 10;
  const at = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  await page.getByRole('button', { name: /^\+ Add block/ }).click();
  await page.getByRole('menuitem', { name: 'Nap', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add a nap' });
  await form.getByLabel('Starts').fill(at);
  await form.getByRole('radio', { name: '30 min', exact: true }).check();
  await form.getByRole('button', { name: 'Add nap' }).click();
  const fix = timeline(page).locator('.repairs button').first();
  await expect(fix).toBeVisible();
  await fix.click();
  // Focus moves after the plan re-renders (the clicked button is gone by then), so wait for it.
  await expect(page.locator('.plan-editor .seg-title-text:focus')).toHaveCount(1);
  expect(await focused(page)).not.toBe('BODY');
  expect(errors).toEqual([]);
});

test('M4: Undo after deleting a saved plan is reachable by keyboard, in place', async ({ page }) => {
  await freshStart(page);
  for (const name of ['First plan', 'Second plan']) {
    await page.goto('#/');
    await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
    await page.getByLabel('Plan name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved on this device\.|Changes saved/)).toBeVisible();
  }
  await page.goto('#/saved');
  const more = page.getByRole('button', { name: 'More: First plan', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Enter');
  const undo = page.getByRole('button', { name: 'Deleted “First plan”. Undo' });
  await expect(undo).toBeFocused();
  await expect(page.getByText('Saved on this device · 1/10')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'ui-saved-deleted-390.png') });
  await page.waitForTimeout(9000); // longer than the old toast lasted
  await expect(undo).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Saved on this device · 2/10')).toBeVisible();
  await expect(page.locator('.saved-title a', { hasText: 'First plan' })).toBeFocused();
  await expect(page.locator('.saved-title').first()).toHaveText('First plan');
});

test('M6: "Add to plan" from a detail page goes alongside only where the planner allows it', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 28, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 4, 'months');
  await blankPlan(page, '10:00');
  // Child 2's nap with unknown availability: nothing should be put alongside it.
  await addRoutine(page, { routine: 'Nap', who: 'Child 2', at: '10:00', length: '1 hr' });
  await page.goto('#/');
  await choose(page, 'Who’s this for?', 'Child 1');
  await page.goto('#/a/act.stack-and-topple');
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await expect(timeline(page)).toBeVisible();
  await expect(page.locator('.along-track li.seg-activity')).toHaveCount(0);
  await expect(page.locator('.toast')).not.toContainText(/alongside/);
  await expect(row(page, 'Stack it and knock it down')).toBeVisible();
  // With a settling time, the same idea fits alongside the nap.
  await row(page, 'Nap').getByLabel(/naps, you’re/).selectOption({ label: 'Free after settling about 10 min' });
  await row(page, 'Stack it and knock it down').getByRole('button', { name: 'More: Stack it and knock it down' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.goto('#/a/act.stack-and-topple');
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await expect(page.locator('.along-track li.seg-activity', { hasText: 'Stack it and knock it down' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('alongside Child 2’s nap');
  expect(errors).toEqual([]);
});

test('M7: detail timing is one line plus "now" lines, the rest in one disclosure; steps are near the top', async ({ page }) => {
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await page.goto('#/a/act.tummy-time-reach-and-play');
  const timing = page.locator('section.timing');
  await expect(timing.locator(':scope > .cue-list > li')).toHaveCount(1);
  await expect(timing.locator(':scope > .cue-list summary')).toHaveText('Best not right before or after a feed');
  await expect(timing.locator('details.timing-notes > summary')).toHaveText(/^Timing notes \(\d+\)$/);
  // Meal rules don't apply under 6 months (meals are for children eating solids).
  for (const t of await timing.locator('summary').allInnerTexts()) expect(t).not.toMatch(/eating|meal/i);
  const stepsTop = await page.getByRole('heading', { name: 'Steps' }).evaluate((el) => el.getBoundingClientRect().top);
  expect(stepsTop).toBeLessThan(700);
  await page.screenshot({ path: join(ARTIFACTS, 'ui-detail-timing-390.png') });
  // "Just fed" adds the rules that apply now, still compact.
  await page.goto('#/');
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
  await page.goto('#/a/act.tummy-time-reach-and-play');
  await expect(timing.locator('.now-tag').first()).toBeVisible();
  expect(await timing.locator(':scope > .cue-list > li').count()).toBeLessThanOrEqual(3);
  // A pairing for 4 and 28 months is compact too.
  await page.goto('#/');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await page.goto('#/r/mix.tummy-time-book-helper');
  await expect(page.locator('section.timing > .cue-list > li').first()).toBeVisible();
  expect(await page.locator('section.timing > .cue-list > li').count()).toBeLessThanOrEqual(3);
  const recipeSteps = await page.getByRole('heading', { name: 'Steps' }).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  expect(recipeSteps).toBeLessThan(1500);
  // m8: with two children on "Both", a single-child page says how to add it.
  await page.goto('#/a/act.stack-and-topple');
  await expect(page.locator('.add-hint')).toHaveText(/choose Child 1 or Child 2/);
});

test('M9: keyboard focus never sits under the bottom nav on the Plan screen', async ({ page }) => {
  await napPlan(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('main h1').focus();
  const hidden: string[] = [];
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect();
      if (!a || a.closest('.bottom-nav') || a === document.body) return null;
      const b = a.getBoundingClientRect();
      return b.bottom > nav.top + 1 ? `${a.tagName} ${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim().slice(0, 30)} ${Math.round(b.top)}-${Math.round(b.bottom)} nav ${Math.round(nav.top)}` : null;
    });
    if (r) hidden.push(r);
  }
  expect(hidden).toEqual([]);
});

test('minors: change a routine, numbered copies, save state on the Plan screen', async ({ page }) => {
  const errors = trackErrors(page);
  await napPlan(page);
  // m11: a routine's type, child, time, and length can be changed after adding it.
  await row(page, 'Nap').getByRole('button', { name: 'More: Nap' }).click();
  await page.getByRole('menuitem', { name: 'Change nap…' }).click();
  const form = page.getByRole('form', { name: 'Change this nap' });
  await expect(form.getByRole('radio', { name: '1 hr', exact: true })).toBeChecked();
  await expect(form).toContainText('the child stays the same');
  await form.getByRole('radio', { name: 'Milk feed', exact: true }).check();
  await form.getByRole('radio', { name: '30 min', exact: true }).check();
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(row(page, 'Milk feed').locator('.seg-time')).toContainText('10:00 AM–10:30 AM');
  await expect(row(page, 'Nap')).toHaveCount(0);
  // n5: save state, in the same words as the Saved list.
  await expect(page.locator('.save-state')).toHaveText('Not saved yet');
  await page.getByLabel('Plan name').fill('Busy morning');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('Saved on this device');
  await page.getByLabel('Plan name').fill('Busy morning!');
  await expect(page.locator('.save-state')).toHaveText('Changes not saved yet');
  // m6: copies are numbered.
  await page.goto('#/saved');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'More: Busy morning', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  }
  await expect(page.locator('.saved-title')).toHaveText(['Busy morning', 'Copy of Busy morning', 'Copy 2 of Busy morning']);
  expect(errors).toEqual([]);
});

test('M5: rows stay in time order when a set time lands inside a nap, and the conflict shows on both entries', async ({ page }) => {
  const errors = trackErrors(page);
  await napPlan(page);
  // The first main entry after the nap, given a time inside the nap.
  const main = timeline(page).locator(':scope > li.seg.seg-recipe').first();
  const title = (await main.locator('.seg-title-text').innerText()).trim();
  await main.getByRole('button', { name: `More: ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Set a time' }).click();
  await row(page, title).getByLabel(`${title} starts at`).fill('10:30');
  await row(page, title).getByRole('button', { name: 'Set' }).click();
  // Every row in the list, nested tracks included, reads in time order.
  const starts = await timeline(page).locator('li.seg .seg-time').evaluateAll((els) =>
    els.map((el) => {
      const m = /(\d+):(\d+) (AM|PM)/.exec(el.textContent ?? '')!;
      return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
    }),
  );
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  await expect(page.locator('.along-track .track-head', { hasText: '(continued)' })).toHaveCount(1);
  // The conflict is on the moved entry itself, not only on the nap several screens up.
  await expect(row(page, title).locator('.conflict').first()).toBeVisible();
  for (const b of await row(page, title).locator('.repairs button').allInnerTexts()) expect(b).not.toMatch(/^$/);
  await page.screenshot({ path: join(ARTIFACTS, 'ui-m5-split-track-390.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('m12: share dialog at 320px keeps checkbox labels inline and Copy link above the preview', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await napPlan(page);
  await page.getByLabel('Plan name').fill('A long plan name for a busy Tuesday');
  await page.getByRole('button', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this plan' });
  const box = await dialog.getByRole('checkbox', { name: /Plan name/ }).boundingBox();
  const label = await dialog.locator('label.check', { hasText: 'Plan name' }).boundingBox();
  expect(Math.abs(box!.y + box!.height / 2 - (label!.y + Math.min(label!.height, 44) / 2))).toBeLessThan(24);
  const copy = await dialog.getByRole('button', { name: 'Copy link' }).boundingBox();
  const preview = await dialog.locator('.preview-box').boundingBox();
  expect(copy!.y).toBeLessThan(preview!.y);
  await page.screenshot({ path: join(ARTIFACTS, 'ui-share-320.png') });
});
