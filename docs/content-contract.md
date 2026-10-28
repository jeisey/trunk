# Trunk content contract (v1, frozen)

This is the brief every content writer follows. The machine authority is
`src/content/schema.ts` (Zod) plus `src/content/validate.ts` (cross-record and
safety rules). The generated JSON Schema is `docs/schema/content.schema.json`.
Only the lead changes these files. If you need a contract change, write it under
"Schema change requests" in your research notes; do not work around the schema.

Read `docs/content-policy.md` before writing anything.

## Files and ownership

| Owner | Content file | Research notes |
|---|---|---|
| Lead | `content/core.json` (shared sources, cross-cutting claims, 4 tummy-time activities) | `docs/research.md` |
| Workstream A (1 week – under 3 months) | `content/workstreams/a.json` | `docs/research/a.md` |
| Workstream B (3 – under 6 months) | `content/workstreams/b.json` | `docs/research/b.md` |
| Workstream C (6 – under 12 months) | `content/workstreams/c.json` | `docs/research/c.md` |
| Workstream D (12 – under 24 months) | `content/workstreams/d.json` | `docs/research/d.md` |
| Workstream E (24 – under 36 months) | `content/workstreams/e.json` | `docs/research/e.md` |
| Workstream F (36 – under 60 months) | `content/workstreams/f.json` | `docs/research/f.md` |
| Mixed-age workstream | `content/workstreams/mix.json` | `docs/research/mix.md` |

Write only your own two files. Do not edit `core.json`, other workstreams'
files, the schema, or app code. Do not commit.

Each content file:

```json
{
  "schema": 1,
  "workstream": "A",
  "description": "One sentence.",
  "sources": [],
  "claims": [],
  "activities": [],
  "recipes": [],
  "starterPlans": []
}
```

## Validate continuously

```
node scripts/build-catalog.ts --check --only content/workstreams/a.json
```

