# Mixed-age workstream: research and feasibility notes

Owner files: `content/workstreams/mix.json` and this document.
Sources opened on 2026-10-28; recipes and plans checked against their claims on 2026-10-29.
No clinician has reviewed this content. Durations, setup times and effort levels are editorial estimates.

## Summary

- **29 curated recipes:** 16 `together` and 13 `parallel`. Every parallel recipe uses `minAdults: 1` and passes `checkParallel` in the validator.
- **4-month-old + 28-month-old:** 6 recipes fit this pair (4 together, 2 parallel).
- **1 new canonical activity:** `act.held-slow-dance` (4–12 months). It fills a gap: A's `act.sway-and-hum` ends at 4m, and no B/C record covers held, slow music-and-movement.
- **6 starter plans:** 4 for one child, 2 for two children.
- **New sources and claims:** 3 sources and 6 `clm.mix.*` claims. Everything else reuses claims from core and A–F.
- **Checks:** `node scripts/build-catalog.ts --check --only content/workstreams/mix.json` exits 0 with no warnings for this file. In the full build, every sampled pair has 2 or more recipes, and the coverage report lists no gaps.

## Sources consulted (new)

| ID | Org / jurisdiction | Date shown | Used for |
|---|---|---|---|
| `src.healthdirect.toddler-and-new-baby` | Pregnancy, Birth and Baby (Healthdirect Australia, funded by the Australian Government) / AU | reviewed May 2025 | Never leave a toddler alone with a baby. Toddler helper jobs. Gentle open-palm touch. Keeping a toddler busy nearby during feeds. |
| `src.aap-hc.preparing-family-new-baby` | AAP HealthyChildren / US | updated 2026-02-10 | Invite preschoolers to help. Remind them to be gentle. Special time for reading and music. Cuddling beside you during feeds. |
| `src.aap-hc.siblings-while-breastfeeding` | AAP HealthyChildren / US | updated 2009-11-02 (old) | An older child can draw, play, listen to stories or music, or do a small job nearby during feeds. |

Re-read existing source:

- `src.aap-hc.simple-ways-entertain` (AAP Retro Baby list, updated 2023-07-27). Its "4 to 6 months" section is the basis for the new claim `clm.mix.rock-side-to-side-4-6m`.

Searched but not used:

- No AAP, NHS or HSE page states a general rule against leaving a baby alone with a young sibling. AAP's rules cover water ("never in the care of another young child") and babysitting by siblings. I used the Australian government-funded page for the general rule and named its jurisdiction in the claim.

## Claim-to-passage map (new claims)

| Claim | Kind | Passage | Notes |
|---|---|---|---|
| `clm.mix.never-leave-toddler-with-baby` | safety | Healthdirect: "never leave them alone together"; it names food-sharing choking and rocking the pram until it tips | Applied to every recipe. Trunk's wording: the older child is a playmate, never in charge. |
| `clm.mix.toddler-small-jobs` | description | Healthdirect: give a small job such as fetching a nappy or wipes. AAP: "find ways to invite your child to help" (preschoolers) | Jobs mean fetching or passing things to the adult, never handling the baby. |
| `clm.mix.gentle-open-palm` | recommendation | Healthdirect: show the toddler how to stroke gently with the palm. AAP: remind preschoolers to be gentle | Trunk allows open-palm touches only with the adult's hand right there. The tummy-time recipes allow no touching at all. |
| `clm.mix.busy-nearby-during-feeds` | description | Healthdirect: during feeds, a story, or blocks, drawing or dolls near you. AAP (2009): drawing, a toy, music, stories, folding laundry nearby | Applied to holding and settling, not only feeds (stated in the caveat). |
| `clm.mix.special-time-older-child` | recommendation | AAP preschoolers section: special time for reading, games, music or talking; cuddling beside you during feedings | Supports the shared book and music recipes. |
| `clm.mix.rock-side-to-side-4-6m` | description | AAP Simple Ways, "4 to 6 months": hold the baby tummy-down on your chest, rock side to side, sing | The caveat notes that the page's 7–9-month ideas include bouncing, which Trunk excludes. |

Reused claims are cited where their passage applies. For example:

