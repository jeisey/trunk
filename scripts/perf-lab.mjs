// Lab performance check for the production build served under /trunk/.
// Profile: Chromium (Playwright), 390×844 viewport, DPR 3, touch, 4× CPU
// slowdown, and a "fast 3G"-like network (1.6 Mbps down, 750 Kbps up, 150 ms RTT).
// This is an emulated lab profile, not field data or a real-device measurement.
//
// Usage: npm run build && node e2e/serve.mjs & node scripts/perf-lab.mjs
import { chromium } from '@playwright/test';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const url = process.env.PERF_URL ?? 'http://localhost:4174/trunk/';
const runs = Number(process.env.PERF_RUNS ?? 5);
const root = join(import.meta.dirname, '..');

function bundleSizes() {
  const dir = join(root, 'dist', 'assets');
  const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const initial = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
  const rows = readdirSync(dir)
    .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
    .map((f) => {
      const buf = readFileSync(join(dir, f));
      return { file: f, raw: statSync(join(dir, f)).size, gzip: gzipSync(buf).length, initial: initial.includes(f) || f.endsWith('.css') };
    });
  return rows;
}

async function measure() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = 0;
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  // Brand images actually fetched on first view (the header logo picks its rendition by DPR).
  const brand = [];
  page.on('requestfinished', async (req) => {
    if (!/\/brand\//.test(req.url())) return;
    const sizes = await req.sizes().catch(() => null);
    brand.push({ file: req.url().replace(/^.*\/brand\//, 'brand/'), bytes: sizes ? sizes.responseBodySize : 0 });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const { lcp, cls } = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));

  // Filter interaction: input event → React update → next frame, measured in-page.
  const interactions = [];
  for (const option of ['Low energy', 'Ready to play', 'Some energy', 'Busy nearby', 'Low energy', 'Some energy']) {
    const t = await page.evaluate(
      (text) =>
        new Promise((resolve) => {
          const el = [...document.querySelectorAll('.segments label')].find((l) => l.textContent?.trim() === text);
          const start = performance.now();
          el.querySelector('input').click();
          requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - start), 0));
        }),
      option,
    );
    interactions.push(t);
  }
  await browser.close();
  return { lcp, cls, interactions, brand };
}

/** Brand renditions referenced by index.html and the header (bytes on disk in dist/). */
function brandFiles() {
  const dir = join(root, 'dist', 'brand', 'web');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => ({ file: `brand/web/${f}`, bytes: statSync(join(dir, f)).size }));
}

const results = [];
for (let i = 0; i < runs; i++) results.push(await measure());
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const lcp = median(results.map((r) => r.lcp));
const cls = Math.max(...results.map((r) => r.cls));
const inter = results.flatMap((r) => r.interactions);
const sizes = bundleSizes();
const initialJs = sizes.filter((s) => s.initial && s.file.endsWith('.js')).reduce((a, s) => a + s.gzip, 0);
const brandLoaded = [...new Map(results.flatMap((r) => r.brand).map((b) => [b.file, b])).values()];
const brandFirstView = brandLoaded.reduce((a, b) => a + b.bytes, 0);
const brandOnDisk = brandFiles();

const md = `# Lab performance

Measured ${new Date().toISOString().slice(0, 10)} with \`scripts/perf-lab.mjs\` against the production build served under \`/trunk/\` on localhost.

**Profile:** Playwright Chromium (Lighthouse-like mobile settings), gzip-compressed assets as GitHub Pages serves them, 390×844 viewport, device scale factor 3, touch, 4× CPU slowdown, emulated network 1.6 Mbps down / 750 Kbps up / 150 ms RTT. ${runs} cold loads. This is an emulated lab profile on a cloud container, not a real phone and not field Core Web Vitals.

| Metric | Result | Target |
|---|---|---|
| Initial JS (gzip, excludes lazy evidence and image export) | ${(initialJs / 1024).toFixed(1)} KB | < 200 KB |
| LCP (median of ${runs}) | ${Math.round(lcp)} ms | < 2500 ms |
| CLS (worst of ${runs}) | ${cls.toFixed(3)} | < 0.1 |
| Filter change → results updated (median / worst of ${inter.length}) | ${Math.round(median(inter))} ms / ${Math.round(Math.max(...inter))} ms | < 100 ms |
| Brand images on first view (logo + icons fetched, DPR 3) | ${(brandFirstView / 1024).toFixed(1)} KB | small; not render-blocking |

## Brand images

The header logo is an \`<img>\` with a 1×/2×/3× \`srcset\` and explicit width/height (no layout shift); favicons and the touch icon are linked from \`index.html\`. The 2172 × 724 and 1254 × 1254 masters in \`public/brand/\` are copied to the build as source files but are never requested by the app.

| File | Size | Fetched on first view (390 px, DPR 3) |
|---|---|---|
${brandOnDisk.map((b) => `| ${b.file} | ${(b.bytes / 1024).toFixed(1)} KB | ${brandLoaded.some((x) => x.file === b.file) ? 'yes' : 'no'} |`).join('\n')}

## Bundle

| File | Raw | Gzip | Loaded |
|---|---|---|---|
${sizes.map((s) => `| ${s.file} | ${(s.raw / 1024).toFixed(1)} KB | ${(s.gzip / 1024).toFixed(1)} KB | ${s.initial ? 'initially' : /^(PlannerView|planner|evidence)-/.test(s.file) ? 'on demand (prefetched when idle)' : 'on demand'} |`).join('\n')}
`;
writeFileSync(join(root, 'reports', 'performance.md'), md);
console.log(md);
