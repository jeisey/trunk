# Decisions and assumptions

Material, reversible decisions made without asking. Newest at the bottom.

1. **Name.** "Trunk" with the tagline "A little help for the next hour." The repository had no existing name. This is a working name, not a trademark or domain claim.
2. **Stack.** Vite 8 + React 19 + TypeScript 6, plain CSS, Zod 4 for the content contract and runtime validation of shared/stored data, Vitest 5, Playwright 1.63 (pinned to match the pre-installed Chromium build). No CSS framework, router, state library, or compression library.
3. **Single authority for types.** Zod schemas in `src/content/schema.ts`; TS types via `z.infer`; JSON Schema generated to `docs/schema/content.schema.json` on every content build.
4. **Scripts run with Node's built-in type stripping** (Node ≥ 22.18), so imports use explicit `.ts` extensions and only erasable TypeScript syntax (`erasableSyntaxOnly`). Avoids adding `tsx`/`ts-node`.
5. **Age canonical unit = whole days.** 1 week = 7 days; 1 month = 365.25/12 = 30.4375 days rounded to the nearest day; years = 12 months. The same conversion is used for content bounds and entered ages, so "4 months" compares exactly against `4m`. Ranges are half-open `[min, max)`. Supported 1 week to under 60 months.
6. **Slider stops are non-uniform:** weekly 1–12 weeks, then monthly 3–59 months (69 stops), plus −/+ stepper and typed input.
7. **Content is JSON, one file per workstream,** merged and validated at build time into `src/generated/catalog.json`, which is bundled (no runtime fetch, no scraping).
8. **Supervision is modelled as data that drives feasibility:** participation (leads/joins/watches), proximity (holding/arms-reach/same-room), hands-on (continuous/intermittent/none), minimum adults, shareable, and a concrete space constraint. One-adult parallel feasibility is a categorical function (`src/lib/supervision.ts`) used by both the validator and the planner.
9. **Two-child suggestions come only from curated mixed-age recipes.** Compatibility is never inferred from overlapping ages or effort tags. The feasibility function double-checks every parallel recipe at build time.
10. **Tummy-time position is explicit on each tummy-time record.** Only `floor` counts as a flat surface. The app never credits chest/lap/carry/propped minutes toward a flat-surface target.
11. **The reported CHOP instruction** (60 minutes a day on a flat surface for this family's 4-month-old, elevated positions excluded) is preserved as reported, individualized clinical guidance. It is not a public CHOP protocol, it is not verified from a public document, and the app never applies it to every baby.
12. **Energy/attention is one control** with four levels: busy nearby (you can watch but not play), low, some, plenty. "Busy nearby" admits only activities with `watches` + `same-room` + no hands-on + shareable + no water/heat/food/traffic hazards.
13. **Media** appears only when the record's age floor is met and the parent chose the busy-nearby or low-energy context; it is never a planner default and is capped per plan.
14. **Routing uses the URL hash** (`#/…`) so GitHub Pages needs no rewrites; Vite `base` is `./` so the build works under any repository path.
15. **No service worker, analytics, external fonts, or runtime network calls** in v1.
16. **Runtime validation uses `zod/mini`; the full Zod API runs only at build/test time.** Vocabularies live in a Zod-free module (`src/content/vocab.ts`). This cut the initial bundle by ~20 KB gzip.
17. **Evidence loads lazily.** Activities, pairings, and starter plans ship in the initial bundle; claims and sources (`src/generated/evidence.json`) load in a separate chunk, prefetched when the browser is idle and on any page that shows sources. Keeps initial JS well under 200 KB gzip as the catalog grows.
18. **Midday sun rule for babies under 6 months.** Following AAP's 2026 *Baby Sunburn Prevention* page, the planner never schedules an outdoor, sun-exposed activity for a baby under 6 months between 10 a.m. and 4 p.m., and says so in the plan notes. Shaded walks outside that window remain, with clothing/shade/heat notes on the activity.
19. **One child of two.** With two children, "Who's this for?" can target one child (ideas and plans for that child only) with a visible reminder that the other child must be asleep, safely contained in view, or with another adult. Empty two-child results offer this as a one-tap option.
20. **Default first-visit age is 6 months.** Any default is arbitrary; mid-infancy shows a representative set. Ages and filters (never names or dates) are remembered in this browser for convenience.
21. **Share-link budget is 2,000 characters** for the whole URL. Typical plans use 150–400. Decoding is capped at 6,000 input characters and 16 KB decompressed. Over-budget plans fall back to images or a downloadable plan file that imports through the same checks.
22. **The local test server gzips text assets** to match GitHub Pages; lab performance is measured that way (`scripts/perf-lab.mjs`).
23. **Accessibility scan:** `@axe-core/playwright` (dev only) runs WCAG 2.1 A/AA rules on every main view and dialog, in addition to keyboard, zoom, and touch-target checks.
24. **Hot playground surfaces** are tagged `sun-weather` with a safety note rather than `heat`; `heat` is reserved for stoves, ovens, and hot liquids, which are never shareable.
