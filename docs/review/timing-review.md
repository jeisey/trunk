# Independent review: timing, routines, and format v2

Reviewer: independent agent (agent review, **not** clinician approval). Date: 2026-10-29.
Branch `claude/admiring-ptolemy-60r1t0` at `bc51e30` plus uncommitted UI work. UI files
(`src/components/*`, `src/App.tsx`, `src/styles.css`, `src/export/*`, `e2e/*`) were out of
scope and not reviewed; where a library bug reaches the screen through one of them, the
caller is named but not assessed. No code or content was changed.

## Summary

The source work is careful and honest. All four cited pages say what the claims say, the
locators are right, the spit-up rule is scoped to babies with a condition and stays
advisory, the nap rules are labelled editorial, and the NHS bedtime advice is kept to
bedtime. Classification is consistent with steps, noise and mess. The v1 fixtures are
byte-for-byte what the v1 encoder (`b9cec90`) produces, migration keeps every field and
timeline position, and the planner held its invariants across 1,500 random plans.

The problems are in how momentary context and alongside tracks reach the evaluator,
and in one note that reassures where nothing was checked:

- **1 blocker:** the sequence note "Kept clear of the meal" appears on tummy time placed
  *immediately* after a meal or snack block.
- **6 majors:**
  - "Nap soon" is modelled as a 1-minute nap, which produces "after waking" cues before
    the child has napped.
  - "Nap soon" with no time puts the nap at the end of the window.
  - Overlaps within an alongside track are never reported.
  - Removing a nap block can leave a plan that can't be saved and is dropped on reload.
  - An old v1 tab can silently overwrite the v2 store.
  - Unknown nap availability fills the whole nap with parallel play, while a known
    settling time leaves those minutes open.

Checks run: `npx vitest run` (226 passed), `npx tsc --noEmit` (clean),
`node scripts/build-catalog.ts --check` (valid; 4 unused-claim warnings). Scratch
reproductions are in
`/tmp/claude-0/-home-user-trunk/7ea7985d-3db8-5064-9e3a-ea60d5466971/scratchpad/s/` (`t1.ts`–`t17.ts`,
run with `node --no-warnings <file>`; `load.ts` builds the real catalog from `content/`).

---

## Blocker

### B1. "Kept clear of the meal" on tummy time right after a meal (false reassurance)

- **Where:** `src/lib/sequence.ts:40-59` (`feedSensitive`) and `:71-82`. It is rendered by
  the plan editor (`PlanEditor.tsx` calls `sequenceNote`).
- **Scenario** (`t9.ts`): a 7-month-old has a Meal block from 0 to 20 min, then
  *Tummy time reach and play* starts at 20. The row says **"Kept clear of the meal"**. The
  same happens with a 10-minute Snack and tummy time starting at minute 10. The note also
  appears for 3–5-month-olds, where the meal block already carries a "not for under 6
  months" caution.
- **Why it's wrong:** `feedSensitive` asks whether the activity has *any* avoid rule keyed
  to `milk-feed` or `meal`. Then it takes the nearest earlier `milk-feed` **or** `meal`
  event, and claims the entry was kept clear of it. Trunk has no meal rules. So
  `timing.avoid` is false after a meal, and the note certifies a placement that nothing
  checked. It contradicts the AAP ("postponing it for a while after meals") and the HSE
  ("avoid tummy time just before or after a feed"). It also breaks the contract
  ("unknown = not cleared"; "never label anything safe after feeding").
- **Fix:**
  - Only consider events whose type matches an in-scope, non-conditional avoid rule the
    activity actually carries.
  - Only say "kept clear" when the entry lies outside that rule's window.
  - Never emit "Kept clear of the meal" while no meal rule exists.
  - Add a regression test: meal block, then tummy time at +0 gives no note.
  - Separately, decide whether a meal or snack block for a child under 12 months should
    count as a feed for the HSE tummy rules (see m5).

## Major

### M1. "Nap soon" is modelled as a 1-minute nap, so "after waking" cues appear before the nap

- **Where:** `src/lib/timing.ts:245` emits `{ event: 'nap', start: napIn, end: napIn + 1 }`.
  The planner uses an unknown end instead (`src/lib/planner.ts:190-209`,
  `NAP_UNKNOWN_END`), so the evaluator's two callers disagree. `App.tsx:205-208` passes
  `momentTiming` to `analyzePlan` as `extra`, so the plan editor inherits the finder's
  model.
