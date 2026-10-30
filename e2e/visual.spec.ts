import { expect, test, type Browser, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addRoutine, ARTIFACTS, blankPlan, addSecondChild, noHorizontalOverflow, readPngSize, setAge, trackErrors } from './helpers.ts';

// Brand and visual QA: logo and icons, screenshots at real phone/tablet/desktop
// widths (saved to review-artifacts/, which is gitignored), 200% text, touch
// targets, menu keyboard handling, sticky controls, and input font sizes.
// Chromium only here; the WebKit project runs where it's installed (PW_WEBKIT=1).

const WIDTHS = [320, 390, 768, 1280] as const;
const heightFor = (w: number) => (w === 320 ? 640 : w === 390 ? 844 : w === 768 ? 1024 : 800);
const PREFS = { v: 1, kids: [{ age: { value: 4, unit: 'm' }, notYet: [] }, { age: { value: 28, unit: 'm' }, notYet: [] }], filters: { minutes: 30, energy: 'some', place: 'any', mode: 'either', focus: 'both', adults: 1, lowPrep: false, goals: [], materials: 'any', mess: 'any', quiet: false } };

let draftJson = '';
let planJson = '';
let shareUrl = '';

/** A two-child plan with a nap (toddler play alongside) and a meal, made through the UI once. */
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('');
  await setAge(page, 1, 4, 'months');
  await addSecondChild(page);
  await setAge(page, 2, 28, 'months');
  await blankPlan(page, '12:30');
  await addRoutine(page, { routine: 'Milk feed', who: 'Child 1', at: '12:30', length: '20 min' });
  await addRoutine(page, { routine: 'Nap', who: 'Child 1', at: '13:00', length: '1 hr 30 min', adult: 'Free after settling about 10 min' });
  await addRoutine(page, { routine: 'Meal', at: '15:00', length: '20 min' });
  await page.getByRole('button', { name: 'Fill around these blocks' }).click();
  await page.getByLabel('Plan name').fill('Tuesday with the baby and Sam');
  draftJson = (await page.evaluate(() => sessionStorage.getItem('trunk.draft')))!;
  planJson = JSON.stringify(JSON.parse(draftJson).plan);
  await page.getByRole('button', { name: 'Share link' }).click();
  shareUrl = await page.getByRole('dialog').getByLabel(/Link \(/).inputValue();
  await ctx.close();
});

