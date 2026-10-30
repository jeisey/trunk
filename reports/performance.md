# Lab performance

Measured 2026-10-30 with `scripts/perf-lab.mjs` against the production build served under `/trunk/` on localhost.

**Profile:** Playwright Chromium (Lighthouse-like mobile settings), gzip-compressed assets as GitHub Pages serves them, 390×844 viewport, device scale factor 3, touch, 4× CPU slowdown, emulated network 1.6 Mbps down / 750 Kbps up / 150 ms RTT. 5 cold loads. This is an emulated lab profile on a cloud container, not a real phone and not field Core Web Vitals.

| Metric | Result | Target |
|---|---|---|
| Initial JS (gzip, excludes lazy evidence and image export) | 186.4 KB | < 200 KB |
| LCP (median of 5) | 1824 ms | < 2500 ms |
| CLS (worst of 5) | 0.000 | < 0.1 |
| Filter change → results updated (median / worst of 30) | 39 ms / 84 ms | < 100 ms |
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
| ExportDialog-B6RyHzQo.js | 9.3 KB | 4.1 KB | on demand |
| PlannerView-DEvDanRb.js | 34.2 KB | 10.8 KB | on demand (prefetched when idle) |
| ShareDialog-CID007RI.js | 5.6 KB | 2.3 KB | on demand |
| SharedView-BTkas4x9.js | 5.6 KB | 2.1 KB | on demand |
| evidence-BBGIZpC0.js | 252.0 KB | 66.1 KB | on demand (prefetched when idle) |
| filters-AZhd8waV.js | 43.4 KB | 14.4 KB | initially |
| index-Dl5qVfu0.css | 25.7 KB | 6.0 KB | initially |
| index-KUAdVxe3.js | 625.8 KB | 172.0 KB | initially |
| planner-DOTrJ1Mu.js | 17.9 KB | 7.0 KB | on demand (prefetched when idle) |
| share-AWDa-EYa.js | 7.5 KB | 3.2 KB | on demand |
