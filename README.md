# Trunk

**A little help for the next hour.** An elephant's trunk full of useful ideas.

Trunk is a fast, mobile-first website that helps a parent of a child from 1 week to 4 years (before the fifth birthday) find something realistic to do next: understand how to do it in a glance, and put the phone down. It works for one child or two children of different ages, can fill a time window ("the next 90 minutes") with a varied, editable plan, saves up to ten plans in the browser, and shares plans by link or image.

"Trunk" is a working name, not a trademark or domain claim.

- Live site (after Pages is enabled): `https://jeisey.github.io/trunk/`
- Content contract: [`docs/content-contract.md`](docs/content-contract.md) · Timing and routines: [`docs/timing-and-routines.md`](docs/timing-and-routines.md) · Policy: [`docs/content-policy.md`](docs/content-policy.md) · Research: [`docs/research.md`](docs/research.md), [`docs/research/timing.md`](docs/research/timing.md) · Decisions: [`docs/decisions.md`](docs/decisions.md) · Maintenance: [`docs/maintenance.md`](docs/maintenance.md) · Brand kit: [`docs/brand/README.md`](docs/brand/README.md)
- Reports: [coverage](reports/coverage.md) · [planner sequence before/after](reports/planner-sequence.md) · [performance](reports/performance.md) · Reviews: [content](docs/review/content-review.md), [integration](docs/review/integration-review.md), [timing and formats](docs/review/timing-review.md)

## Catalog at a glance

- **111 activities** from 1 week to 59 months, **29 curated two-child pairings** (16 together, 13 side by side), and **7 editable starter plans** (one with an example nap block).
- **253 claims** backed by **120 sources** (US, plus Ireland, UK, Canada, Australia, and WHO), each opened and read on its recorded date.
- **Timing:** every activity and pairing has a reviewed stimulation profile (settling, gentle, lively, or variable), and **9 timing rules** relate activities to milk feeds, meals, and naps. Each rule says whether its guidance and its minute window come from a source or are Trunk's own planning convention.
- Every age-slider stop and every sampled two-child age pair meets the coverage thresholds in [`reports/coverage.md`](reports/coverage.md).
- Independent content and safety review: [`docs/review/content-review.md`](docs/review/content-review.md) (all blockers and majors fixed; resolution table at the end).
- No clinician has reviewed the content; the app says so.

## What it does

- **Find something now.** The first screen is the tool: age slider (weekly steps for the first 12 weeks, then monthly), −/+ stepper, and typed age input; minutes and your energy/attention up front; place, low prep, focus, materials, mess, noise, and adults behind "More filters" with a summary and Reset. Optional per-child **Just fed** and **Nap soon** toggles (independent, kept in memory only) re-rank ideas, show one relevant cue per card, and set aside ideas that don't suit the moment, separately from age, readiness, and supervision limits, which are never relaxed silently. The plan button always matches the chosen minutes.
- **Activities with a consistent structure:** time estimate, setup, 2–4 steps, stop cues, safety notes on the activity itself, adaptations, an optional sourced "why it can help", tummy-time position and target scope where relevant, and expandable sources with checked dates.
- **Two children, one adult.** "Together" means one curated activity with distinct roles; "side by side" means two compatible tracks one adult can supervise in the same space. Two-child suggestions come only from curated pairings, each re-checked by the one-adult feasibility rules at build time.
- **Plan around naps and meals.** Start blank, fill the next N minutes, or use an example. "Add block" offers activities, **nap, milk feed, meal, snack**, breaks, and your own entries; routine blocks stay at their set times. "Fill around these blocks" keeps routines, kept entries, and your own entries, and fills the gaps with a deterministic, phase-aware sequence: livelier play earlier, calmer ideas before a known nap, a gentle start after waking, tummy time kept away from feeds. With two children, one child's activities can run alongside the other's nap or feed only when one adult can actually supervise both; otherwise the time is shown as unplanned. Conflicts come with local fixes (shorten, move, remove), never silent changes. Wall-clock time is the union of occupied time, so parallel tracks count once.
- **Save and share.** Up to 10 plans in `localStorage` with useful default names (versioned, with corrupt/blocked/quota handling, undo, and an accessible More menu). Share links carry a compressed, versioned payload in the URL fragment, default to generic child labels and ages in whole weeks or months (no birth dates), and leave out names, custom text, and notes unless the parent opts in after a preview. Recipients see a preview that is re-checked against today's catalog and choose whether to save.
- **Images.** 1080×1350 feed and 1080×1920 story PNGs with the Trunk logo, drawn on the device, paginated rather than shrunk (routines stay with their alongside tracks), with download links and native file sharing where the browser allows it.
- **Brand.** The supplied Trunk logo and elephant mark (masters unchanged in `public/brand/`, 1–8 KB web renditions in `public/brand/web/`), forest and sky colours from one token source (`src/brand.ts`, mirrored in CSS and checked by a test).

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