- `clm.core.young-child-joins-tummy-time` supports both tummy-time recipes.
- `clm.c.older-sibling-small-things`, `clm.d.older-siblings-small-objects` and `clm.f.small-pieces-away-from-babies` cover older children handing things to babies.
- `clm.e.seated-eating` and `clm.e.high-risk-foods-under-4` support the snack recipe.
- `clm.d.pedestrian-safety` supports the walks.

## New activity: `act.held-slow-dance` (4m–12m)

- **Record:** held (`leads/holding/continuous`), shareable like `act.sway-and-hum`, indoors, hazard `falls`. Evidence `adapted` from `clm.mix.rock-side-to-side-4-6m`, `clm.a.rock-sway-sing-calms`, `clm.a.sing-rhymes` and `clm.a.cuddle-hold-secure`.
- **Steps:** slow, smooth swaying with head and neck supported as needed. The instruction text avoids words that suggest rough handling.
- **Safety notes:** never shake a baby; watch your step; no hot drinks; asleep means onto the back in their own sleep space; rock in a chair only while awake.
- **Why it ends at 12m:** AAP's ideas for older babies move to bouncing and lifting games, which Trunk does not use. The lead may cap it lower.

## How the one-adult check was applied

The validator's `checkParallel` is necessary but not sufficient, so for every recipe I also set out:

- **Space:** where each child is.
- **Adult's eyes and hands:** where they go.
- **Older child's materials:** what they could hand or drop to a younger child.

