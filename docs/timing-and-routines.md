# Timing and routines contract (v2)

Status: agreed contract for the timing-aware refinement (2026-10-29). The machine
authorities are `src/content/schema.ts` + `src/content/validate.ts` (content),
`src/lib/timing.ts` (evaluator), and `src/lib/plan.ts` + `src/lib/layout.ts`
(plan model and analysis). Contract tests: `tests/layout.test.ts`. Change these
only through the lead.

## Scope

Trunk is an activity and day-planning tool. It is not a sleep-training,
reflux-treatment, nutrition, or infant-tracking app. Timing support exists so a
parent can (a) see ideas that suit "just fed" or "nap soon", and (b) place their
own naps and meals in a plan and have activities flow sensibly around them.

Never: infer a feed or nap from age or the clock; prescribe nap lengths, feeding
intervals, or wake windows; insert a mandatory awake period; promise that an
activity helps sleep; label anything "safe after feeding"; record a medical
condition; force a child to stay awake or postpone a feed to fit arithmetic.

## 1. Content timing model

Every activity has `timing: { stimulation, rules }`; every recipe has
`timing: { stimulation }`.

`stimulation` (reviewed per record):

| Value | Meaning |
|---|---|
| `settling` | Quiet, slow, familiar. Can fit winding down. Requires `noise: quiet` and mess none/low. |
| `gentle` | Calm but engaging. |
| `lively` | Physically active, exciting, loud, or messy. Loud or very messy records must be `lively` (or `variable`). |
| `variable` | Depends on how it's done, or not assessed. Never treated as calm, never cleared. |

Do not derive stimulation from `intents` alone ("calm" intent ≠ settling; chest
tummy time is tagged calm but is still tummy time).

Timing rules are records (`timingRules`, ID `tim.<core|a-f|mix>.<slug>`):

