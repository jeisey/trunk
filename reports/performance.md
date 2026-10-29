# Lab performance

Measured 2026-10-29 with `scripts/perf-lab.mjs` against the production build served under `/trunk/` on localhost.

**Profile:** Playwright Chromium (Lighthouse-like mobile settings), gzip-compressed assets as GitHub Pages serves them,, 390×844 viewport, device scale factor 3, touch, 4× CPU slowdown, emulated network 1.6 Mbps down / 750 Kbps up / 150 ms RTT. 5 cold loads. This is an emulated lab profile on a cloud container, not a real phone and not field Core Web Vitals.

| Metric | Result | Target |
|---|---|---|
| Initial JS (gzip, excludes lazy evidence and image export) | 174.9 KB | < 200 KB |
| LCP (median of 5) | 1632 ms | < 2500 ms |
| CLS (worst of 5) | 0.000 | < 0.1 |
| Filter change → results updated (median / worst of 30) | 36 ms / 61 ms | < 100 ms |

## Bundle

| File | Raw | Gzip | Loaded |
|---|---|---|---|
| ExportDialog--BNBM-5z.js | 8.5 KB | 3.8 KB | on demand |
| evidence-FzGYVnu9.js | 246.1 KB | 64.4 KB | on demand |
| index-D7rP5BBA.js | 633.0 KB | 174.9 KB | initially |
| index-pSHKDE2m.css | 14.5 KB | 3.9 KB | initially |