- **Finder** (`t2.ts`):
  - With "Nap soon: in about 15 min", ideas that run past minute 16 get **"Gentle start
    after waking"**, a good-tone cue worth +10. Examples:
    - *Narrated stroller walk* at 6 months.
    - *Big box car or house* at 2 years.
    - *Draw and tell* at 4 years.
  - These rank level with settling ideas, ahead of short gentle ones.
  - Lively ideas are penalised twice (−20).
- **Plan editor** (`t10.ts`): a toddler plan made with "Nap soon: in about 30 min"
  contains
  - *Freeze dance* at 30–36, cued **"Ease in after waking"**;
  - *Sock basket helper* at 36–44, cued **"Gentle start after waking"**.

  So the plan offers loud dancing at the nap time and implies a 1-minute nap. The
  planner also fills straight past the stated nap time. It only adds the note "The nap
  isn't in the plan…".
- **Fix:**
  - In `momentTiming`, give the nap no end (or skip `after` rules for momentary naps), to
    match `withMoments`.
  - In the planner, end the fillable window at a known `napIn`. The time after it can
    stay open, and the existing note explains why. Alternatively, rank anything that
    crosses `napIn` as a concern.
  - Add a test: with `napIn` set, no `nap/after` finding appears anywhere.

### M2. "Nap soon" without a time places the nap at the end of the window

- **Where:** `src/lib/planner.ts:340` (`withMoments(..., gaps[0]?.end ?? window)`) and
  `:205`.
- **Scenario** (`t14.ts`): a 28-month-old, a 180-minute window, "Nap soon (right after
  this)".
  - The planner assumes the nap is at minute 180.
  - It schedules a 32-minute walk, a parade, a ball game, freeze dance and water play in
    the first 105 minutes. Each is "Active play while there's time".
  - It winds down only at 143–180.
  - No note says where it put the nap.
- **Why it matters:** the parent said the nap is *soon*. Taking the nap time from the
  window's end is what the brief rules out ("never infers a nap because the window
  ends"). Since `napNext` is forced off in `analyzePlan`, the editor then shows no nap
  cue at all.
- **Fix:** with no time, either
  - use the finder's meaning ("right after the next entry"): rank calm options first and
    don't apply "earlier on" active-play bonuses; or
  - ask for a time, or cap the plan, and add a note saying what was assumed.

  Never place it at the end of a long window.

### M3. Overlaps inside an alongside track are never reported

- **Where:**
  - `src/lib/layout.ts:181-185`: an alongside entry with `at` keeps its time and doesn't
    push its neighbours.
  - `:324-357`: the overlap check runs over main-sequence entries only.
  - `src/lib/planEdit.ts:89-95`: `addRoutine` inserts an alongside routine at the parent's
    clock time without looking at the track.
- **Scenario** (`t3.ts` case 1, `t17.ts`):
  - The baby naps from 0 to 90 (settle 0) and the toddler does a puzzle alongside from 0
    to 17.
  - The parent adds a toddler snack at 12:05. `addRoutine` places it alongside at 5–20.
  - Result: the toddler is in a puzzle and a snack at once, and **no conflict is
    reported**.
  - The gap list says the toddler is covered from 20 to 90.
  - The same happens with the starter `plan.baby-nap-toddler-alongside` once a settling
    time is set.
- **Fix:** run the same "runs into an anchored entry" check per alongside track, with the
  same repairs (shorten, move after, shift, remove). Optionally, have `addRoutine` place
  the block after whatever it would overlap, or warn.

### M4. Removing a nap block with a locked alongside entry makes the plan unsaveable

