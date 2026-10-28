# Trunk — task board

Resumable state for this build. Update as work lands. A task is done only when
its completion check has actually been run.

## Status key
`[x]` done and checked · `[~]` in progress · `[ ]` not started · `[!]` blocked

## Resume notes
- Research agents A–D finished; E and F in progress; mixed-age + independent review not started yet (they need E/F).
- Local check: `npm run check` (content + typecheck + unit), `npm run build && npx playwright test` (journeys; 2 and 3 need mixed-age and E content).
- Perf: `node e2e/serve.mjs &` then `node scripts/perf-lab.mjs` → `reports/performance.md`.

## 1. Shared contract (lead)
- [x] Zod schema + enums + ID rules (`src/content/schema.ts`). Check: fixtures validate.
- [x] Age normalization utility (`src/lib/age.ts`). Check: unit tests for boundaries.
- [x] Cross-record validator + safety rules (`src/content/validate.ts`). Check: invalid fixtures rejected.
- [x] Catalog build + coverage report (`scripts/build-catalog.ts`). Check: `npm run content` writes `reports/coverage.md`.
- [x] Core sources/claims + 4 tummy-time activities (`content/core.json`), sources opened 2026-10-28.
- [x] Contract brief + content policy (`docs/content-contract.md`, `docs/content-policy.md`).

## 2. Research workstreams (subagents, ≤ 4 at once)
Completion check for each: ≥ 12 distinct activities, `--check --only <file>` exits 0, research notes complete, lead spot-check of sources.
- [x] A 1 week – under 3 months → `content/workstreams/a.json` (15 activities), `docs/research/a.md`
- [x] B 3 – under 6 months → `b.json` (16), `docs/research/b.md`
- [x] C 6 – under 12 months → `c.json` (16), `docs/research/c.md`
- [x] D 12 – under 24 months → `d.json` (17), `docs/research/d.md`
- [~] E 24 – under 36 months (+ media guidance) → `e.json`, `docs/research/e.md`
- [~] F 36 – under 60 months → `f.json`, `docs/research/f.md`
- [ ] Mixed-age: ≥ 18 recipes (9 together, 9 parallel), 6 starter plans → `mix.json`, `docs/research/mix.md`
- [ ] Independent content/safety review against actual sources → `docs/review/content-review.md`
- [ ] Independent integration review → `docs/review/integration-review.md`

## 3. Application (lead)
- [x] Finder: 1–2 children, non-uniform age slider + stepper + typed input, quick filters, advanced filters, results, empty states with one-tap relax.
- [x] Activity detail: setup, steps, adaptations, why, stop cues, safety, sources.
- [~] Two children: together / parallel / either from curated recipes only.
- [x] Deterministic planner: window fill, breaks, open time, wall-clock math, infeasibility explanations.
- [x] Plan editor: add/remove/replace/reorder/resize, custom entries, keyboard controls.
- [x] Saved plans: 10 max, rename/duplicate/delete+undo, migrations, corrupt/blocked/quota handling.
- [x] Share links: versioned compressed fragment payload, preview import, privacy options, size budget, fallback.
- [x] Image export (lazy): 1080×1350 and 1080×1920, pagination, preview, download + native share.
- [x] Sources/about page, tummy-time guidance panel, media guidance.
- [x] Mascot SVG, visual design, accessibility.

## 4. Verification
- [x] Vitest: schema/references, age boundaries, planner, storage, share codec, text safety.
- [~] Playwright journeys 1–8 against production build under a non-root base path.
- [ ] Screenshots + exported images inspected (`review-artifacts/`, not committed).
- [ ] Performance: bundle size, LCP/CLS lab profile, filter latency.

## 5. Delivery
- [ ] README, `docs/maintenance.md`, decisions, research summary.
- [~] GitHub Actions: validate, test, build, e2e, deploy to Pages.
- [ ] PR opened, CI green, merged to `main`.