async function seeded(browser: Browser, width: number, opts: { draft?: boolean; saved?: number } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) }, hasTouch: width < 800 });
  const plans = Array.from({ length: opts.saved ?? 0 }, (_, i) => ({ ...JSON.parse(planJson), id: `p-qa-plan-${i}`, title: i === 0 ? 'Tuesday with the baby and Sam' : i % 3 === 0 ? '' : `Plan ${i + 1}` }));
  await ctx.addInitScript(
    ({ prefs, draft, plans }) => {
      if (sessionStorage.getItem('qa-seeded')) return;
      sessionStorage.setItem('qa-seeded', '1');
      localStorage.setItem('trunk.prefs', JSON.stringify(prefs));
      if (plans.length) localStorage.setItem('trunk.plans', JSON.stringify({ version: 2, plans }));
      else localStorage.removeItem('trunk.plans');
      if (draft) sessionStorage.setItem('trunk.draft', draft);
    },
    { prefs: PREFS, draft: opts.draft ? draftJson : '', plans },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

async function shot(page: Page, name: string, width: number) {
  await page.waitForTimeout(150);
  await noHorizontalOverflow(page);
  await page.screenshot({ path: join(ARTIFACTS, `qa-${name}-${width}.png`), fullPage: true });
}

for (const width of WIDTHS) {
  test(`screenshots at ${width}px: find, detail, plan, saved (1 and 10), about, shared preview`, async ({ browser }) => {
    const { ctx, page } = await seeded(browser, width, { draft: true, saved: 1 });
    const errors = trackErrors(page);
    await page.goto('');
    await expect(page.locator('.idea-list > li').first()).toBeVisible();
    await shot(page, 'find', width);
    await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
    await page.getByRole('group', { name: 'Child 2', exact: true }).getByRole('button', { name: 'Nap soon' }).click();
    await shot(page, 'find-right-now', width);
    await page.goto('#/a/act.tummy-time-reach-and-play');
    await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();
    await shot(page, 'detail', width);
    await page.goto('#/r/mix.tummy-time-book-helper');
    await expect(page.getByRole('heading', { name: 'Who does what' })).toBeVisible();
    await shot(page, 'recipe', width);
    await page.goto('#/plan');
    await expect(page.locator('.along-track').first()).toBeVisible();
    await shot(page, 'plan-two-children', width);
    await page.goto('#/saved');
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await shot(page, 'saved-1', width);
    await page.goto('#/about');
    await expect(page.getByRole('heading', { name: 'About Trunk' })).toBeVisible();
    await shot(page, 'about', width);
    await page.goto(shareUrl.replace(/^.*#/, '#'));
    await expect(page.getByRole('heading', { name: 'A shared plan' })).toBeVisible();
    await expect(page.locator('.along-track').first()).toBeVisible();
    await shot(page, 'shared', width);
    expect(errors).toEqual([]);
    await ctx.close();

    const full = await seeded(browser, width, { saved: 10 });
    const fullErrors = trackErrors(full.page);
    await full.page.goto('#/saved');
    await expect(full.page.locator('.saved-item')).toHaveCount(10);
    await expect(full.page.getByText('Saved on this device · 10/10')).toBeVisible();
    await expect(full.page.locator('main')).not.toContainText('Untitled');
    await shot(full.page, 'saved-10', width);
    expect(fullErrors).toEqual([]);
    await full.ctx.close();
  });
}

test('brand: header logo and icons load from the base path', async ({ page, request }) => {
  const errors = trackErrors(page);
  await page.goto('');
  const logo = page.getByRole('banner').getByRole('img', { name: 'Trunk' });
  await expect(logo).toBeVisible();
  const info = await logo.evaluate((img: HTMLImageElement) => ({ natural: img.naturalWidth, src: img.currentSrc, w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, attrW: img.getAttribute('width'), attrH: img.getAttribute('height') }));
  expect(info.natural).toBeGreaterThan(0);
  expect(info.src).toMatch(/\/trunk\/brand\/web\/trunk-logo-(168|336|504)\.png$/);
  expect(info.w).toBeGreaterThanOrEqual(144);
  expect(info.w).toBeLessThanOrEqual(168);
  expect(Math.round(info.w / info.h)).toBe(3);
  expect([info.attrW, info.attrH]).toEqual(['156', '52']);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Trunk' })).toHaveAttribute('href', '#/');
  await expect(page.getByRole('banner').getByRole('link', { name: 'About' })).toBeVisible();
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href));
  expect(icons.length).toBeGreaterThanOrEqual(3);
  for (const href of icons) {
    expect(href).toMatch(/\/trunk\/brand\/web\/trunk-icon-\d+\.png$/);
    expect((await request.get(href)).status()).toBe(200);
  }
  expect((await request.get('favicon.svg')).status()).toBe(404);
  // The header stays one compact row at phone width.
  await page.setViewportSize({ width: 320, height: 640 });
  const header = await page.getByRole('banner').boundingBox();
  expect(header!.height).toBeLessThan(72);
  expect(errors).toEqual([]);
});

test('200% text: no horizontal scrolling on find, detail, plan, saved, about', async ({ browser }) => {
  // Also with a wide system font (CI runners fall back to DejaVu Sans, which is much wider than Inter).
  for (const [width, wide] of [[320, false], [390, false], [320, true], [390, true]] as const) {
    const { ctx, page } = await seeded(browser, width, { draft: true, saved: 2 });
    await page.addInitScript((wide) => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `html { font-size: 200% !important; }${wide ? ' *, *::before, *::after { font-family: "DejaVu Sans", "Liberation Sans", Verdana, sans-serif !important; }' : ''}`;
        document.head.appendChild(s);
      });
    }, wide);
    const errors = trackErrors(page);
    for (const hash of ['', '#/a/act.tummy-time-reach-and-play', '#/plan', '#/saved', '#/about']) {
      await page.goto(hash || '');
      await page.reload();
      await expect(page.locator('main h1').first()).toBeAttached();
      await noHorizontalOverflow(page);
      if (hash === '' || hash === '#/plan') await page.screenshot({ path: join(ARTIFACTS, `qa-text200-${hash ? 'plan' : 'find'}-${width}${wide ? '-wide' : ''}.png`), fullPage: false });
    }
    expect(errors).toEqual([]);
    await ctx.close();
  }
});