## Formats and compatibility

Plans, the saved-plans store, the session draft, share links, and plan files are versioned separately. Version 2 adds routine blocks, set times, kept entries, and alongside tracks; version 1 plans, drafts, `#/s/1z.…` links, and `trunkPlan: 1` files still open without losing entries or changing their timeline, and a v1 custom entry labelled "Nap" stays custom text. The first v2 save keeps a one-time copy of v1 data, and a downgrade written by an old tab is detected and merged rather than lost. Fixtures from the v1 encoder live in `tests/fixtures/plans/`.

## Storage and sharing limits

- Saved plans live only in this browser on this device (max 10). Clearing site data or private browsing can remove them. No accounts, no sync, no server.
- Share links are encoded, not encrypted: anyone with the link can read the plan inside it. Links over 2,000 characters are refused with an image/JSON-file fallback; incoming links are size-limited, decompression-limited, schema-validated, text-cleaned, and re-checked against current safety and age rules.
- Exported images cannot contain clickable links; per-plan social preview images aren't possible from static hash links.

## Content maintenance

See [`docs/maintenance.md`](docs/maintenance.md): recheck sources every 6–12 months, bump `rev` on material changes, retire (never delete) unsafe or outdated records so old links still resolve, and keep IDs permanent.

## Checks

- `npm run check`: content validation (schema, references, safety and timing rules, one-adult feasibility) + typecheck + unit tests (evaluator, layout, edit operations incl. a property check, planner scenarios, compatibility fixtures, storage, share, brand tokens).
- `npx playwright test`: browser journeys, refinement scenarios (duration, Just fed / Nap soon, routine lifecycle, two children in both orders, v1 compatibility, caveats on About), visual QA (320/390/768/1280 px, 200% text, touch targets, menus, exports), and axe scans, against the production build served under `/trunk/` (Chromium; WebKit runs only where installed, `PW_WEBKIT=1`).
- Lab performance ([`reports/performance.md`](reports/performance.md)), emulated mobile (4× CPU, 1.6 Mbps): initial JS under 200 KB gzip, LCP under 2 s, CLS 0, brand images about 6 KB on first view. Not a real-device or field measurement.

## Known limitations

- Content and timing rules are source-informed and agent-reviewed, not clinician-reviewed; US guidance is the default and other jurisdictions are labelled. Before-nap and after-waking preferences, and all minute windows not stated by a source, are Trunk's editorial conventions.
- Trunk doesn't track feeds or sleep, ask about medical conditions, or prescribe nap lengths, wake windows, or feeding intervals. "Just fed" and "Nap soon" are not saved.
- Durations, setup times, and effort levels are editorial estimates.
- Readiness filtering is opt-in ("not yet" toggles); age is only a starting filter.
- Two-child suggestions exist only where a curated pairing fits both ages; some gaps (for example a 6-week-old with a 3-year-old) have only two options. Alongside play during a nap needs a settling time; with "Not sure", the other child's time is left unplanned.
- Browser journeys were run in headless Chromium in a container (with mobile viewport emulation); not on real phones, and not in WebKit/Safari here.
- Native file sharing was tested with a mocked `navigator.share`; real share sheets weren't exercised.
- "Two adults" only unlocks content that needs two adults; none does yet, so it changes nothing today.
- Deleting two saved plans in a row replaces the first Undo notice with the second.
- See [`docs/research.md`](docs/research.md) for source-level caveats (pages read through a summarizing tool, sources past their review dates).

## License

No license has been chosen yet; all rights reserved by the repository owner until one is added.