This loads every content file (so you can reference `core.json` and other
workstreams' IDs) but only reports errors in your file. It must exit 0 before
you finish. Unknown fields are rejected.

## Identifier rules

- Activities: `act.<slug>` — e.g. `act.contrast-card-gaze`. Global namespace; search existing files before naming.
- Recipes: `mix.<slug>`. Starter plans: `plan.<slug>`.
- Sources: `src.<org>.<slug>` — org short code such as `aap-hc`, `cdc`, `nichd`, `who`, `nhs`, `hse`, `cps`, `sickkids`, `zero-to-three`, `cpsc`, `aap-pubs`. One source per URL across the whole catalog: if a URL already exists (check `content/core.json` and other files), reuse that ID.
- Claims: `clm.<ws>.<slug>` where `<ws>` is your lowercase workstream letter (`a`–`f`) or `mix`; the lead uses `core`.
- Slugs: lowercase letters, digits, single hyphens.
- IDs are stable. Never rename or reuse an ID for a different idea.

## Ages

Age strings are a whole number plus one unit: `1w`, `6w`, `3m`, `18m`, `2y`.
1 month = 30.4375 days (rounded); 1 week = 7 days. Ranges are half-open:
`ageMin` inclusive, `ageMax` exclusive ("3 to under 6 months" = `3m`/`6m`).
Supported range is `1w` to `60m`. Age is a starting filter, not proof of
safety or readiness; put abilities in `readiness.abilities`.

Use conservative ranges. Don't widen a range to fill coverage. A record may
span bands when that is genuinely appropriate.

## Activity fields

| Field | Meaning and rules |
|---|---|
| `id`, `rev` | Stable ID; `rev` starts at 1 and increments on material edits. |
| `title` | ≤ 48 chars, plain and concrete ("Sock basket sort"). |
| `summary` | One-sentence instruction, ≤ 150 chars, says what to do. |
| `kind` | `play`, `outing` (leaves home; set `outing: true`), `routine` (everyday task made playful), `media` (screen; workstream E only). |
| `ageMin`/`ageMax` | See Ages. |
| `readiness.abilities` | Required abilities from: `head-control`, `rolls`, `sits-independently`, `crawls`, `pulls-to-stand`, `walks`, `runs`, `jumps`, `climbs`, `eats-solids`, `follows-directions`, `no-longer-mouthing`. Parents can mark abilities "not yet" to hide these. ≤ 4. |
| `readiness.notes` | ≤ 2 short notes (e.g., "Ask your clinician first if your baby was born early."). No milestone deadlines. |
| `goals` | 0–3 of `gross-motor`, `fine-motor`, `communication`, `cognition`, `social-emotional`, `sensory`. Non-empty goals require at least one supporting claim. Leave empty for a purely practical routine. |
| `intents` | 1–3 of `connect`, `move`, `calm`, `fresh-air`, `explore`, `create`, `routine`, `parent-moment`. `parent-moment` means "parent needs a moment"; it never relaxes supervision. |
| `places` | `indoors` and/or `outdoors`. |
| `spaces` | 1–3 of `floor`, `lap-or-arms`, `table`, `seat`, `kitchen`, `bath-or-sink`, `open-area`, `yard-or-park`, `neighborhood`, `anywhere`. |
| `materials` | `level`: lowest tier needed — `none` (bodies, voices), `household` (common household items), `toys` (common baby/toddler toys, board books, balls), `special` (craft supplies, paint, playdough). `items`: ≤ 8 short names. Prefer free or household items. |
| `setupMinutes`, `cleanupMinutes` | Realistic integer estimates, 0–30. |
| `duration` | `{min, default, max}` in minutes of the child's engagement. Plausible, not aspirational. Very young infants: minutes, not half-hours. Estimates, not recommendations. |
| `effort` | Parent energy: `low` (can do tired, sitting or lying down), `medium`, `high` (active, on your feet, lots of talking). Independent of supervision. |
| `supervision.participation` | `leads` (adult runs it), `joins` (adult plays along part of the time), `watches` (adult supervises, may do a nearby task). |
| `supervision.proximity` | `holding` (child is in your arms/lap/on you), `arms-reach` (within arm's reach, eyes on), `same-room` (in view; you may do a nearby task with frequent checks). |
| `supervision.handsOn` | `continuous`, `intermittent`, or `none`. `holding` implies not `none`. |
| `supervision.minAdults` | 1 or 2. |
| `supervision.shareable` | `true` only if one adult can do this while also supervising another child's compatible activity. Water, heat, food, and traffic are never shareable. |
| `supervision.space` | ≤ 140 chars: the concrete space/hazard constraint parents must meet. |
| `mess` / `noise` | `none/low/medium/high` and `quiet/moderate/loud`. |
| `hazards` | ≤ 6 of `small-parts`, `water`, `heat`, `falls`, `cords`, `sharp`, `food`, `mouthing`, `traffic`, `sun-weather`, `suffocation`, `allergens`. Be honest: listing a hazard is how the validator forces a sourced safety note. |
| `steps` | 2–4 short steps (≤ 180 chars each) a tired parent can follow at a glance. |
| `adaptations` | 1–3: simpler/younger and harder/older versions, or sensory/ability adjustments. |
| `stopCues` | 1–4 child cues that mean stop or change (fussing, turning away, rubbing eyes, frustration). |
| `safety` | 1–4 `{text, claims}` notes shown on the activity itself. Specific to the activity. Notes for serious hazards must cite a `safety` claim. |
| `why` | Optional `{text, claims}`: one useful developmental explanation, only when a source supports it. Describe, don't promise. |
| `tummyTime` | Only for tummy-time activities: `{position: floor|chest|lap|carry|propped, flatSurface}`. Only `floor` is `flatSurface: true`. The lead owns the core tummy-time records; don't duplicate them. |
| `evidence.type` | `described` (a cited source describes this activity), `adapted` (editorial design built on source-informed principles), `practical` (everyday routine/practical choice; no developmental claim). |
| `evidence.claims` | Claims supporting the activity. Required for `described` and `adapted`. |
| `checked` | The date you checked the sources (YYYY-MM-DD). |

## Source and claim fields

Source: `id`, `url` (exact HTTPS URL you opened), `org`, `title`,
`jurisdiction` (`US`, `International`, `IE`, `UK`, `CA`, `AU`, `NZ`, `EU`),
`checked` (date you opened it), `published` and/or `updated` (YYYY, YYYY-MM, or
YYYY-MM-DD, only if the page shows it), optional `notes`.

Claim: `id`, `kind` (`recommendation` = normative guidance from an authority;
`description` = factual/descriptive statement; `safety` = safety instruction),
`text` (Trunk's limited, original wording ≤ 260 chars), `sources`, `locator`
(section heading / list item / paragraph), `paraphrase` (short paraphrase of
the supporting passage, not a copy), `scope` (population, age, jurisdiction,
position limits), optional `caveat` (conflicts, uncertainty).

A claim must be supported by the passage it cites, not merely the general topic.
Durations, setup estimates and similar editorial estimates are not claims.

## Mixed-age recipe fields (mixed-age workstream)

`mode`: `together` (one shared activity with distinct roles) or `parallel`
(two compatible simultaneous tracks one adult can supervise in the same space).
`younger` / `older` roles each have `ageMin`, `ageMax` (inside the referenced
activity's range), `abilities` (must include the activity's required
abilities), `activity` (canonical activity ID), `does`, optional `adapt`.
`adult`: `does`, `minAdults`, `handsOnFor` (`younger|older|both|neither`; must
cover any continuous hands-on activity). Plus `sharedSetup`, `setupMinutes`,
`cleanupMinutes` (counted once), `space`, `duration` (max ≤ both activities'
max), `effort`, `intents`, `steps` (2–4), `stopCues`, `safety`, `claims`.

The validator runs the one-adult feasibility check on every parallel recipe:
both activities shareable; no water/heat/food/traffic; at most one track needing
continuous hands; not both needing arm's reach; not both adult-led; same place.
Older-child activities with small parts are rejected when the younger role
starts under 3 years.

## Starter plans (mixed-age workstream)

`title`, `summary`, `circumstance`, `ages` (1 or 2 age strings used to preview),
`start` (HH:MM), `segments` (ordered `activity` / `recipe` / `break` entries
with minutes inside each record's duration range). Single-child plans use
activities; two-child plans use recipes and breaks. A plan is a sequence of at
least two different activities or recipes, never one activity stretched.

## Completion checklist for a workstream

1. ≥ 12 distinct activities whose primary age coverage is your band (no renamed duplicates).
2. Every source opened and read; checked dates real; claims cite the passage.
3. `node scripts/build-catalog.ts --check --only <your file>` exits 0.
4. `docs/research/<ws>.md` lists: sources consulted (with dates), claim-to-passage map, safety/readiness considerations, conflicts and jurisdiction differences, ideas omitted or softened and why, schema change requests.