test('touch targets, input font sizes, menus by keyboard, sticky controls', async ({ browser }) => {
  const { ctx, page } = await seeded(browser, 390, { draft: true, saved: 3 });
  const errors = trackErrors(page);
  const small = (selector: string) =>
    page.$$eval(selector, (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ text: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 40), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
        .filter((r) => r.h < 44 || r.w < 44),
    );
  const TARGETS = 'main button, main .segments label, main .chip-toggle, main summary, .bottom-nav a, main select, main input:not([type="checkbox"]):not([type="radio"]):not([type="file"])';
  // Text-entry fields only (iOS zooms into these below 16px); radios and checkboxes are visually hidden behind their labels.
  const fonts = () =>
    page.$$eval('input:not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="file"]), select, textarea', (els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => ({ name: e.getAttribute('aria-label') ?? (e as HTMLInputElement).name ?? e.tagName, size: parseFloat(getComputedStyle(e).fontSize) })).filter((r) => r.size < 16),
    );

  // Find, with every control showing.
  await page.goto('');
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Just fed' }).click();
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Nap soon' }).click();
  await page.getByRole('group', { name: 'Child 1', exact: true }).getByRole('button', { name: 'Type an age' }).click();
  await page.locator('details.filters summary').click();
  expect(await small(TARGETS)).toEqual([]);
  expect(await fonts()).toEqual([]);

  // Plan: rows, menus, and the routine form.
  await page.goto('#/plan');
  await expect(page.locator('.along-track').first()).toBeVisible();
  await page.getByRole('button', { name: /^\+ Add block/ }).click();
  expect(await small('[role="menuitem"]')).toEqual([]);
  await page.getByRole('menuitem', { name: 'Nap', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Add a nap' })).toBeVisible();
  // Opening the form moves focus into it.
  await expect(page.locator(':focus')).toBeAttached();
  expect(await page.evaluate(() => document.activeElement?.closest('form')?.getAttribute('aria-label'))).toBe('Add a nap');
  expect(await small(TARGETS)).toEqual([]);
  expect(await fonts()).toEqual([]);
  await page.getByRole('form', { name: 'Add a nap' }).getByRole('button', { name: 'Cancel' }).click();

  // The row menu by keyboard.
  const rowMenu = page.locator('li.seg-routine').first().getByRole('button', { name: /^More:/ });
  await rowMenu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(rowMenu).toBeFocused();

  // Saved: More menu (aria-haspopup, arrows, Home/End, Escape back to the button).
  await page.goto('#/saved');
  const more = page.getByRole('button', { name: 'More: Tuesday with the baby and Sam' });
  await expect(more).toHaveAttribute('aria-haspopup', 'menu');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(more).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  // No interactive control nested in another: the title link and the menu button are siblings.
  expect(await page.$$eval('.saved-item a button, .saved-item button a, .saved-item a a', (els) => els.length)).toBe(0);
  expect(await small(TARGETS)).toEqual([]);

  // Detail: "Add to plan" stays reachable above the bottom nav, and moves down when a keyboard hides the nav.
  await page.goto('#/');
  await page.getByRole('radiogroup', { name: 'Who’s this for?' }).getByLabel('Child 1', { exact: true }).check();
  await page.goto('#/a/act.tummy-time-reach-and-play');
  const add = page.getByRole('button', { name: 'Add to plan' });
  await expect(add).toBeInViewport();
  const nav = await page.locator('.bottom-nav').boundingBox();
  let box = await add.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y - 4);
  await page.evaluate(() => document.body.classList.add('keyboard-open'));
  await expect(page.locator('.bottom-nav')).toBeHidden();
  box = await add.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(nav!.y);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.evaluate(() => document.body.classList.remove('keyboard-open'));
  // At the end of the page nothing is hidden behind the nav.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = await page.locator('details.sources summary').boundingBox();
  const navNow = await page.locator('.bottom-nav').boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(navNow!.y);
  expect(await small(TARGETS)).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('exports: multipage mixed-age plan with routines, feed and story sizes', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await seeded(browser, 390, { draft: true });
  const errors = trackErrors(page);
  await page.goto('#/plan');
  await expect(page.locator('.along-track').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save as image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save as image' });
  for (const [format, size] of [
    ['feed', { width: 1080, height: 1350 }],
    ['story', { width: 1080, height: 1920 }],
  ] as const) {
    await dialog.getByLabel(format === 'feed' ? /Feed/ : /Story/).check();
    await expect(dialog.getByRole('img').first()).toHaveAttribute('alt', new RegExp(`${size.width} by ${size.height}`), { timeout: 20_000 });
    const links = dialog.getByRole('link', { name: /^Download/ });
    const count = await links.count();
    if (format === 'feed') expect(count).toBeGreaterThan(1);
    // The first page goes through a real download; the rest are read from the previews (Chromium
    // stops starting downloads from one page after about ten, which isn't what's being tested).
    const [download] = await Promise.all([page.waitForEvent('download'), links.first().click()]);
    const first = join(ARTIFACTS, `export-${format}-1.png`);
    await download.saveAs(first);
    expect(await readPngSize(first)).toEqual(size);
    for (let i = 1; i < count; i++) {
      const data = await dialog.getByRole('img').nth(i).evaluate(async (img: HTMLImageElement) => {
        const blob = await (await fetch(img.src)).blob();
        return new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(',')[1]);
          r.readAsDataURL(blob);
        });
      });
      const path = join(ARTIFACTS, `export-${format}-${i + 1}.png`);
      writeFileSync(path, Buffer.from(data, 'base64'));
      expect(await readPngSize(path)).toEqual(size);
    }
  }
  // Opt-in title appears only when chosen.
  await dialog.getByLabel('Plan name').check();
  await dialog.getByLabel(/Feed/).check();
  await expect(dialog.getByRole('img').first()).toHaveAttribute('alt', /1080 by 1350/, { timeout: 20_000 });
  const titled = await dialog.getByRole('img').first().evaluate(async (img: HTMLImageElement) => {
    const blob = await (await fetch(img.src)).blob();
    return new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.readAsDataURL(blob);
    });
  });
  writeFileSync(join(ARTIFACTS, 'export-feed-titled-1.png'), Buffer.from(titled, 'base64'));
  expect(errors).toEqual([]);
  await ctx.close();
});