- **Where:** `src/lib/planEdit.ts:187-205` (`removeEntry` strips `along` and `at` from
  the host's alongside entries but keeps `locked`). `src/lib/plan.ts:88`:
  `locked` requires `at`.
- **Scenario** (`t3.ts` case 3): lock the toddler's activity alongside the baby's nap,
  then remove the nap.
  - The entry still has `locked: true` but no `at`, so `Plan.safeParse` fails ("locked
    entries are anchored") and `migratePlan` returns null.
  - `PlanStore.save` then refuses the plan ("invalid data").
  - `readDraft` returns null, so the session draft is silently dropped on the next
    reload.
- **Fix:** in `removeEntry`, also drop `locked` (or keep `at` for locked entries). Add a
  test that every `planEdit` operation returns a plan that passes `Plan.safeParse`; a
  property test over random edit sequences would catch this class of bug.

### M5. An old v1 tab still open after the deploy can silently overwrite the v2 store

- **Where:**
  - In the v1 build (`git show b9cec90:src/lib/storage.ts`, `sync()`):
    `if (!env || env === 'newer') return;` keeps the stale in-memory list and does not
    switch to read-only.
  - The v2 side, `src/lib/storage.ts:186-211`, accepts the downgraded envelope without
    question.
- **Scenario** (`t16.ts`, the real v1 `PlanStore` and the v2 `PlanStore` on one
  storage):
  1. The old tab loads 4 v1 plans.
  2. The new tab saves a v2 plan with a nap block: the store is now
     `{version: 2, plans: 5}`.
  3. The old tab saves an edit: `ok: true`, and the store is now `{version: 1, plans: 4}`.
  4. The new tab's refresh no longer has the v2 plan.
  5. Neither `trunk.plans.backup` nor `trunk.plans.v1` holds it.
- **Why it matters:** shipped v1 code can't be fixed, so v2 has to defend itself. "Two
  tabs across a deploy" is common for a static site that is left open.
- **Fix** (pick one):
  - Make a v2-only key the source of truth (for example `trunk.plans.v2`, mirrored to
    `trunk.plans` only for reading); or
  - in `sync()`, detect a downgrade (stored version < 2 after this tab wrote v2). Then
    back up the tab's in-memory plans (for example to `trunk.plans.backup` or a
    dedicated key), merge by id, and tell the parent. Add a test using the real v1
    `PlanStore` source as a fixture.

### M6. Unknown nap availability fills the whole nap with parallel play

- **Where:**
  - `src/lib/layout.ts:113-119`: unknown counts as `busy`.
  - `:136-168`: `busy` allows busy-nearby activities.
  - `src/lib/planner.ts:586`: the alongside track starts at the nap's start when `settle`
    is unknown, and at start + settle when it is known.
  - `content/workstreams/mix.json:3073`: `plan.baby-nap-toddler-alongside` starts the
    toddler's colour sort at the same minute as the nap.
- **Scenario** (`t6.ts` c and d, toddler plus baby, one adult):
  - With **settling = 10**, nothing is planned for the toddler during those 10 minutes.
  - With settling **unknown**, the planner fills every minute from the nap's start with
    "busy nearby" ideas: wipe the table, colour sort, pretend kitchen with real pots.
- **Why it matters:**
  - Giving Trunk *less* information produces *more* parallel play.
  - "Busy nearby" means the adult watches from the same room (`watches` + `same-room`).
    Settling a baby often happens in another room, and Trunk doesn't know where.
  - The brief says unknown availability "must not fabricate parallel play".
  - Decision 37 chose "busy", so this needs a product-owner call rather than a quiet
    code change.
- **Suggested fix:** treat unknown as "not available" for auto-fill: leave the nap's
  alongside track open and show the existing note ("Add your settling time to Child 2's
  nap…"). Keep busy-nearby for `holding` (the parent is with the sleeping child) and for
  milk feeds. Update the starter so the toddler's first alongside entry starts after an
  example settling time, or set `settle` on it.

## Minor

- **m1. A gap's adult state is taken at the gap's start only.** `src/lib/layout.ts:382-384`.
  A nap with settle 15 and nothing alongside reports one gap, 0–60, as "busy" (`t5.ts`
  case 8). Split gaps at `start + settle`.
- **m2. Out-of-order anchors give a bogus conflict and gap.**
  `src/lib/planEdit.ts:162-180` (`moveEntry`) can put a later anchored entry before an
  earlier one: Snack at 120 moved above Nap at 30 (`t3.ts` case 2). The layout then
  reports "Snack runs 105 min into Nap", offers "Move Nap 105 min later", and lists an
  "all" gap from 0 to 120 that hides the nap. Re-sort anchored groups after a move (as
  `placeAnchored` does), or block moving an anchored entry past another.
- **m3. The overlap message is wrong with two adults.** `src/lib/layout.ts:354` says
  "one adult can't do both" even when `adults === 2`. Two overlapping one-child
  routines (`t5.ts` case 6) get only a "shift" repair, with no "run it alongside" option.
- **m4. Mixed messages on one row.** `src/lib/sequence.ts:99-103` shows "Active play
  while there's time" on *Pots and wooden spoon band* right after a 9-month-old's milk
  feed, while the same row's cue says "Spits up? Keep play calm after a feed"
  (`t9.ts`). Suppress the active-play note when the entry has any caution finding.
- **m5. Meal blocks for babies aren't feeds.** `routineEvent` maps meal and snack to
  `meal`, and the HSE tummy rules and the AAP spit-up rule are keyed to `milk-feed` only.
  So a 6–12-month-old's Meal block never keeps tummy time away (`t6.ts` b: tummy time
  26 minutes after a solids meal with no cue). The finder's "Just fed" emits both events,
  so the two paths disagree. Research open question 1 covers spit-up only; extend it to
  the tummy rules.
- **m6. One step suggests tummy time with no feed rule attached.**
  `content/workstreams/b.json:1898` (`act.supported-sit-lap-play`, 4–7 months) says "lay
  them on the floor on their back or tummy". The record has no feed rules, so the step
  suggests tummy time that can be scheduled straight after a feed. Say "on their back"
  or add "(tummy if it's been a while since a feed)".
- **m7. Rituals and helper jobs repeat or land in odd places.** *Whisper bye-bye to the
  toys* is placed first in a plan, and twice in 20 minutes (`t10.ts`, `t14.ts`). For
  12–14 months the only settling records are the three new ones, so they cycle. *Carry
  to the table* (a pre-meal job, `content/workstreams/e.json:1422`) is placed right
  before a nap. Consider a once-per-plan flag for ritual records and keeping
  "before a meal" jobs out of the planner.
- **m8. Some offered repairs can't work.** `src/lib/layout.ts:371` offers "Swap for
  something that fits" on an alongside *routine*, but `optionsForSlot` returns `[]` for
  routines (`src/lib/planner.ts:771`). Alongside-overrun on a routine offers only
  "Remove". Offer "Move after the nap/feed" (shift) instead.
- **m9. Recipe stimulation is unchecked.**
  - The validator has no rule tying a recipe's shared stimulation to its roles. The
    activity rule (loud or very messy means lively) isn't mirrored; three walk recipes
    are knowingly gentle with a lively role.
  - `phaseScore` uses the recipe's *shared* stimulation for both children, so a
    toddler's lively role in those walks is scored as gentle (the evaluator still
    penalises it).
