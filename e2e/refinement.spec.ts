import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { addBlock, addRoutine, addSecondChild, ARTIFACTS, blankPlan, choose, freshStart, readPngSize, row, setAge, trackErrors } from './helpers.ts';

// Timing-aware refinement: duration consistency, momentary context, routine blocks,
// two-child plans, v1 compatibility, and where general caveats live.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const timeline = (page: Page) => page.getByRole('list', { name: 'Plan timeline' });

test('duration: Find minutes carry into the planner; "Any" opens it without generating', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 18, 'months');

  // "Any": the planner opens with its own duration showing (90), and nothing is made until asked.
  await choose(page, 'Minutes you have', 'Any');
  await expect(page.getByRole('button', { name: 'Make a plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Make a plan' }).click();
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Minutes' }).getByLabel('90', { exact: true })).toBeChecked();
  await expect(timeline(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fill the next 90 minutes' })).toBeVisible();
  await page.getByRole('button', { name: 'Fill the next 90 minutes' }).click();
  await expect(timeline(page)).toBeVisible();
  await expect(page.locator('.plan-summary')).toContainText('of 1 hr 30 min');

  for (const minutes of [30, 10, 20]) {
    await page.goto('#/');
    await choose(page, 'Minutes you have', String(minutes));
    const cta = page.getByRole('button', { name: `Plan the next ${minutes} minutes` });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(timeline(page)).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Minutes' }).getByLabel(String(minutes), { exact: true })).toBeChecked();
    await expect(page.locator('.plan-summary')).toContainText(`of ${minutes} min`);
    await expect(page.locator('.plan-summary')).not.toContainText('past your window');
  }
  // A deliberate 90 stays available next to the incoming value.
  await expect(page.getByRole('radiogroup', { name: 'Minutes' }).getByLabel('90', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('right now: "Just fed" and "Nap soon" together, per child, cleared by Reset and by a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 2, 'months');
  const child1 = page.getByRole('group', { name: 'Child 1', exact: true });
  const fed = child1.getByRole('button', { name: 'Just fed' });
  const nap = child1.getByRole('button', { name: 'Nap soon' });

  // Feed alone sets tummy time aside, with the reason, distinct from age/safety exclusions.
  await fed.click();
  await expect(fed).toHaveAttribute('aria-pressed', 'true');
  const aside = page.locator('details.set-aside');
  await expect(aside.locator('summary')).toContainText(/\d+ ideas? set aside for now/);
  await aside.locator('summary').click();
  await expect(aside).toContainText('Not right after a feed');
  await expect(aside).toContainText(/not because of age, readiness, or supervision/);
  const asideCount = await aside.locator('li').count();
  expect(asideCount).toBeGreaterThan(0);
  for (const t of await aside.locator('li a').allInnerTexts()) await expect(page.locator('.idea-list .idea-title', { hasText: t })).toHaveCount(0);

  // Both on for the same child (independent toggles): nap cues appear and the feed still applies.
  await nap.click();
  await expect(fed).toHaveAttribute('aria-pressed', 'true');
  await expect(nap).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.idea-list .cue-line').first()).toBeVisible();
  await expect(aside.locator('li')).toHaveCount(asideCount);
  // Optional precision: fed an hour ago clears the feed window, the nap cues stay.
  await child1.getByLabel('Child 1: fed how long ago').selectOption({ label: 'an hour or more ago' });
  await expect(aside.locator('summary')).toContainText('Nothing set aside');
  await expect(page.locator('.idea-list .cue-line').first()).toBeVisible();
  await child1.getByLabel('Child 1: fed how long ago').selectOption({ label: 'just now' });
  await expect(aside.locator('summary')).toContainText(/set aside for now/);

  // Two children: each child has their own toggles.
  await addSecondChild(page);
  const child2 = page.getByRole('group', { name: 'Child 2', exact: true });
  await expect(child2.getByRole('button', { name: 'Just fed' })).toHaveAttribute('aria-pressed', 'false');
  await child2.getByRole('button', { name: 'Nap soon' }).click();
  await expect(child2.getByRole('button', { name: 'Nap soon' })).toHaveAttribute('aria-pressed', 'true');
  await expect(fed).toHaveAttribute('aria-pressed', 'true');

  // Never stored anywhere.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toMatch(/"fed"|"nap"|napIn|fedAgo/);

  // Reset clears them (and the filters); a reload never revives them.
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(fed).toHaveAttribute('aria-pressed', 'false');
  await expect(child2.getByRole('button', { name: 'Nap soon' })).toHaveAttribute('aria-pressed', 'false');
  await expect(aside).toHaveCount(0);
  await fed.click();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' })).toHaveAttribute('aria-pressed', 'false');

  // Planning from Find carries the moment into that plan only, as one line.
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
  await choose(page, 'Who’s this for?', 'Child 1');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(page.locator('.moment-line')).toHaveText('Planned for: Child 1 just fed');
  await expect(timeline(page).locator('.seg-title-text', { hasText: /tummy/i })).toHaveCount(0);
  await page.reload();
  await expect(timeline(page)).toBeVisible();
  await expect(page.locator('.moment-line')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('routine lifecycle: blank plan, nap/feed/meal/own entry, edit, reorder, fill around, save, reload, share, file, image', async ({ page, browser }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 8, 'months');
  await blankPlan(page, '13:00');
  await expect(page.getByText('This plan is empty.')).toBeVisible();

  // No length is pre-selected: the parent picks one.
  await addBlock(page, 'Nap');
  const napForm = page.getByRole('form', { name: 'Add a nap' });
  await expect(napForm.getByRole('radio', { checked: true })).toHaveCount(0);
  await napForm.getByLabel('Starts').fill('13:30');
  await napForm.getByRole('button', { name: 'Add nap' }).click();
  await expect(napForm.getByRole('alert')).toHaveText('Choose about how long first.');
  await napForm.getByRole('radio', { name: '1 hr', exact: true }).check();
  await napForm.getByRole('button', { name: 'Add nap' }).click();

  await addRoutine(page, { routine: 'Milk feed', at: '14:40', length: '15 min' });
  await addRoutine(page, { routine: 'Meal', at: '15:00', length: '20 min' });
  await addBlock(page, 'Your own entry');
  await page.getByLabel('What').fill('Library story time');
  await page.getByRole('spinbutton', { name: 'Minutes' }).fill('20');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:30 PM–2:30 PM');
  await expect(row(page, 'Milk feed').locator('.seg-time')).toContainText('2:40 PM–2:55 PM');
  await expect(row(page, 'Meal').locator('.seg-time')).toContainText('3:00 PM–3:20 PM');
  await expect(row(page, 'Library story time')).toBeVisible();

  // Edit a routine's time and length.
  await row(page, 'Nap').getByRole('button', { name: /change the time of Nap/ }).click();
  await row(page, 'Nap').getByLabel('Nap starts at').fill('13:15');
  await row(page, 'Nap').getByRole('button', { name: 'Set' }).click();
  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:15 PM–2:15 PM');
  await row(page, 'Nap').getByRole('button', { name: 'Longer: Nap' }).click();
  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:15 PM–2:20 PM');

  // Reorder: the own entry moves earlier, and focus follows it.
  const order = () => timeline(page).locator(':scope > li.seg:not(.open) .seg-title-text').allInnerTexts();
  const before = await order();
  await row(page, 'Library story time').getByRole('button', { name: 'Move earlier: Library story time' }).click();
  const after = await order();
  expect(after.indexOf('Library story time')).toBeLessThan(before.indexOf('Library story time'));
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /Library story time/);

  // Starting later moves everything, routines included.
  await page.getByLabel('Start', { exact: true }).fill('13:30');
  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:45 PM–2:50 PM');
  await page.getByLabel('Start', { exact: true }).fill('13:00');

  // Fill around keeps routines and the parent's entry where they are.
  await page.getByRole('button', { name: 'Fill around these blocks' }).click();
  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:15 PM–2:20 PM');
  await expect(row(page, 'Meal').locator('.seg-time')).toContainText('3:00 PM–3:20 PM');
  await expect(row(page, 'Library story time')).toBeVisible();
  await expect(timeline(page).locator('li.seg-activity').first()).toBeVisible();

  await page.getByLabel('Plan name').fill('Rainy afternoon');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved in this browser.')).toBeVisible();
  await page.reload();
  await expect(row(page, 'Nap').locator('.seg-time')).toContainText('1:15 PM–2:20 PM');
  await expect(row(page, 'Milk feed')).toBeVisible();
  await page.goto('#/saved');
  await expect(page.locator('.saved-item').first()).toContainText('Nap 1:15 PM');
  await page.locator('.saved-title a').first().click();
  await expect(timeline(page)).toBeVisible();

  // Share link → a fresh browser with no storage: routine types survive; own text is not included or guessed.
  await page.getByRole('button', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this plan' });
  await expect(dialog.locator('.preview-box')).toContainText('Nap');
  await expect(dialog.locator('.preview-box')).not.toContainText('Library');
  const url = await dialog.getByLabel(/Link \(/).inputValue();
  expect(url).toContain('#/s/2z.');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download plan file' }).click();
  const filePath = join(ARTIFACTS, 'routine-plan.json');
  await (await download).saveAs(filePath);
  await dialog.getByRole('button', { name: 'Close' }).click();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  const otherErrors = trackErrors(other);
  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
  const shared = other.getByRole('list', { name: 'Plan timeline' });
  for (const r of ['Nap', 'Milk feed', 'Meal']) await expect(shared.locator('li.seg-routine', { hasText: r })).toHaveCount(1);
  await expect(shared).toContainText('Your own activity');
  await expect(other.locator('main')).not.toContainText('Library');
  await expect(shared.locator('li.seg-routine', { hasText: 'Nap' })).toContainText('1:15 PM–2:20 PM');

  // The plan file opens the same way (in the fresh browser).
  await other.goto(url.split('#')[0] + '#/saved');
  await other.locator('input[type="file"]').setInputFiles(filePath);
  await expect(other.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
  for (const r of ['Nap', 'Milk feed', 'Meal']) await expect(other.locator('li.seg-routine .seg-title-text', { hasText: r })).toHaveCount(1);
  await expect(other.locator('li.seg-custom')).toHaveCount(1);
  expect(otherErrors).toEqual([]);
  await ctx.close();

  // Image export of the same plan.
  await page.getByRole('button', { name: 'Save as image' }).click();
  const exp = page.getByRole('dialog', { name: 'Save as image' });
  await expect(exp.getByRole('link', { name: /^Download/ }).first()).toBeVisible({ timeout: 20_000 });
  const d = page.waitForEvent('download');
  await exp.getByRole('link', { name: /^Download/ }).first().click();
  const png = join(ARTIFACTS, 'routine-plan-feed-1.png');
  await (await d).saveAs(png);
  expect(await readPngSize(png)).toEqual({ width: 1080, height: 1350 });
  expect(errors).toEqual([]);
});

for (const order of ['baby first', 'toddler first'] as const) {
  test(`two children (4 and 28 months, ${order}): nap with toddler play alongside, meal leaves the baby unfilled, labels correct`, async ({ page, browser }) => {
    const errors = trackErrors(page);
    const babyIs = order === 'baby first' ? 'Child 1' : 'Child 2';
    const toddlerIs = babyIs === 'Child 1' ? 'Child 2' : 'Child 1';
    await freshStart(page);
    await setAge(page, 1, order === 'baby first' ? 4 : 28, 'months');
    await addSecondChild(page);
    await setAge(page, 2, order === 'baby first' ? 28 : 4, 'months');
    await blankPlan(page, '13:00');

    await addRoutine(page, { routine: 'Nap', who: babyIs, at: '13:00', length: '1 hr 30 min', adult: 'Free after settling about 10 min' });
    // Meal and snack are only offered for children eating solids: just the toddler here.
    await addBlock(page, 'Meal');
    const mealForm = page.getByRole('form', { name: 'Add a meal' });
    await expect(mealForm).toContainText(`For ${toddlerIs}.`);
    await mealForm.getByLabel('Starts').fill('15:00');
    await mealForm.getByRole('radio', { name: '20 min', exact: true }).check();
    await mealForm.getByRole('button', { name: 'Add meal' }).click();

    await page.getByRole('button', { name: 'Fill around these blocks' }).click();
    const tracks = page.locator('.along-track');
    const napTrack = tracks.filter({ hasText: `While ${babyIs} naps · ${toddlerIs}:` });
    await expect(napTrack).toHaveCount(1);
    // The sleeping child gets no play: everything during the nap is the toddler's.
    const along = napTrack.locator('li.seg-activity');
    await expect(along.first()).toBeVisible();
    for (const text of await along.locator('.tracks').allInnerTexts()) {
      expect(text).toContain(`${toddlerIs} (2 yr 4 mo):`);
      expect(text).not.toContain(`${babyIs} (`);
    }
    await expect(napTrack).toContainText(`${toddlerIs} stays near you while you settle ${babyIs}`);
    // Nothing else is scheduled for anyone until the nap ends.
    const mainRows = timeline(page).locator(':scope > li.seg:not(.open)');
    await expect(mainRows.first()).toContainText('Nap');
    await expect(mainRows.nth(1).locator('.seg-time')).toContainText(/^(2:30|2:3\d|2:[4-5]\d|3:\d\d) PM/);
    // The meal for one child with one adult leaves the other child's time open, said plainly.
    const mealTrack = tracks.filter({ hasText: `While ${toddlerIs} eats · ${babyIs}:` });
    await expect(mealTrack).toContainText(`${babyIs} has nothing planned while you help with the meal for ${toddlerIs}`);
    await expect(row(page, 'Meal').locator('.who-chip')).toHaveText(toddlerIs);
    await expect(row(page, 'Nap').locator('.who-chip')).toHaveText(babyIs);

    // Share preview and shared view keep the same labels.
    await page.getByRole('button', { name: 'Share link' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this plan' });
    await expect(dialog.locator('.preview-box')).toContainText(`Nap · ${babyIs}`);
    await expect(dialog.locator('.preview-box')).toContainText(`Meal · ${toddlerIs}`);
    await expect(dialog.locator('.preview-track').first()).toContainText(`While ${babyIs} naps · ${toddlerIs}:`);
    const url = await dialog.getByLabel(/Link \(/).inputValue();
    await dialog.getByRole('button', { name: 'Close' }).click();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const other = await ctx.newPage();
    await other.goto(url);
    await expect(other.locator('.along-track').first()).toContainText(`While ${babyIs} naps · ${toddlerIs}:`);
    for (const text of await other.locator('.along-track').first().locator('li.seg-activity .tracks').allInnerTexts()) expect(text).toContain(`${toddlerIs} (2 yr 4 mo):`);
    await other.screenshot({ path: join(ARTIFACTS, `two-kids-${order.replace(' ', '-')}-shared.png`), fullPage: true });
    await ctx.close();

    // Image export: saved for visual review (labels are drawn from the same rows).
    await page.getByRole('button', { name: 'Save as image' }).click();
    const exp = page.getByRole('dialog', { name: 'Save as image' });
    await expect(exp.getByRole('link', { name: /^Download/ }).first()).toBeVisible({ timeout: 20_000 });
    const pages = await exp.getByRole('link', { name: /^Download/ }).count();
    for (let i = 0; i < pages; i++) {
      const d = page.waitForEvent('download');
      await exp.getByRole('link', { name: /^Download/ }).nth(i).click();
      const p = join(ARTIFACTS, `two-kids-${order.replace(' ', '-')}-feed-${i + 1}.png`);
      await (await d).saveAs(p);
      expect(await readPngSize(p)).toEqual({ width: 1080, height: 1350 });
    }
    await exp.getByRole('button', { name: 'Close' }).click();
    await page.screenshot({ path: join(ARTIFACTS, `two-kids-${order.replace(' ', '-')}-plan.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

// ---------- v1 compatibility ----------

const STAMP = '2026-10-20T09:00:00.000Z';
const v1Plan = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  v: 1,
  id,
  title,
  kids: [{ age: { value: 18, unit: 'm' }, notYet: [] }],
  start: '09:00',
  window: 60,
  settings: { energy: 'some', place: 'any', mode: 'either', adults: 1 },
  segments: [
    { id: 'a1', kind: 'activity', ref: 'act.stack-and-topple', minutes: 8 },
    { id: 'b1', kind: 'break', minutes: 10, label: 'Flexible break' },
    { id: 'c1', kind: 'custom', minutes: 20, label: 'Nap', who: 'c1' },
  ],
  notes: '',
  createdAt: STAMP,
  updatedAt: STAMP,
  ...extra,
});

const v1Compact = {
  s: '16:30',
  w: 90,
  k: [
    [4, 'm'],
    [28, 'm'],
  ],
  o: [1, 1, 0, 1],
  g: [
    ['r', 'tummy-time-book-helper', 8, '1'],
    ['b', 10],
    ['c', 45, '1', 'Nap'],
    ['c', 20, '2'],
  ],
};

async function v1Link(page: Page, compact: unknown): Promise<string> {
  return page.evaluate(async (data) => {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const z = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    for (const b of z) bin += String.fromCharCode(b);
    return `1z.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  }, compact);
}

test('compatibility: v1 saved plans, v1 draft, v1 share link, and v1 plan file open without data loss or a false "unsaved"', async ({ page, browser }) => {
  const errors = trackErrors(page);
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.goto('');
  await page.evaluate(
    ({ plans }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('trunk.plans', JSON.stringify({ version: 1, plans }));
    },
    { plans: [v1Plan('p-v1-legacy-1', 'Old Tuesday plan'), v1Plan('p-v1-legacy-2', '')] },
  );
  await page.goto('#/saved');
  await page.reload();
  await expect(page.getByText('Saved on this device · 2/10')).toBeVisible();
  await expect(page.locator('.saved-title', { hasText: 'Old Tuesday plan' })).toBeVisible();
  // An old plan with no title shows the generated default, never "Untitled plan".
  await expect(page.locator('.saved-title', { hasText: 'Morning · 60 min · 18 mo' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Untitled');
  await page.locator('.saved-title a', { hasText: 'Old Tuesday plan' }).click();
  await expect(timeline(page)).toBeVisible();
  // The v1 custom "Nap" stays the parent's own entry (never reinterpreted as a routine block).
  await expect(row(page, 'Nap')).toHaveClass(/seg-custom/);
  await expect(timeline(page).locator('li.seg-routine')).toHaveCount(0);
  await expect(row(page, 'Stack it and knock it down')).toHaveCount(1);
  await expect(timeline(page).locator('li.seg:not(.open)')).toHaveCount(3);
  await page.getByRole('button', { name: 'Close plan' }).click();
  expect(dialogs, 'opening a saved v1 plan must not look unsaved').toEqual([]);
  await expect(timeline(page)).toHaveCount(0);

  // A v1 draft in sessionStorage, saved and unchanged: restored, and still clean.
  const draftPlan = v1Plan('p-v1-draft-1', 'Draft from before');
  await page.evaluate((plan) => sessionStorage.setItem('trunk.draft', JSON.stringify({ plan, snapshot: JSON.stringify(plan) })), draftPlan);
  await page.goto('#/plan');
  await page.reload();
  await expect(page.getByLabel('Plan name')).toHaveValue('Draft from before');
  await expect(timeline(page).locator('li.seg:not(.open)')).toHaveCount(3);
  await page.getByRole('button', { name: 'Close plan' }).click();
  expect(dialogs, 'a clean v1 draft must stay clean').toEqual([]);

  // A v1 share link (#/s/1z.…) in a fresh browser.
  const link = await v1Link(page, v1Compact);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  const otherErrors = trackErrors(other);
  await other.goto(`${page.url().split('#')[0]}#/s/${link}`);
  await expect(other.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
  const shared = other.getByRole('list', { name: 'Plan timeline' });
  await expect(shared.locator('li.seg-recipe')).toHaveCount(1);
  await expect(shared.locator('li.seg-break')).toHaveCount(1);
  await expect(shared.locator('li.seg-custom')).toHaveCount(2);
  await expect(shared.locator('li.seg-routine')).toHaveCount(0);
  await expect(shared).toContainText('Nap');
  await expect(other.locator('main')).toContainText('Child 1, about 4 months and Child 2, about 2 years, 4 months');
  expect(otherErrors).toEqual([]);
  await ctx.close();

  // A v1 plan file.
  await page.goto('#/saved');
  await page.locator('input[type="file"]').setInputFiles({ name: 'old-plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ trunkPlan: 1, plan: { ...v1Compact, k: [[18, 'm']], g: [['a', 'stack-and-topple', 8], ['b', 10], ['c', 20, '1', 'Nap']] } })) });
  await expect(timeline(page)).toBeVisible();
  await expect(timeline(page).locator('li.seg:not(.open)')).toHaveCount(3);
  await expect(row(page, 'Nap')).toHaveClass(/seg-custom/);
  expect(errors).toEqual([]);
});

// ---------- Where caveats live ----------

const GENERAL_CAVEATS = /individually reviewed by a clinician|not medical advice|corrected age|age is (only )?a starting point|follow your child’s cues|not a (feeding|sleep|wake)|isn’t a feeding|one family reports|neonatal/i;

/** Trunk's own words on screen: quoted source claims (which carry their own scope notes) and closed disclosures are left out. */
async function ownText(page: Page, selector = 'main'): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.claim, details:not([open]) > :not(summary)').forEach((n) => n.remove());
    return copy.textContent ?? '';
  });
}

test('copy: general clinical caveats live on About; specific instructions, timing reasons, and sources still work', async ({ page, browser }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 2, 'months');
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await page.locator('details.more summary', { hasText: 'More filters' }).click();
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Type an age' }).click();
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await setAge(page, 1, 8, 'months');
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: /Readiness/ }).click();
  await expect(page.getByText('Mark anything your child isn’t doing yet')).toBeVisible();
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await setAge(page, 1, 2, 'months');

  // Activity detail: specific supervision and safety stay; the timing reason and sources expand.
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
  await page.goto('#/a/act.tummy-time-floor-face-to-face');
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await expect(page.locator('.your-part')).toContainText('Your part');
  await expect(page.getByRole('heading', { name: 'Safety' })).toBeVisible();
  await expect(page.locator('.safety-box')).toContainText(/awake/);
  const cue = page.locator('details.cue', { hasText: 'Not right after a feed' });
  await expect(cue.locator('summary')).toContainText('Applies now');
  await cue.locator('summary').click();
  await expect(cue).toContainText(/HSE/);
  await expect(cue).toContainText(/Trunk’s convention|Trunk’s planning/);
  await expect(page.locator('#tummy-guide')).toHaveText('Tummy time position');
  expect(await ownText(page)).not.toMatch(/hospital|neonatal/i);
  await page.locator('details.sources summary').click();
  await expect(page.locator('details.sources .claim').first()).toBeVisible();
  await page.locator('.disclosures summary', { hasText: 'Who it’s for' }).click();
  expect(await ownText(page)).not.toMatch(/age is a starting point/i);

  // Planner, saved, shared.
  await page.goto('#/');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(timeline(page)).toBeVisible();
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const url = await page.getByRole('dialog').getByLabel(/Link \(/).inputValue();
  expect(await ownText(page, 'dialog')).not.toMatch(GENERAL_CAVEATS);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.goto('#/saved');
  expect(await ownText(page)).not.toMatch(GENERAL_CAVEATS);
  await expect(page.locator('main')).not.toContainText(/Clearing site data|private browsing/);
  await expect(page.getByText(/^Saved on this device · 1\/10$/)).toBeVisible();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
  expect(await ownText(other)).not.toMatch(GENERAL_CAVEATS);
  await ctx.close();

  // About holds them, reachable from the header.
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About Trunk' })).toBeVisible();
  const about = page.locator('main');
  await expect(about).toContainText(/not been individually reviewed by a clinician/);
  await expect(about).toContainText(/corrected age/);
  await expect(about).toContainText(/Age is a starting point/);
  await expect(about).toContainText(/How timing cues work/);
  await expect(about).toContainText(/Trunk’s own planning convention/);
  await expect(about).toContainText(/Clearing site data or using private browsing/);
  await expect(about).toContainText(/individual target/);
  await expect(about).not.toContainText(/one family reports/i);
  expect(errors).toEqual([]);
});

test('review follow-ups: unknown nap availability, before-start times, set-time order, track overlaps, extend window', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await blankPlan(page, '13:00');

  // A time before the plan starts is refused inline; the form stays open.
  await addBlock(page, 'Nap');
  const form = page.getByRole('form', { name: 'Add a nap' });
  await form.getByRole('radio', { name: 'Child 1', exact: true }).check();
  await form.getByLabel('Starts').fill('12:00');
  await form.getByRole('radio', { name: '1 hr', exact: true }).check();
  // "Not sure yet" is the default, with one line on what it means.
  await expect(form.getByLabel(/naps, you’re/)).toHaveValue('unknown');
  await expect(form).toContainText('Trunk won’t plan Child 2’s time during the nap until you set a settling time.');
  await form.getByRole('button', { name: 'Add nap' }).click();
  await expect(form.getByRole('alert')).toHaveText(/before this plan starts/);
  await expect(form).toBeVisible();
  await expect(timeline(page).locator('li.seg-routine')).toHaveCount(0);
  await form.getByLabel('Starts').fill('13:00');
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByRole('button', { name: 'Add nap' }).click();
  await expect(form).toHaveCount(0);

  // Two entries with set times keep their order; the arrow explains instead of swapping.
  await addRoutine(page, { routine: 'Meal', at: '14:30', length: '20 min' });
  const before = await timeline(page).locator(':scope > li.seg .seg-title-text').allInnerTexts();
  await row(page, 'Nap').getByRole('button', { name: 'Move later: Nap' }).click();
  await expect(row(page, 'Nap').locator('.row-note')).toHaveText('Both have set times. Change a time to reorder them.');
  expect(await timeline(page).locator(':scope > li.seg .seg-title-text').allInnerTexts()).toEqual(before);

  // Unknown availability: Trunk leaves the other child's time unplanned and says how to plan it.
  await page.getByRole('button', { name: 'Fill around these blocks' }).click();
  const track = page.locator('.along-track').filter({ hasText: 'While Child 1 naps · Child 2:' });
  await expect(track.locator('li.seg-activity')).toHaveCount(0);
  await expect(track).toContainText('Child 2: nothing planned yet. Add your settling time to Child 1’s nap to plan this.');
  await track.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(ARTIFACTS, 'review-unknown-nap-390.png') });
  // Overlap inside the track: two of Child 2's own entries at once, with a working repair.
  await row(page, 'Nap').getByLabel(/naps, you’re/).selectOption({ label: 'Free after settling about 10 min' });
  for (const [what, minutes] of [
    ['Sticker book', '10'],
    ['Bubbles', '10'],
  ]) {
    await track.getByRole('button', { name: /^\+ Add for Child 2/ }).click();
    await page.getByRole('menuitem', { name: 'Your own entry' }).click();
    await page.getByLabel('What').fill(what);
    await page.getByRole('spinbutton', { name: 'Minutes' }).fill(minutes);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await expect(row(page, 'Sticker book').locator('.seg-time')).toContainText('1:10 PM–1:20 PM');
  await row(page, 'Bubbles').getByRole('button', { name: 'More: Bubbles' }).click();
  await page.getByRole('menuitem', { name: 'Set a time' }).click();
  await row(page, 'Bubbles').getByLabel('Bubbles starts at').fill('13:15');
  await row(page, 'Bubbles').getByRole('button', { name: 'Set' }).click();
  const overlap = track.locator('.conflict', { hasText: 'Child 2 would be doing Sticker book and Bubbles at once for 5 min.' });
  await expect(overlap).toBeVisible();
  await expect(overlap.getByRole('button', { name: 'Shorten Sticker book by 5 min' })).toBeVisible();
  await overlap.getByRole('button', { name: 'Move Bubbles 5 min later' }).click();
  await expect(track.locator('.conflict', { hasText: /at once/ })).toHaveCount(0);
  await expect(row(page, 'Bubbles').locator('.seg-time')).toContainText('1:20 PM–1:30 PM');

  // With a settling time set, Fill around plans Child 2's time and keeps their own entries.
  await page.getByRole('button', { name: 'Fill around these blocks' }).click();
  await expect(track.locator('li.seg-activity').first()).toBeVisible();
  await expect(row(page, 'Bubbles')).toBeVisible();
  await expect(track).toContainText('Child 2 stays near you while you settle Child 1');

  // Past the window: one tap extends it to cover the plan.
  await addRoutine(page, { routine: 'Snack', at: '14:50', length: '15 min' });
  await expect(timeline(page).locator('li.overrun')).toContainText('Runs 35 min past your window');
  await timeline(page).getByRole('button', { name: 'Extend to 125 min' }).click();
  await expect(timeline(page).locator('li.overrun')).toHaveCount(0);
  await expect(page.locator('.plan-summary')).toContainText('of 2 hr 5 min');
  await expect(page.getByRole('radiogroup', { name: 'Minutes' }).getByLabel('125', { exact: true })).toBeChecked();
  await page.screenshot({ path: join(ARTIFACTS, 'review-followups-plan-390.png'), fullPage: true });
  expect(errors).toEqual([]);
});
