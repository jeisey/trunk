# Lab performance

Measured 2026-10-28 with `scripts/perf-lab.mjs` against the production build served under `/trunk/` on localhost.

**Profile:** Playwright Chromium (Lighthouse-like mobile settings), gzip-compressed assets as GitHub Pages serves them,, 390×844 viewport, device scale factor 3, touch, 4× CPU slowdown, emulated network 1.6 Mbps down / 750 Kbps up / 150 ms RTT. 3 cold loads. This is an emulated lab profile on a cloud container, not a real phone and not field Core Web Vitals.

| Metric | Result | Target |
|---|---|---|
| Initial JS (gzip, excludes lazy evidence and image export) | 136.8 KB | < 200 KB |
| LCP (median of 3) | 1568 ms | < 2500 ms |
| CLS (worst of 3) | 0.000 | < 0.1 |
| Filter change → results updated (median / worst of 18) | 47 ms / 69 ms | < 100 ms |

## Bundle

| File | Raw | Gzip | Loaded |
|---|---|---|---|
| ExportDialog-B02CLmKC.js | 8.5 KB | 3.8 KB | on demand |
| evidence-C20BVwk1.js | 175.2 KB | 46.2 KB | on demand |
| index-D8avyHrm.js | 476.2 KB | 136.8 KB | initially |
| index-uRKztIvx.css | 14.1 KB | 3.7 KB | initially |
