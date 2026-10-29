# Lab performance

Measured 2026-10-29 with `scripts/perf-lab.mjs` against the production build served under `/trunk/` on localhost.

**Profile:** Playwright Chromium (Lighthouse-like mobile settings), gzip-compressed assets as GitHub Pages serves them, 390×844 viewport, device scale factor 3, touch, 4× CPU slowdown, emulated network 1.6 Mbps down / 750 Kbps up / 150 ms RTT. 5 cold loads. This is an emulated lab profile on a cloud container, not a real phone and not field Core Web Vitals.

| Metric | Result | Target |
|---|---|---|
| Initial JS (gzip, excludes lazy evidence and image export) | 183.7 KB | < 200 KB |
| LCP (median of 5) | 1732 ms | < 2500 ms |
| CLS (worst of 5) | 0.000 | < 0.1 |
| Filter change → results updated (median / worst of 30) | 39 ms / 82 ms | < 100 ms |
| Brand images on first view (logo + icons fetched, DPR 3) | 6.2 KB | small; not render-blocking |

## Brand images

The header logo is an `<img>` with a 1×/2×/3× `srcset` and explicit width/height (no layout shift); favicons and the touch icon are linked from `index.html`. The 2172 × 724 and 1254 × 1254 masters in `public/brand/` are copied to the build as source files but are never requested by the app.

| File | Size | Fetched on first view (390 px, DPR 3) |
|---|---|---|
| brand/web/trunk-icon-180.png | 1.8 KB | no |
| brand/web/trunk-icon-192.png | 2.7 KB | no |
| brand/web/trunk-icon-32.png | 0.9 KB | no |
| brand/web/trunk-icon-48.png | 1.1 KB | no |
| brand/web/trunk-icon-512.png | 8.0 KB | no |
| brand/web/trunk-logo-168.png | 1.9 KB | no |
| brand/web/trunk-logo-336.png | 3.9 KB | no |
| brand/web/trunk-logo-504.png | 6.2 KB | yes |

## Bundle

| File | Raw | Gzip | Loaded |
|---|---|---|---|
| ExportDialog-DvsEiAm3.js | 9.7 KB | 4.2 KB | on demand |
| PlannerView-CGOjC12z.js | 28.2 KB | 8.9 KB | on demand (prefetched when idle) |
| ShareDialog-D8xR5qRR.js | 5.5 KB | 2.3 KB | on demand |
| SharedView-D6osL7mI.js | 5.5 KB | 2.0 KB | on demand |
| evidence-aLWkSZ4e.js | 251.9 KB | 66.1 KB | on demand (prefetched when idle) |
| filters-BRMYlNb3.js | 43.4 KB | 14.4 KB | initially |
| index-CJdVb7D8.js | 615.8 KB | 169.3 KB | initially |
| index-Gf6LiHAf.css | 24.5 KB | 5.8 KB | initially |
| planner-Bgc0Y2Ym.js | 16.5 KB | 6.6 KB | on demand (prefetched when idle) |
| share-DTDGsSd2.js | 7.5 KB | 3.2 KB | on demand |