- **m10. A time before the plan's start wraps to the next day.** `offsetForClock`
  (`src/lib/planEdit.ts:32`) maps such a time to about +23 h. `addRoutine` then places
  the block far past the 720-minute window maximum, with no warning. Reject or clamp
  offsets beyond the window, or ask whether the time is "tomorrow".
- **m11. The legacy copy is best effort, and silently so.** `src/lib/storage.ts:168-178`:
  if writing `trunk.plans.v1` hits the quota, the first v2 write still overwrites the v1
  text. That only matters for a rollback, but the policy reads as a guarantee. Either
  skip the v2 write when the copy fails, or report it.
- **m12. Migrated v1 plans gain confusing cautions.** The v1 two-child fixture's custom
  "Nap" (Child 1) now shows "Child 2 has nothing planned during this. Put it alongside
  Child 2's nap or feed…" (`t13.ts`). Not wrong, but the remedy doesn't fit a nap. For
  custom entries, consider "Turn this into a nap/feed block?" (without reinterpreting
  the text), or quieter wording.

## Notes

- **n1.** Claim texts stay close to the source wording.
  - `clm.core.hse-not-around-feeds` (`content/core.json:302`) keeps 14 of the source's 16
    words.
  - The AAP's "Keep mealtimes calm. Limit active play for about 20 to 30 minutes
    afterward" appears near-verbatim in `clm.core.aap-spit-up-limit-active-play`
    (`:313`).

  Both are short and attributed, but content policy asks for original words.
- **n2.** The Irish HSE tummy-feed advice is applied to everyone as a non-advisory
  `avoid`, although the US source (AAP) is narrower (babies who spit up). The rule's
  reason names HSE (Ireland), and this is the conservative choice. Record it as a
  deliberate exception to "default to US guidance" in `docs/content-policy.md`.
- **n3.** `plan.baby-nap-toddler-alongside` (`content/workstreams/mix.json:3073`) shows
  a 45-minute nap at 13:15 while saying "Trunk never sets nap times or lengths". The
  wording is acceptable. "The nap time and length here are placeholders" would be
  clearer.
- **n4.** One cue on a pairing doesn't say which child it is for (for example "Not
  right after a feed" for the baby). `TimingFinding.child` is available; showing "Baby:"
  or "Child 2:" would help.
- **n5.** `readDraft` reads a draft from a newer version as null. The caller can then
  overwrite it within the tab. This is an edge case (rollback in the same tab).
- **n6.** Pre-existing and not part of this refinement: the planner can place an
  8-minute playground outing (*Bucket swing*) and then indoor play a minute later.
  Travel time is not modelled.
