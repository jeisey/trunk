# Content maintenance

Trunk's activities are meant to be reusable for years, but the advice behind them changes. "Evergreen" means maintainable, not frozen. Nothing here schedules itself; someone has to do it.

## Cadence

- **Every 6–12 months:** recheck every source (oldest `checked` dates first). `reports/coverage.md` and the About page show the latest check date; each source shows its own.
- **When major guidance changes** (for example, an AAP policy statement on sleep, media, or tummy time), recheck the affected claims right away rather than waiting for the cycle.
- **Sources past their own review date** (HSE and NHS pages print one) are flagged in `docs/research/*.md`; prefer replacing them with a current page at the next cycle.

## How to recheck a source

1. Open the exact URL in a browser. If it redirects or 404s, find the organization's current page on the same topic.
2. Find each claim that cites the source (`grep -rn "src.<id>" content/`). Re-read the passage named in the claim's `locator`.
3. If the passage still supports the claim, update the source's `checked` date (and `updated` if the page shows a newer date).
4. If the passage changed:
   - Edit the claim's `text`, `paraphrase`, `scope`, or `caveat` so they match. Never stretch a claim beyond what the passage says.
   - Re-read every activity and recipe that cites the claim and bump its `rev` if its instructions or safety notes change.
5. If guidance now makes an activity unsafe or unsupported, **retire** it (below) rather than deleting it.
6. Run `npm run content` (validates everything and regenerates the coverage report) and `npm test`.

## Versioning

- Each record carries `rev` (bump on any material change to instructions, ages, supervision, or safety) and `checked` (the date its sources were last verified).
- The content version shown in the app is the latest source-check date.
- IDs are permanent. Never rename an ID or reuse it for a different idea; old share links and saved plans refer to IDs.
- Schema changes go through `src/content/schema.ts` (bump `SCHEMA_VERSION` and write a migration if stored or shared data would be affected).

## Timing classifications

- When an activity's steps, noise, mess, or movement change materially, re-review `timing.stimulation` and its listed rules, and bump `rev`.
- Recheck the timing sources (AAP spit-up, HSE tummy time, HSE naps, NHS helping your baby to sleep) on the normal cadence; if a source adds or removes a number, update the rule's `window.basis` and `reason` accordingly.
- `reports/coverage.md` lists `variable` (unresolved) records and wind-down coverage by age; treat those as the backlog.
- Formats that store plans are versioned (plan, storage envelope, share links, plan files). Any change to `src/lib/plan.ts` needs a migration in `migratePlan` and a fixture test before release.

## Retiring a record

Add a `retired` object:

```json
"retired": { "date": "2027-03-01", "reason": "AAP no longer recommends this position for babies under 3 months." }
```

Retired records stay in the bundle so that old share links and saved plans still resolve, but they are never suggested, cannot be added to a plan, and are dropped (with an explanation) when a plan that contains them is opened or imported.

## Adding content

Follow `docs/content-contract.md` and `docs/content-policy.md`. In short: open and read the source, write the claim in your own words with a locator and scope, keep supervision fields honest (they drive planner feasibility), and run `node scripts/build-catalog.ts --check --only <file>`.

Two-child suggestions come only from curated recipes in `content/workstreams/mix.json`. Every parallel recipe is re-checked by the one-adult feasibility rules on each build.

## Clinical review

No qualified clinician has reviewed Trunk's content. If one does, record who, when, and which records in `docs/research.md`, and only then change the app's wording about review.
