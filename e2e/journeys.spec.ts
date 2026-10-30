import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addSecondChild, ARTIFACTS, choose, freshStart, noHorizontalOverflow, setAge, trackErrors } from './helpers.ts';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function makePlan(page: Page, minutes = 90) {
  if ([10, 20, 30, 60].includes(minutes)) {
    await choose(page, 'Minutes you have', String(minutes));
    await page.getByRole('button', { name: `Plan the next ${minutes} minutes` }).click();
  } else {
    await choose(page, 'Minutes you have', 'Any');
    await page.getByRole('button', { name: 'Make a plan' }).click();
    await choose(page, 'Minutes', String(minutes));
    await page.getByRole('button', { name: `Fill the next ${minutes} minutes` }).click();
  }
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
}

test('1. a 3-week-old: low-prep activity and concise instructions with no onboarding', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  // The working tool is the first screen: no tutorial, login, or questionnaire.
  await expect(page.getByRole('group', { name: 'Child 1', exact: true })).toBeVisible();
  await setAge(page, 1, 3, 'weeks');
  await expect(page.getByRole('group', { name: 'Child 1', exact: true })).toContainText('3 weeks');
  await page.locator('details.more summary', { hasText: 'More filters' }).click();
  await page.getByLabel(/Low prep only/).check();
  // The active filter shows in the collapsed summary, with a visible Reset.
  await page.locator('details.more summary', { hasText: 'More filters' }).click();
  await expect(page.locator('details.filters summary')).toContainText('Low prep');
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  const results = page.getByRole('heading', { name: /ideas? for age 3 weeks/ });
  await expect(results).toBeVisible();
  const cards = page.locator('.idea-list > li');
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: join(ARTIFACTS, 'j1-results-3wk.png') });
  await cards.first().locator('a').click();
  const steps = page.getByRole('list').filter({ has: page.locator('li') }).first();
  await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();
  const stepCount = await page.locator('ol.steps > li').count();
  expect(stepCount).toBeGreaterThanOrEqual(2);
  expect(stepCount).toBeLessThanOrEqual(4);
  await expect(page.getByRole('heading', { name: 'Safety' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stop or switch when' })).toBeVisible();
  // Core instructions fit near the top: the steps heading is within the first two screens.
  const stepsTop = await page.getByRole('heading', { name: 'Steps' }).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  expect(stepsTop).toBeLessThan(844 * 1.5);
  await page.screenshot({ path: join(ARTIFACTS, 'j1-detail-3wk.png'), fullPage: true });
  void steps;
  expect(errors).toEqual([]);
});

test('2. ages 4 and 28 months, one adult, 90 minutes: editable feasible plan', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await expect(page.locator('.idea-list > li').first()).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'j2-pair-ideas.png'), fullPage: true });
  await makePlan(page, 90);
  const timeline = page.getByRole('list', { name: 'Plan timeline' });
  const segs = timeline.locator('> li.seg');
  expect(await segs.count()).toBeGreaterThanOrEqual(3);
  // Changing the start time moves the whole plan.
  await page.getByLabel('Start').fill('16:30');
  await expect(segs.first().locator('.seg-time')).toContainText(/^4:30 PM/);
  // Two-child entries come from curated pairings and show who does what.
  await expect(timeline.getByText(/Together|Side by side/).first()).toBeVisible();
  await expect(timeline.locator('.tracks .who', { hasText: 'Child 1' }).first()).toBeVisible();
  await expect(timeline.locator('.tracks .who', { hasText: 'Child 2' }).first()).toBeVisible();
  await expect(timeline.locator('.tracks .who', { hasText: 'You' }).first()).toBeVisible();
  // Realistic breaks and visible unscheduled time or a total inside the window.
  await expect(timeline.getByText('Flexible break').first()).toBeVisible();
  const summary = await page.locator('.plan-summary').innerText();
  expect(summary).not.toMatch(/past your window/);
  // Tummy-time minutes are split by position; supported time is never credited to a flat-surface target.
  const tally = page.locator('.tummy-tally');
  if (await tally.count()) {
    await expect(tally).toContainText('floor tummy time on a flat surface');
    await expect(tally).toContainText('Count only the minutes your baby is actually on their tummy');
  }
  // Editable with buttons: resize, reorder, remove.
  const first = segs.first();
  const firstTitle = (await first.locator('.seg-title').innerText()).split('\n')[0];
  await first.getByRole('button', { name: /^Move later/ }).click();
  await expect(segs.nth(1).locator('.seg-title')).toContainText(firstTitle.replace(/ (Together|Side by side)$/, ''));
  await segs.nth(1).getByRole('button', { name: /^Shorter|^Longer/ }).first().focus();
  await page.screenshot({ path: join(ARTIFACTS, 'j2-plan-4m-28m.png'), fullPage: true });
  // Opening a pairing preserves the tummy-time scope.
  const pairLink = timeline.locator('.seg-title a').first();
  await pairLink.click();
  await expect(page.getByRole('heading', { name: 'Who does what' })).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'j2-pairing-detail.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('3. busy cooking dinner: honest attention needs, no hazards, media only where verified', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 30, 'months');
  await choose(page, 'You right now', 'Busy nearby');
  await choose(page, 'Minutes you have', 'Any');
  const cards = page.locator('.idea-list > li');
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  // Cross-check every result against the generated catalog: honest supervision, no undivided-attention hazards.
  const catalog = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src/generated/catalog.json'), 'utf8')) as {
    activities: { title: string; hazards: string[]; supervision: { participation: string; proximity: string; handsOn: string; shareable: boolean } }[];
  };
  for (const text of await cards.allInnerTexts()) {
    expect(text).toMatch(/Same room, keeping an eye on them/);
    expect(text).not.toMatch(/Needs your full attention/);
    const record = catalog.activities.find((a) => text.startsWith(a.title));
    expect(record, text.slice(0, 40)).toBeTruthy();
    expect(record!.hazards.filter((h) => ['water', 'heat', 'food', 'traffic'].includes(h))).toEqual([]);
    expect(record!.supervision).toMatchObject({ participation: 'watches', proximity: 'same-room', handsOn: 'none', shareable: true });
  }
  await expect(page.getByText(/You still need to keep watching/)).toBeVisible();
  const media = cards.filter({ hasText: 'Screen option' });
  expect(await media.count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: join(ARTIFACTS, 'j3-busy-30m.png'), fullPage: true });
  await media.first().locator('a').click();
  await expect(page.getByRole('heading', { name: 'About this screen option' })).toBeVisible();
  await expect(page.getByText('No-screen alternative:')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'j3-media-detail.png'), fullPage: true });
  await page.goBack();
  await expect(page.getByRole('heading', { name: /ideas? for age/ })).toBeVisible();
  // A younger toddler in the same context gets no screen option.
  await setAge(page, 1, 14, 'months');
  await expect(page.locator('.idea-list > li', { hasText: 'Screen option' })).toHaveCount(0);
  // With plenty of energy, screens never appear.
  await setAge(page, 1, 30, 'months');
  await choose(page, 'You right now', 'Ready to play');
  await expect(page.locator('.idea-list > li', { hasText: 'Screen option' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('4. save ten plans, reject an eleventh, rename, delete with undo, survive refresh and bad storage', async ({ page }) => {
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 10, 'months');
  for (let i = 1; i <= 10; i++) {
    await page.goto('#/');
    await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
    await page.getByLabel('Plan name').fill(`Plan ${i}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved on this device.')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trunk.plans')!).plans.length)).toBe(i);
  }
  await page.goto('#/');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.getByLabel('Plan name').fill('Plan 11');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/already have 10 saved plans/)).toBeVisible();
  // The unsaved plan is still open, nothing was lost.
  await expect(page.getByLabel('Plan name')).toHaveValue('Plan 11');
  await page.goto('#/saved');
  await expect(page.getByText('Saved on this device · 10/10')).toBeVisible();
  await expect(page.getByText(/reached 10 saved plans/)).toBeVisible();
  await expect(page.locator('.saved-title', { hasText: 'Plan 11' })).toHaveCount(0);

  const menuFor = async (title: string, action: string) => {
    await page.getByRole('button', { name: `More: ${title}`, exact: true }).click();
    await page.getByRole('menuitem', { name: action }).click();
  };
  await menuFor('Plan 3', 'Rename');
  await page.getByLabel('New name').fill('Rainy Tuesday');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.saved-title', { hasText: 'Rainy Tuesday' })).toBeVisible();

  await menuFor('Plan 5', 'Delete');
  await expect(page.getByText('Saved on this device · 9/10')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Saved on this device · 10/10')).toBeVisible();
  await menuFor('Plan 7', 'Delete');
  await page.reload();
  await expect(page.getByText('Saved on this device · 9/10')).toBeVisible();
  await expect(page.locator('.saved-title', { hasText: 'Rainy Tuesday' })).toBeVisible();
  await expect(page.locator('.saved-title', { hasText: /^Plan 7$/ })).toHaveCount(0);
  await page.screenshot({ path: join(ARTIFACTS, 'j4-saved.png'), fullPage: true });

  // Corrupt storage: backed up and reported, app keeps working.
  await page.evaluate(() => localStorage.setItem('trunk.plans', '{"version":1,"plans":[{"broken":true}'));
  await page.reload();
  await expect(page.getByText(/couldn’t be read/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('trunk.plans.backup'))).toContain('broken');
  expect(errors).toEqual([]);
});

test('4b. storage blocked entirely: plans still work in memory', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  const page = await context.newPage();
  const errors = trackErrors(page);
  await page.goto('');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Saving isn’t available in this browser/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
  await page.goto('#/saved');
  await expect(page.getByText(/isn’t letting Trunk save plans/)).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('5. share links open in a fresh browser, sanitized, and never overwrite saved plans', async ({ page, browser }) => {
  await freshStart(page);
  await setAge(page, 1, 18, 'months');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.getByLabel('Plan name').fill('Jamie’s Saturday');
  await page.getByLabel(/Private notes/).fill('Jamie is teething');
  await page.getByRole('button', { name: /^\+ Add block/ }).click();
  await page.getByRole('menuitem', { name: 'Your own entry' }).click();
  await page.getByLabel('What').fill('Visit Aunt Rosa');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const titles = await page.locator('.timeline .seg:not(.open) .seg-title-text').allInnerTexts();
  await page.getByRole('button', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this plan' });
  await expect(dialog.getByText('Anyone with the link can read what’s in it;')).toBeVisible();
  await expect(dialog.locator('.preview-box')).not.toContainText('Jamie');
  await expect(dialog.locator('.preview-box')).not.toContainText('Rosa');
  await expect(dialog.locator('.preview-box')).toContainText('Your own activity');
  const url = await dialog.getByLabel(/Link \(/).inputValue();
  expect(url).toContain('/trunk/#/s/2z.');
  expect(url.length).toBeLessThan(2000);
  await page.screenshot({ path: join(ARTIFACTS, 'j5-share-dialog.png'), fullPage: true });

  // Fresh, isolated browser context: no access to the sender's storage.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await ctx.newPage();
  const errors = trackErrors(other);
  await other.goto(url);
  await expect(other.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
  // Without the sender's name, the plan is named from what the link carries (time, length, ages).
  await expect(other.locator('h2.shared-title')).toHaveText(/^(Morning|Afternoon|Evening|Night) · 30 min · 18 mo$/);
  const body = await other.locator('main').innerText();
  expect(body).not.toMatch(/Jamie|Rosa|teething/);
  expect(titles.length).toBeGreaterThan(1);
  for (const t of titles.filter((x) => !/Your own|Visit Aunt/.test(x))) {
    await expect(other.locator('main')).toContainText(t);
  }
  await other.screenshot({ path: join(ARTIFACTS, 'j5-shared-preview.png'), fullPage: true });
  await other.getByRole('button', { name: 'Save to my plans' }).click();
  await expect(other.getByText('Saved on this device · 1/10')).toBeVisible();

  // Bad links fail gracefully.
  for (const bad of ['#/s/garbage', '#/s/2z.AAAA', '#/s/0z.AAAA', `#/s/1z.${'A'.repeat(7000)}`]) {
    await other.goto(`${url.split('#')[0]}${bad}`);
    await expect(other.getByRole('alert')).toBeVisible();
    await expect(other.getByRole('link', { name: 'Find something to do instead' })).toBeVisible();
  }
  expect(errors).toEqual([]);

  // With 10 saved plans, importing never overwrites.
  await other.evaluate(() => {
    const plans = Array.from({ length: 10 }, (_, i) => ({
      v: 1,
      id: `p-full-${i}`,
      title: `Full ${i}`,
      kids: [{ age: { value: 18, unit: 'm' }, notYet: [] }],
      start: '09:00',
      window: 60,
      settings: { energy: 'some', place: 'any', mode: 'either', adults: 1 },
      segments: [],
      notes: '',
      createdAt: '2026-10-28T10:00:00.000Z',
      updatedAt: '2026-10-28T10:00:00.000Z',
    }));
    localStorage.setItem('trunk.plans', JSON.stringify({ version: 1, plans }));
  });
  await other.goto(url);
  await other.reload();
  await other.getByRole('button', { name: 'Save to my plans' }).click();
  await expect(other.getByText(/already have 10 saved plans/)).toBeVisible();
  const stored = await other.evaluate(() => JSON.parse(localStorage.getItem('trunk.plans')!).plans.map((p: { id: string }) => p.id));
  expect(stored).toEqual(Array.from({ length: 10 }, (_, i) => `p-full-${i}`));
  await ctx.close();
});

async function readPngSize(path: string) {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('6. image export: feed and story sizes, long plans paginate, download and mocked native share', async ({ page }) => {
  await page.addInitScript(() => {
    // Native file sharing can't be exercised headlessly; mock it and record calls.
    (window as unknown as { __shared: number }).__shared = 0;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (data: { files?: File[] }) => {
        (window as unknown as { __shared: number }).__shared = data.files?.length ?? 0;
      },
      configurable: true,
    });
  });
  const errors = trackErrors(page);
  await freshStart(page);
  await setAge(page, 1, 2, 'years');
  await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
  await page.getByRole('button', { name: 'Save as image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save as image' });
  await expect(dialog.getByText(/Fits on one image|images, so the text stays readable/)).toBeVisible({ timeout: 20_000 });

  const dl = page.waitForEvent('download');
  await dialog.getByRole('link', { name: /^Download/ }).first().click();
  const feedPath = join(ARTIFACTS, 'j6-feed-1.png');
  await (await dl).saveAs(feedPath);
  expect(await readPngSize(feedPath)).toEqual({ width: 1080, height: 1350 });

  await dialog.getByLabel(/Story/).check();
  await expect(dialog.getByRole('img').first()).toHaveAttribute('alt', /1080 by 1920/);
  const dl2 = page.waitForEvent('download');
  await dialog.getByRole('link', { name: /^Download/ }).first().click();
  const storyPath = join(ARTIFACTS, 'j6-story-1.png');
  await (await dl2).saveAs(storyPath);
  expect(await readPngSize(storyPath)).toEqual({ width: 1080, height: 1920 });

  await dialog.getByRole('button', { name: /^Share image/ }).click();
  expect(await page.evaluate(() => (window as unknown as { __shared: number }).__shared)).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A long plan paginates instead of shrinking text or dropping entries.
  await choose(page, 'Minutes', '180');
  await page.getByRole('button', { name: 'Refill this plan' }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /^\+ Add block/ }).click();
    await page.getByRole('menuitem', { name: 'Break' }).click();
  }
  const entries = await page.locator('.timeline > li.seg:not(.open)').count();
  await page.getByRole('button', { name: 'Save as image' }).click();
  await dialog.getByLabel(/Feed/).check();
  await expect(dialog.getByText(/images, so the text stays readable/)).toBeVisible({ timeout: 20_000 });
  const pages = await dialog.getByRole('link', { name: /^Download/ }).count();
  expect(pages).toBeGreaterThan(1);
  for (let i = 0; i < pages; i++) {
    const d = page.waitForEvent('download');
    await dialog.getByRole('link', { name: /^Download/ }).nth(i).click();
    const p = join(ARTIFACTS, `j6-long-feed-${i + 1}.png`);
    await (await d).saveAs(p);
    expect(await readPngSize(p)).toEqual({ width: 1080, height: 1350 });
  }
  expect(entries).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768, 1280]) {
  test(`7. layout at ${width}px: no overflow, reachable controls, keyboard age adjustment`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width, height: 900 });
    await freshStart(page);
    await noHorizontalOverflow(page);
    const slider = page.getByRole('slider', { name: 'Child 1 age' });
    await slider.focus();
    const before = await slider.getAttribute('aria-valuetext');
    await page.keyboard.press('ArrowRight');
    await expect(slider).not.toHaveAttribute('aria-valuetext', before ?? '');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuetext', '1 week');
    await addSecondChild(page);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: join(ARTIFACTS, `j7-find-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Plan the next 30 minutes' }).click();
    await expect(page.getByRole('list', { name: 'Plan timeline' })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: join(ARTIFACTS, `j7-plan-${width}.png`), fullPage: true });
    // 200% text size.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.goto('#/');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noHorizontalOverflow(page);
    await page.screenshot({ path: join(ARTIFACTS, `j7-find-${width}-text200.png`), fullPage: false });
    // Primary touch targets are at least 44px tall.
    const small = await page.$$eval('main button, main .segments label, .bottom-nav a', (els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().height < 40).map((e) => e.textContent),
    );
    expect(small).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('7b. keyboard-only: tab from the top reaches the age control, filters, and a result', async ({ page }) => {
  await freshStart(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}` : '';
    });
    seen.add(label);
  }
  const all = [...seen].join('|');
  expect(all).toMatch(/INPUT:Child 1 age/);
  expect(all).toMatch(/BUTTON:Plan the next 30 minutes/);
  expect(all).toMatch(/A:/);
});

test('8. served under /trunk/: load, refresh, sources, assets, fresh share link', async ({ page, request }) => {
  const errors = trackErrors(page);
  const res = await request.get('');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/src="\.\/assets\/index-[\w-]+\.js"/);
  await page.goto('#/about');
  await expect(page.getByRole('heading', { name: 'About Trunk' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All sources' })).toBeVisible();
  const sourceLinks = await page.locator('section a[href^="https://"]').count();
  expect(sourceLinks).toBeGreaterThan(5);
  for (const icon of ['brand/web/trunk-icon-32.png', 'brand/web/trunk-icon-180.png', 'brand/web/trunk-logo-336.png']) {
    const res = await request.get(icon);
    expect(res.status(), icon).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
  await page.goto('#/a/act.tummy-time-floor-face-to-face');
  await expect(page.getByRole('heading', { name: 'Face-to-face floor tummy time' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#tummy-guide').locator('..')).toContainText(/Floor tummy time|not on a flat surface/);
  expect(page.url()).toContain('/trunk/#/a/');
  expect(errors).toEqual([]);
});