- **n7.** Two wording points:
  - The wind-down reason ("…applying this to naps is Trunk's preference") is slightly
    ambiguous: HSE's story advice already concerns naps. "Using NHS bedtime advice for
    naps, and the 30 minutes, are Trunk's choices" is clearer.
  - "Lay them on their back in their own sleep space" on records running to 36 months
    over-specifies infant safe-sleep advice for toddlers. It is harmless.

## Verified and sound

**Sources** (all four opened with WebFetch on 2026-10-29):

- **AAP *Why Babies Spit Up*:**
  - "Limit active play for about 20 to 30 minutes afterward" sits under "My baby spits up
    when you bounce them or play with them after meals".
  - The tummy-time postponement sits under the third tip ("Limit active play after meals
    and hold your baby upright").
  - The page is filed under Baby (0–12 mos.) and says nothing about toddlers or solid
    meals.
  - The claims, locators, `window.basis: source` (with "Trunk uses 30"), the 1w–12m
    scope and `condition: spit-up` are all honest.
- **HSE *Tummy time*:** the feed advice is the last paragraph of "When to start", with
  no minutes. Both rules say the 15- and 30-minute windows are Trunk's.
- **HSE *Naps*:** list items 1, 3, 5 and 6 match the locators. The scheduling content
  (nap counts, 3.30 pm, "how long awake") is unused.
- **NHS *Helping your baby to sleep*:** the wind-down passage is about bedtime, and the
  page's daytime advice limits it. The claim and the reason both say so.

**Content wording and classification:**

- No cue or reason promises sleep, uses wake windows, or says "safe after feeding".
- The spit-up rule is listed on exactly 12 infant records (6 tummy-time, 5 lively,
  1 crawling). No record starting at 12 months or later carries it: the validator's
  age-overlap check covers listing, and `inScope` in the evaluator covers 12–18-month
  children on 7m–18m records.
- **Classification sample** (35 activities across all bands, all 3 `variable`, 12
  recipes): profiles match steps, noise and mess. Judgment calls such as *Bucket swing*
  (lively) and *Free explore* (gentle with spit-up) are documented and defensible. No
  bouncing instructions exist anywhere in the content.
- **New settling records:**
  - All are quiet, with no mess, and make no sleep promise.
  - They have appropriate safety notes (awake adult, back to sleep, sill and cords, a
    comforter only from 12 months).
  - Their evidence is honestly "adapted".
  - They are not duplicates: *Home tour in arms* is 1w–4m and gentle; *Take-turns story*
    is 36m+.
- **Starter plans:** all 7 analyse without conflicts or cues in both child orders. The
  reorder arithmetic in `docs/research/timing.md` is correct (33, 32 and 35 minutes).

**Evaluator and layout** (scratch scripts plus reading):

- Touching intervals don't overlap.
- After-windows run from the feed's end, before-windows from its start, and a break in
  between doesn't reset them.
- Tidy-up counts only before an event; setup is ignored for after-windows.
- With Child 2 the younger, roles go to the right child, and a toddler's meal never
  triggers the baby's tummy rules.
- Meals with one adult flag alongside play; alongside overrun is reported.
- Busy time is the union of intervals; midnight crossing works with linear offsets and
  wrapped clocks.
- Advisory rules never set `avoid`; `variable` gives no profile cue.

**Planner** (1,500 random plans, `t12.ts`):

- No generated entry has an applicable avoid, a hard conflict, a time-of-day issue, or a
  food hazard.
- Routine counts never change.
- Output is deterministic for a seed.
- The only violations found were the M1 "after waking" cues.

**Share and fillAround** (3,000 random compact plans, `t11.ts`): no crashes or
unexpected errors, and every import and every `fillAround` result passes `Plan`.

**Compatibility:**

- All three v1 links and the v1 plan file re-encode byte-identically with the `b9cec90`
  encoder (`v1check.mjs`). The note in the fixture names `af243cb`, whose encoder is
  identical apart from a throwing `routine` case.
- The v1 saved-plan and draft fixtures parse with the v1 schema in canonical key order.
- Migration keeps the JSON identical apart from `v`, and keeps v1 timeline positions
  (`t15.ts`).
- The draft opens clean.
- `trunk.plans.v1` is written once and never overwritten.
- Newer envelopes or plans switch to read-only, and newer links and files get a clear
  error.
- Privacy defaults hold in v2: no title, custom text, notes, segment notes, readiness, or
  momentary context.