Under-3 younger roles never pair with an older activity that carries the `small-parts` hazard; the validator enforces this. For records not tagged `small-parts` (E's playdough), I avoided babies entirely.

Every recipe's safety notes say the older child is a playmate, never in charge, and that the children are never left alone together.

### Together recipes (16)

| ID | Roles | Who is where; adult's hands and eyes | Why one adult can do it |
|---|---|---|---|
| `mix.tummy-time-book-helper` | 3–8m `act.tummy-time-reach-and-play` + 24–36m `act.who-what-where-book-chat` | Baby tummy-down on a firm floor mat. Toddler sits at the mat's edge facing the baby, holding a board book near the floor. Adult lies or sits beside the baby, within arm's reach, hands free. | One shared floor activity; the adult watches the baby only. The toddler never touches, lifts or leans on the baby. The book stays in the toddler's hands, out of the baby's mouth. 2–10 min; stops at the first fuss. |
| `mix.tummy-time-picture-show` | 3–8m tummy reach + 36–60m `act.what-happens-next-book` | Same layout; the preschooler "reads" the pictures. | As above. Story props stay away (`clm.f.small-pieces-away-from-babies`). |
| `mix.newborn-sway-toddler-dance` | 1w–4m `act.sway-and-hum` + 15–30m `act.freeze-dance-toddler` | Adult holds the newborn upright with head and neck supported, swaying slowly. Toddler dances in a cleared patch at least an arm's length in front. Music starts before the adult picks up the baby. | Hands: baby only. The adult runs the freeze game by voice. Collision plan: the toddler's patch is in front, never behind or underfoot, and the adult turns a shoulder to shield the baby if the toddler runs in. |
| `mix.slow-dance-follow-the-leader` | 4–12m `act.held-slow-dance` + 24–36m `act.follow-the-leader-parade` | Toddler leads a parade along a cleared loop with no stairs. Adult follows with the baby held, copying moves as a slow sway or small steps. | The adult never hops, jumps or runs while holding the baby. The toddler stays in front, in view. |
| `mix.newborn-stroll-toddler-walks` | 1w–4m `act.stroller-stroll-point-and-name` + 18–30m `act.toddler-led-walk` | One hand on the stroller, the other holding the toddler's hand near roads, driveways and crossings. | Traffic means `together` only, with the adult's full attention. Short route on sidewalks or paths. The toddler never pushes or rocks the stroller (Healthdirect pram-tip warning). Sun rule for babies under 6 months. |
| `mix.shaded-walk-nature-find` | 4–6m `act.shaded-stroller-walk` + 24–36m `act.nature-find-walk` | Same, plus brake on at each find. Finds stay in the toddler's bag, never in the stroller. | Same traffic reasoning, plus no leaves, sticks or stones reaching a mouthing baby. |
| `mix.stroller-walk-toddler-hunt` | 6–18m `act.narrated-stroller-walk` + 24–36m nature find | Same layout. `handsOnFor: both` because pushing the stroller is continuous. | Same. |
| `mix.newborn-story-big-kid-reader` | 1w–4m `act.read-aloud-anything` + 36–60m what-happens-next book | Adult on the sofa holding the baby. Preschooler beside the adult, not on them. | Hands: baby. The adult must stay awake (sofa sleep risk). No hot drinks. |
| `mix.baby-book-big-kid-story` | 6–12m `act.point-and-name-books` + 36–60m what-happens-next book | Baby in the adult's lap with their own board book. Preschooler beside the adult with theirs. | The baby has their own book, so props never cross over. |
| `mix.action-song-circle` | 4–8m `act.body-part-action-song` + 15–30m `act.toddler-action-songs` | Baby supported in the adult's lap. Toddler an arm's length in front, facing them. | Hands guide the baby gently. The toddler does the actions on themself; no clapping on the baby. |
| `mix.diaper-change-helper` | 1w–4m `act.diaper-change-chat` + 15–30m `act.sock-basket-helper` | Change on a floor mat with a hand on the baby throughout. Toddler at the baby's feet end fetches the diaper and wipes, then sorts socks. | Not shareable as parallel (the diaper change is `shareable: false`), so it is `together`. Supported by the Healthdirect helper-job passage. Sacks and creams out of reach. |
| `mix.two-toddlers-freeze-dance` | 12–30m + 12–30m `act.freeze-dance-toddler` | Each toddler in their own spot. Adult runs the music. | Close ages; one game. Separate spots prevent collisions. |
| `mix.big-kid-leads-toddler-copies` | 12–30m freeze dance + 36–60m `act.copycat-moves` | Preschooler leads; toddler copies. Adult runs the music and keeps moves toddler-sized. | Floor-level moves only; no jumping off furniture. |
| `mix.opposites-parade` | 24–36m follow-the-leader + 36–60m `act.big-small-opposites-game` | Line order: preschooler, toddler, adult at the back. | Clear path away from stairs and the street. |
| `mix.seated-snack-for-two` | 12–60m + 12–60m `act.sit-down-snack-together` (both `eats-solids`) | Both seated (high chair strapped, or chair or bench). Adult seated within arm's reach of both. | Food is undivided attention, so this is `together` only. The adult prepares and hands out all food. The older child passes napkins or cups, never food (AAP: siblings sharing food is a common cause of choking). Screens off; allergies named. |
| `mix.playground-stroller-spotting` | 6–18m narrated stroller + 36–60m `act.preschool-playground` (`climbs`) | Stroller braked in shade within the adult's reach. Adult stands between the stroller and **low** preschool equipment, within arm's reach of the climber. The adult moves the stroller before the child moves to the next piece. | **Restricted, not rejected.** One adult cannot spot tall equipment or monkey bars and mind a baby at once; the adapt line says save those for a trip with a second adult. A stroller is used rather than a carrier so the adult's arms and torso stay free to spot. The rule: if the baby needs you, the climber comes down. |

### Parallel recipes (13; all `minAdults: 1`, all pass `checkParallel`)

| ID | Younger track (supervision) | Older track (supervision) | Space and adult; why it is safe |
|---|---|---|---|
| `mix.mat-and-table-side-by-side` | 4–7m `act.toe-catch-back-play` (watches / same-room / none) | 15–30m `act.chunky-puzzle-or-sorter` (joins / same-room / intermittent) | Baby on a mat at least an arm's length from a low table. Adult on the floor between them, facing the table. Pieces stay at the table; the toddler stays off the mat. |
| `mix.tummy-time-and-pretend-kitchen` | 3–8m `act.tummy-time-reach-and-play` (joins / arm's reach / none) | 24–48m `act.pretend-kitchen-cook` (watches / same-room / none) | Adult on the floor by the baby, as the customer. The toddler's props stay at a low table a few steps away; dishes are delivered to the adult at the mat's edge. Not in the real kitchen while cooking. |
| `mix.sofa-cuddle-sock-sort` | 1w–4m `act.coo-and-copy-chat` (leads / holding / continuous) | 15–30m `act.sock-basket-helper` (joins / same-room / none) | One continuous track; the other needs no hands. Toddler on the floor at the adult's feet, in view. Adult stays awake; no hot drinks. |
| `mix.newborn-mat-teddy-meal` | 1w–4m `act.play-gym-mat-gazing` (watches / same-room / none) | 15–30m `act.feed-the-teddy` (joins / same-room / intermittent) | Adult sits between the two spots. Teddy and blankets stay off the baby's mat (face clear). Play gym away from cords. |
| `mix.newborn-mat-sock-match` | 1w–4m play-gym mat | 36–60m `act.sock-match-and-sort` (watches / same-room / none) | Adult folds laundry beside the mat. Laundry products locked away. Piles stay off the mat. |
| `mix.play-yard-and-color-sort` | 6–12m `act.play-yard-in-view` (watches / same-room / none) | 24–36m `act.color-sort-bowls` (watches / same-room / none) | Play yard a few steps from the table, so nothing gets passed in. Sorting items pass the toilet-roll test and stay on the table. The adult hands anything in themself. |
| `mix.treasure-basket-and-sock-match` | 6–12m `act.treasure-basket` (watches / arm's reach / none, `sits-independently`) | 36–60m sock match | Adult sits right beside the basket. Preschooler on the sofa or at the table a few steps away. The preschooler's small toys stay away. |
| `mix.blanket-and-red-light` | 6–12m `act.grass-blanket-explore` (joins / arm's reach / intermittent) | 36–60m `act.red-light-green-light` (leads / same-room / none) | The adult's voice runs the game while their hands stay with the baby. The running lane passes beside the blanket, never toward it. Fenced yard or lawn away from the street. Grass checked; shade. |
| `mix.blanket-and-bubbles` | 6–12m grass blanket | 12–30m `act.bubble-pop-outside` (leads / same-room / intermittent) | The adult blows bubbles downwind, away from the baby. Bottle capped on the adult's far side. Neither track is continuous, and only one is arm's reach. |
| `mix.two-toddlers-blocks-and-puzzle` | 12–30m `act.stack-and-topple` | 15–30m chunky puzzle | Two spots a few steps apart, each child with their own set. Adult between them. |
| `mix.toddler-blocks-big-kid-socks` | 12–30m stack and topple | 36–60m sock match | Preschooler sorts on the sofa, away from the towers. The preschooler's small toys stay out of the toddler's reach. |
| `mix.toddler-kitchen-big-kid-memory` | 24–48m pretend kitchen | 36–60m `act.memory-match-cards` (joins / same-room / intermittent) | Cards stay on the table; the toddler's kitchen is on the floor in view. |
| `mix.twin-quiet-table` | 36–60m `act.draw-and-tell` | 36–60m `act.jigsaw-at-the-table` | Both `small-parts`, allowed only because both roles start at 36m. Each child has their own end of the table. Pieces must not reach any younger child at home. |

## The three requested examples

1. **Toddler presents a board book during infant floor tummy time: included and modified.** It became `mix.tummy-time-book-helper` (24–36m helper) and `mix.tummy-time-picture-show` (36–60m helper).
   - Both use core's `act.tummy-time-reach-and-play`: floor, firm and flat surface, `flatSurface: true`, 3–8 months.
   - The adult is on the floor within arm's reach, hands free.
   - The older child sits at the mat's edge and holds the book near the floor; they never touch, lift or lean on the baby.
   - The book stays in the older child's hands, out of the baby's mouth. The baby reaches for their own baby-safe toy.
   - Sessions are 2–10 minutes and stop on baby cues.
   - The tummy-time position is stated exactly. A safety note says this is floor tummy time on a flat surface and counts toward a flat-surface target **only if the baby's clinician set one**; Trunk sets no target.
   - I did not add a newborn version (the 1w–3m face-to-face record) to keep the set lean. Newborn pairs are covered by other recipes.
2. **Caregiver-supported music and movement: included.**
   - Newborns use `mix.newborn-sway-toddler-dance` with A's sway record.
   - 4–12 months use `mix.slow-dance-follow-the-leader` with the new `act.held-slow-dance`.
   - Both say: full head and neck support; slow, smooth swaying; no bouncing, jiggling, swinging or quick turns; cleared space with the older child's dance zone in front of the adult, never underfoot; no stairs.
   - The adult never jumps, hops or runs while holding a baby. If the toddler runs in, the adult turns a shoulder to shield the baby.
3. **Safe adjacent play areas: included** as several parallel recipes:
   - `mix.mat-and-table-side-by-side`: back-play mat plus a toddler at a low table.
   - `mix.play-yard-and-color-sort`: play yard plus table sorting.
   - `mix.tummy-time-and-pretend-kitchen`, `mix.newborn-mat-teddy-meal` and `mix.newborn-mat-sock-match`.
   - Each states the separation (an arm's length or "a few steps"), that the older child's materials stay at their own spot, and where the adult sits to see both.

## Ideas rejected or modified

- **Two climbers at the playground (toddler + preschooler), parallel: rejected.** Both playground records need arm's-reach spotting, which `checkParallel` rejects. It is also unrealistic for one adult.
- **Playground with a baby in a carrier while spotting climbing: rejected.** The adult's arms and torso are not free to spot, and bending with a baby in a carrier is a risk. I found no source supporting it. The stroller version above is restricted to low equipment.
- **Pushing a baby in a bucket swing while a sibling plays: rejected.** The swing needs continuous hands and is not shareable.
- **Toddler or preschooler playdough, drawing or jigsaw near a baby or toddler under 3: rejected.** F's versions carry `small-parts`. E's playdough is tagged `mouthing` rather than `small-parts`, but dough bits are a choking risk for a baby, so I did not pair it with any baby track.
- **Toddler holding the baby on the adult's lap: not adopted.** Healthdirect suggests it; AAP suggests it for school-age children; AAP's breastfeeding page has an older child hold the baby. Trunk's policy is that children never hold, lift or carry babies.
- **Water play, cooking and bath with siblings: excluded.** These are undivided-attention hazards; no recipe uses water or heat.
- **Snack with a baby under 12 months: not possible.** E's snack record starts at 12 months, and no other food record exists for babies.
- **Newborn tummy time with a toddler, chest or lap tummy time with a toddler nearby, peekaboo or ball rolling between baby and toddler, and a twin red-light game:** considered and left out to keep the set focused. The pairs they would cover already have 2 or more recipes.
- **Screen media in recipes:** none. Media appears only in the single-child dinner-prep plan, next to non-screen options.

## Pair coverage (from `reports/coverage.md` after `node scripts/build-catalog.ts`)

| Younger | Older | Together | Parallel |
|---|---|---|---|
| 3 wk | 2 yr | 3 | 2 |
| 6 wk | 3 yr | 1 | 1 |
| 10 wk | 20 mo | 3 | 2 |
| 4 mo | 2 yr 4 mo | 4 | 2 |
| 5 mo | 3 yr 6 mo | 1 | 1 |
| 7 mo | 2 yr 6 mo | 3 | 2 |
| 9 mo | 4 yr | 2 | 2 |
| 11 mo | 2 yr 2 mo | 2 | 2 |
| 14 mo | 3 yr 2 mo | 3 | 1 |
| 18 mo | 3 yr 4 mo | 2 | 1 |
| 20 mo | 4 yr 6 mo | 2 | 1 |
| 2 yr 2 mo | 4 yr 2 mo | 3 | 2 |
| 2 yr 6 mo | 4 yr 10 mo | 2 | 1 |
| 15 mo | 16 mo | 2 | 1 |
| 3 yr 1 mo | 3 yr 1 mo | 1 | 2 |

Every sampled pair has 2 or more recipes. The thinnest pairs are 6 weeks + 3 years and 5 months + 3½ years (one of each mode). Both gaps are structural:

- Most E records (24m–36m) end exactly at 36 months.
- Most baby band records end at 4m or 8m.
- F's quiet table activities carry `small-parts`, so they can't pair with babies.

The 4 m + 28 m recipes are:

- `mix.tummy-time-book-helper`
- `mix.slow-dance-follow-the-leader`
- `mix.shaded-walk-nature-find`
- `mix.action-song-circle`
- `mix.mat-and-table-side-by-side`
- `mix.tummy-time-and-pretend-kitchen`

## Starter plans

Each plan is a sequence of two or more different records plus breaks. Minutes fall inside each record's range, and every record is age-eligible for the preview ages.

1. **`plan.gentle-newborn-hour`** (3 weeks, 09:30). Coo-and-copy chat (4) → feed or nap break (15) → face-to-face floor tummy time (3) → cuddle (5) → bold pictures (3) → feed or sleep break (15) → sway and hum (8) → rest (7). Long, flexible breaks reflect that feeds and sleep come first. Indoors only.
2. **`plan.rainy-afternoon-4m-28m`** (4m + 28m, 15:00). Mat and table (12) → break → tummy-time book helper (5) → feed or cuddle break → action-song circle (6) → break → slow-dance parade (6) → rest. Indoors, so the midday sun rule does not apply.
3. **`plan.park-snack-playdough`** (30m, 10:00). E's 2-to-5 playground area (25) → walk home and wash hands → seated snack (10) → wipe-up → playdough squish and roll (15). Every record exists in E and fits.
4. **`plan.dinner-prep-hour`** (30m, 17:00). Pretend kitchen (15) → check-in break → color sort (10) → **optional** calm show while you cook (20) → carry-to-the-table helper (5).
   - The non-screen options come first.
   - The show record's own note offers a toy or job instead.
   - The preview age is 30 months because E's color-sort and carry-to-the-table records end at 36 months.
   - For a 3–4-year-old, a parent would swap in F's `act.sock-match-and-sort`. A plan has only one preview age, so this can't be encoded.
5. **`plan.saturday-morning-4-year-old`** (48m, 09:30). F preschool playground (30) → walk home → smell the flower, blow the candle (5) → what-happens-next book (10) → sock matching (10). The sequence is active outdoor play, then calm, then an everyday task.
6. **`plan.baby-and-preschooler-9m-4y`** (9m + 48m, 10:00). Treasure basket and sock matching (10) → break → blanket and red light (15) → wash-hands break → two books (8) → nap or feed break.

## Conflicts and jurisdiction differences

- **Children holding babies.** AAP (US) lets school-age children hold the baby after asking. Healthdirect (AU) suggests a toddler can hold the baby on your lap with your help. Trunk is stricter: no child under 5 holds, lifts or carries a baby in any recipe. The claim caveats and source notes record this.
- **"Never leave alone together."** This is stated explicitly by the AU source. US AAP pages say it only for water, plus "don't rely on siblings to babysit". The claim names the jurisdiction.
- **AAP Simple Ways bouncing ideas (7–9 months).** Excluded under Trunk's handling policy.
- **The AAP breastfeeding page is from 2009.** It is used only for low-stakes "keep busy nearby" ideas and is backed by the 2025 Healthdirect page.

## Schema change requests

1. **A recipe-level `ageNote` or "suggested gap" field.** Some recipes (for example `mix.seated-snack-for-two`, 12–60m for both roles) are valid for any two eligible children. A short field could say what changes at the extremes instead of putting it in `adapt`.
2. **A plan-level alternative segment.** The dinner-prep plan would benefit from an "or" (screen or sock-matching) segment, and from a second preview age, so one plan could cover 2–4 years.
3. **Consistent `small-parts` tagging.** E's playdough is tagged `mouthing` while F's is tagged `small-parts`. The validator's sibling rule keys on `small-parts` only. The lead may want to align these or extend the rule to `mouthing` plus `no-longer-mouthing` older tracks.

## Open questions for the lead or reviewer

- **`act.held-slow-dance` (new, 4–12m):** confirm the age span, the `holding` + `shareable: true` choice (mirrors `act.sway-and-hum`), and effort `low`.
- **`mix.playground-stroller-spotting`:** is a restricted together recipe acceptable, or would you rather reject playground trips with a baby for one adult entirely?
- **`mix.seated-snack-for-two`:** both roles span 12–60m. Confirm that one seated adult within arm's reach of both is acceptable for a 12-month-old with a sibling, given E's arm's-reach snack record.
- **`handsOnFor`** is set to the child whose activity the adult's hands serve. Several tracks have `handsOn: none` but the adult stays "hands free, ready" (tummy time). Confirm this reading.
- **Healthdirect and AAP pages were read through the fetch tool's summaries,** not full raw text. The specific passages are recorded in each claim's paraphrase.