| Field | Meaning |
|---|---|
| `event` | `milk-feed`, `meal` (a snack block counts as a meal), or `nap`. |
| `when` | `before`: window runs back from the event's start. `after`: window runs forward from the event's end. |
| `window` | `{ minutes, basis }`. `basis: source` only when the source gives the number; otherwise `editorial` (Trunk's planning convention, labelled as such to parents). |
| `fit` | `preferred` (ranked up, may show a positive cue), `neutral`, `later` (ranked down, never excluded), `avoid` (left out of automatic suggestions; flagged with a reason if a parent places it). None of these is a medical prohibition. |
| `ageMin`/`ageMax` | Population limit (both or neither). Without them the rule covers the activity's own ages. |
| `condition` | e.g. `spit-up`. Trunk never records conditions, so conditional rules are **advisory**: shown, ranked lower, never used to exclude. |
| `basis`, `claims` | Where the guidance comes from. `source` needs ≥ 1 claim. Editorial rules may cite claims that inform them. |
| `match` | Policy rule: `{ stimulation: [...] }` applies to every activity/recipe with that profile. Policy rules are never listed on records and can't be source-based blanket `avoid`s. |
| `cue` | ≤ 48 chars, parent-facing ("Not right after a feed"). |
| `reason` | ≤ 260 chars: what applies, to whom, and whether it's a source's advice or Trunk's convention. |

Activities list the non-policy rules that apply to them in `timing.rules`.
Validator rules: tummy-time records must carry non-conditional `avoid`
milk-feed rules for both before and after (HSE's advice covers every tummy
position); listed rules must overlap the activity's ages.

Core rules today: `tim.core.tummy-after-milk-feed` (30 min, editorial window),
`tim.core.tummy-before-milk-feed` (15 min, editorial window), and four nap
policies (settling → "Good for winding down" before a nap; lively → "Better
earlier" before a nap; settling/gentle → "Gentle start after waking"; lively →
"Ease in after waking"), all editorial.

## 2. Evaluator (`src/lib/timing.ts`)

- Input: a child's `{ days, events[] }` (minutes on a shared axis) and an entry
  `Span` (`start`, `engageStart`, `engageEnd`, `end`).
- `after` rules are checked against engagement `[engageStart, engageEnd)`;
  `before` rules against engagement plus tidy-up `[engageStart, end)`.
- Windows are measured directly from the event, so breaks or other entries in
  between never reset them.
- `assessRecipe` checks each role's activity against that child's events (the
  younger role goes to whichever child `younger` names), plus policy rules for
  the shared space when it is more stimulating than the child's own role.
- `summarize`: any concern outweighs any preference. Score: non-advisory
  avoid −50, advisory avoid −14, later −10 (advisory −6), preferred +10.
  `avoid: true` only for applicable non-advisory avoids. One `cue` (tone
  `avoid`/`caution`/`good`) for cards and rows; `findings` for detail.
- `unassessed: true` when stimulation is `variable`: no profile preference;
  UIs may say "not rated" in detail, never "fine".

Momentary context (`MomentContext`, finder only): per child `{ fed, fedAgo?, nap, napIn? }`,
held in memory only (not prefs, not session storage, not plans, not shares).
`momentTiming()` turns it into events on an axis where 0 = now: "Just fed" →
milk-feed and meal events ending `fedAgo` ago (default 0); "Nap soon" → nap at
`napIn`, or, with no time, "a nap follows this entry directly" (`napNext`).
Both may be set at once for the same child.

## 3. Plan v2 (`src/lib/plan.ts`)

`Plan.v = 2`. New segment kind `routine` with `routine: nap | milk-feed | meal | snack`,
`who: c1 | c2 | both`, `minutes` (parent's estimate; bounds nap 5–240,
milk feed/meal 5–90, snack 5–45), and `at` (required).

Optional fields on any entry: `at` (anchored start, minutes after the plan
start, 0–1439), `locked` (kept by "Fill around these blocks"; requires `at`),
`along` (runs alongside the nearest preceding routine block, for the other
child; activity/custom/routine with `who` c1/c2, two-child plans only). Nap
only: `settle` (minutes the parent expects to spend settling; an estimate) or
`holding` (parent stays with the sleeping child). Neither = unknown = treated
as busy.

`structureIssues()` enforces cross-entry rules (alongside entries follow a
routine block for the other child; c2 only with two children). `migratePlan()`
reads v1 (unchanged entries; v1 custom text is never reinterpreted) and v2;
`isNewerPlan()` detects unknown newer versions. Field order matches v1 so
JSON comparisons (dirty state) stay stable.

In two-child plans a single `activity` carries `who`. Outside a routine's
alongside track it is reported (`uncovered`) because the other child has
nothing planned.

## 4. Layout and analysis (`src/lib/layout.ts`)

- Main sequence: entries in array order; an entry without `at` starts when the
  previous main entry (and anything alongside it) ends; an entry with `at`
  stays put. Anything that runs into an anchored entry is an `overlap` conflict
  with local repairs: shorten, move after, shift the anchor (explicit), remove.
  Routines never drift because something earlier changed.
- Alongside track: starts at the host's start plus `settle` (nap), runs in
  order, never advances the main sequence until the next main entry. Overrun
  past the host → `along-overrun`.
- Adult state during a routine: nap → busy until `settle` ends, then free
  (holding or unknown → busy all through); milk feed → busy; meal/snack →
  undivided. `alongFeasible()` (one adult): routines need a free adult; custom
  entries get a caution unless free; activities need indoors/not an outing, no
  undivided state, and when busy must be busy-nearby compatible. Two adults:
  anything except two-adult activities.
- `analyzePlan()` returns per entry: layout, `child`, timing assessment, time-of-
  day issue (sun/night), conflicts; plus gaps (`all`, or a child's gap during the
  other child's routine with the adult state), union `busy`, `open`, `overrun`,
  `end`, and per-child events. Every surface uses this; none computes its own.
- Plans can cross midnight: offsets are linear, clocks wrap at display time.

## 5. Formats and compatibility

| Format | v1 | v2 |
|---|---|---|
| Plan object | `v: 1` | `v: 2` (superset) |
| `trunk.plans` envelope | `{version: 1, plans}` | `{version: 2, plans}`; v1 data copied once to `trunk.plans.v1` before the first v2 write; v1/v0 read and migrated in place; newer → read-only |
| `trunk.draft` (session) | `{plan, snapshot}` with v1 plan | same shape; both plan and snapshot migrated with `migratePlan` so a clean draft stays clean |
| Share link | `#/s/1z.…` | `#/s/2z.…` (v1 links still decode) |
| Plan file | `{trunkPlan: 1, plan}` | `{trunkPlan: 2, plan}` (v1 files still open) |
| Prefs | `v: 1` | unchanged unless needed; momentary timing never stored |

Shares keep privacy defaults (generic child labels, no title/custom text/notes
without opt-in) and never include momentary context. Routine blocks, `who`,
`at`, `locked`, `along`, `settle`, `holding` round-trip. Size/decompression
limits and the image/JSON fallback stay.

## 6. Planner expectations

Deterministic and bounded. "Fill around these blocks" keeps routine blocks,
locked entries, and custom entries (pinned where they are), and fills the gaps
of the main sequence plus alongside tracks where adult and space allow. A
phase-aware choice per gap considers the previous and next routine events for
each child (look-ahead, not reordering afterwards): active play earlier,
settling/low-mess/low-setup toward a known nap, gentle first after waking,
applicable `avoid` rules never auto-suggested, food activities never
auto-added, outings/media limits and sun/night rules kept, fewer abrupt
indoor/outdoor switches and microactivities. It never invents a routine block
or infers a nap because the window ends.

## 7. UI expectations

Cues: show only the one relevant cue per card/row (`assessment.cue`), with an
expandable reason and claims. Conflicts: short message plus the repairs as
buttons; never silently remove a parent's entry. Unknown context produces no
reassurance.
