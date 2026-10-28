# Trunk

**A little help for the next hour.** An elephant's trunk full of useful ideas.

Trunk is a fast, mobile-first website that helps a parent of a child from 1 week to 4 years (before the fifth birthday) find something realistic to do next: understand how to do it in a glance, and put the phone down. It works for one child or two children of different ages, can fill a time window ("the next 90 minutes") with a varied, editable plan, saves up to ten plans in the browser, and shares plans by link or image.

"Trunk" is a working name, not a trademark or domain claim.

- Live site (after Pages is enabled): `https://jeisey.github.io/trunk/`
- Content contract: [`docs/content-contract.md`](docs/content-contract.md) · Policy: [`docs/content-policy.md`](docs/content-policy.md) · Research: [`docs/research.md`](docs/research.md) · Decisions: [`docs/decisions.md`](docs/decisions.md) · Maintenance: [`docs/maintenance.md`](docs/maintenance.md)
- Coverage report: [`reports/coverage.md`](reports/coverage.md) · Performance: [`reports/performance.md`](reports/performance.md)

## What it does

- **Find something now.** The first screen is the tool: age slider (weekly steps for the first 12 weeks, then monthly), −/+ stepper, and typed age input; quick filters for time, your energy/attention ("busy nearby", low, some, ready to play), and indoors/outdoors; a low-prep switch; more filters behind a disclosure. Empty results offer one-tap relaxations of optional filters; age, readiness, and supervision limits are never relaxed silently.
- **Activities with a consistent structure:** time estimate, setup, 2–4 steps, stop cues, safety notes on the activity itself, adaptations, an optional sourced "why it can help", tummy-time position and target scope where relevant, and expandable sources with checked dates.
- **Two children, one adult.** "Together" means one curated activity with distinct roles; "side by side" means two compatible tracks one adult can supervise in the same space. Two-child suggestions come only from curated pairings, each re-checked by the one-adult feasibility rules at build time.
- **Plan a window or a day.** A deterministic client-side planner fills a window with varied activities, setup, flexible breaks, and visible open time. It never stretches an activity past its realistic maximum. Parallel tracks count once in wall-clock time. Every entry can be resized, reordered, swapped, or removed with buttons; parents can add their own entries (no sources attached).
- **Save and share.** Up to 10 named plans in `localStorage` (versioned, with corrupt/blocked/quota handling and undo). Share links carry a compressed, versioned payload in the URL fragment, default to generic child labels and approximate ages, and leave out names, custom text, and notes unless the parent opts in after a preview. Recipients see a preview that is re-checked against today's catalog and choose whether to save.
- **Images.** 1080×1350 feed and 1080×1920 story PNGs, drawn on the device, paginated rather than shrunk, with download links and native file sharing where the browser allows it.

## Run, test, build

Requires Node 22.18+ (scripts use Node's built-in TypeScript type stripping).

```bash
npm ci
npm run dev            # http://localhost:5173 (validates and builds the catalog first)
npm run content        # validate all content, write src/generated/, reports/coverage.*, docs/schema/
npm run check          # content + typecheck + unit tests
npm run build          # content + typecheck + production build into dist/
npx playwright test    # browser journeys against dist/ served under /trunk/ (Chromium)
node e2e/serve.mjs &   # serve dist/ under /trunk/ with gzip, like GitHub Pages
node scripts/perf-lab.mjs   # lab performance report → reports/performance.md
```

The generated catalog in `src/generated/` is not committed; `dev`, `test`, `typecheck`, and `build` regenerate it.

## Deploy (GitHub Pages)

`.github/workflows/ci.yml` validates content, typechecks, runs unit tests, builds, runs the browser journeys, and on pushes to `main` deploys `dist/` to GitHub Pages with least-privilege permissions (`contents: read`; the deploy job adds `pages: write` and `id-token: write`).

One-time setup in the repository settings:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → General → Default branch: `main`** (the `github-pages` environment only accepts deployments from the default branch).
3. Re-run the latest "CI and deploy" workflow on `main` (Actions tab → workflow → Run workflow), or push to `main`.

The build uses relative asset paths and hash routing, so it works at any repository path without server rewrites. The deploy job sets `VITE_SITE_URL` from the Pages URL so exported images print the right address.

## Storage and sharing limits

- Saved plans live only in this browser on this device (max 10). Clearing site data or private browsing can remove them. No accounts, no sync, no server.
- Share links are encoded, not encrypted: anyone with the link can read the plan inside it. Links over 2,000 characters are refused with an image/JSON-file fallback; incoming links are size-limited, decompression-limited, schema-validated, text-cleaned, and re-checked against current safety and age rules.
- Exported images cannot contain clickable links; per-plan social preview images aren't possible from static hash links.

## Content maintenance

See [`docs/maintenance.md`](docs/maintenance.md): recheck sources every 6–12 months, bump `rev` on material changes, retire (never delete) unsafe or outdated records so old links still resolve, and keep IDs permanent.

## Known limitations

See the "Known limitations" section of [`docs/research.md`](docs/research.md) and the final notes in [`TASKS.md`](TASKS.md).

## License

No license has been chosen yet; all rights reserved by the repository owner until one is added.
