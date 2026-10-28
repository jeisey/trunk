# Workstream D research notes: toddlers 12 to under 24 months

Owner files: `content/workstreams/d.json`, `docs/research/d.md`. Sources checked 2026-10-28.
`node scripts/build-catalog.ts --check --only content/workstreams/d.json` exits 0 with no warnings for this file.

## Summary

- 17 distinct activities. Each one's age range falls mainly inside 12–24 months, and some extend to 30 months.
- 32 claims (`clm.d.*`), 16 new sources, 7 sources reused from other workstreams, and 4 core claims reused.
- No media, food or snack activities. Media belongs to Workstream E. Food was left out on purpose (see "Omitted").
- Activities are source-informed. No clinician has reviewed them. Durations, setup times and effort levels are editorial estimates.

## Method

I opened every page and read it before citing it.

- **Read with `curl` and HTML-to-text:** HealthyChildren.org pages, HSE pages and the CPSC playground handbook PDF.
- **Read through a fetch tool:** cdc.gov, cpsc.gov FAQ pages and zerotothree.org.
  - Direct download from these sites returned HTTP 403 (CDN blocking).
  - The fetch tool returns close paraphrases plus short exact quotes, not the full page text. Each affected source says so in its `notes`.
  - The lead may want to spot-check these passages in a browser.
- Claims use original wording. Paraphrases are summaries, not copies.

## Activities

| ID | Ages | Readiness | Supervision (participation / proximity / hands) | Shareable | Busy-nearby | Hazards | Evidence |
|---|---|---|---|---|---|---|---|
| `act.push-toy-laps` | 12m–24m | pulls-to-stand | watches / same-room / none | yes | **yes** | falls | described |
| `act.big-ball-kick-and-chase` | 15m–30m | walks | joins / same-room / intermittent | yes | no | none | described |
| `act.freeze-dance-toddler` | 12m–30m | none | leads / same-room / none | yes | no | falls | described |
| `act.bubble-pop-outside` | 12m–30m | none | leads / same-room / intermittent | yes | no | mouthing, sun-weather | described |
| `act.toddler-action-songs` | 15m–30m | none | leads / same-room / none | yes | no | none | described |
| `act.where-is-it-picture-book` | 15m–24m | none | leads / holding / intermittent | yes | no | none | described |
| `act.busy-basket-gated-space` | 15m–30m | none | watches / same-room / none | yes | **yes** | none | adapted |
| `act.stack-and-topple` | 12m–30m | none | joins / same-room / intermittent | yes | no | none | described |
| `act.fill-and-dump-relay` | 15m–24m | walks | watches / same-room / none | yes | **yes** | none | described |
| `act.chunky-puzzle-or-sorter` | 15m–30m | none | joins / same-room / intermittent | yes | no | none | described |
| `act.feed-the-teddy` | 15m–30m | none | joins / same-room / intermittent | yes | no | none | described |
| `act.hide-the-toy-hunt` | 12m–24m | none | leads / same-room / none | yes | no | none | described |
| `act.sock-basket-helper` (routine) | 15m–30m | none | joins / same-room / none | yes | no | none | described |
| `act.toddler-led-walk` (outing) | 12m–30m | walks | joins / arms-reach / intermittent | **no** (traffic) | no | traffic, sun-weather, mouthing, falls | described |
| `act.playground-toddler-area` (outing) | 12m–24m | walks | joins / arms-reach / intermittent | yes | no | falls, sun-weather | described |
| `act.water-scoop-tub` | 15m–30m | none | joins / arms-reach / intermittent | **no** (water) | no | water | described |
| `act.over-under-in-out` | 15m–24m | crawls | leads / arms-reach / intermittent | yes | no | falls | described |

### Coordination with Workstream C

Workstream C has baby versions of several ideas that end at 15 or 18 months:

- `act.point-and-name-books`
- `act.ball-roll-turns`
- `act.clap-and-wave-songs`
- `act.splash-and-pour`
- `act.put-in-tip-out`
- `act.cushion-crawl-course`
- `act.safe-space-explore`

To avoid renamed duplicates across workstreams, I made these changes:

- **Start at 15m:** books, songs, water tub, fill-and-dump, over-under and busy basket. These are the toddler versions.
- **Require `walks`:** ball and fill-and-dump. These versions depend on kicking, chasing or carrying.
- **Renamed two of my IDs** that were near-copies of C's IDs:
  - `act.point-and-name-book` is now `act.where-is-it-picture-book`.
  - `act.big-ball-roll-kick` is now `act.big-ball-kick-and-chase`.
  - Neither ID had been referenced anywhere else.
- **Kept `act.push-toy-laps`, `act.playground-toddler-area` and `act.toddler-led-walk` at 12m.** They differ from C's cruising, bucket-swing and stroller-walk records because they need a toddler who pulls to stand or walks.

## Sources consulted

Page date means the date the page shows (published, updated or last reviewed). "fetch" means the page was read through the fetch tool after a 403.

| ID | Org (jurisdiction) | URL | Checked | Page date | Read via |
|---|---|---|---|---|---|
| `src.cdc.milestones-15-months` | CDC (US) | https://www.cdc.gov/act-early/milestones/15-months.html | 2026-10-28 | pub 2025-09-04, updated/reviewed 2026-05-16 | fetch |
| `src.cdc.milestones-18-months` | CDC (US) | https://www.cdc.gov/act-early/milestones/18-months.html | 2026-10-28 | pub 2025-09-04, updated 2026-05-16 | fetch |
| `src.cdc.milestones-2-years` | CDC (US) | https://www.cdc.gov/act-early/milestones/2-years.html | 2026-10-28 | pub 2025-09-04, updated 2026-05-16 | fetch |
| `src.cdc.positive-parenting-toddlers` | CDC (US) | https://www.cdc.gov/child-development/positive-parenting-tips/toddlers-1-2-years.html | 2026-10-28 | 2026-02-20 (shown without a label) | fetch |
| `src.hse.play-1-2-years` | HSE (IE) | https://www.hse.ie/babies-children/play/1-2-years/ | 2026-10-28 | last reviewed 2021-04-20 (review due 2024, overdue) | curl |
| `src.aap-hc.how-active-is-your-toddler` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/ages-stages/toddler/fitness/Pages/The-Active-Toddler.aspx | 2026-10-28 | updated 2026-01-06 | curl |
| `src.aap-hc.power-of-play` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/family-life/power-of-play/Pages/the-power-of-play-how-fun-and-games-help-children-thrive.aspx | 2026-10-28 | updated 2023-05-03 | curl |
| `src.aap-hc.share-books-12-14-months` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/ages-stages/toddler/Pages/How-to-Share-Books-with-Your-12-to-14-Month-Old.aspx | 2026-10-28 | updated 2013-03-27 | curl |
| `src.aap-hc.share-books-15-17-months` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/ages-stages/toddler/Pages/How-to-Share-Books-with-Your-15-to-17-Month-Old.aspx | 2026-10-28 | updated 2013-04-03 | curl |
| `src.aap-hc.share-books-18-23-months` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/ages-stages/toddler/Pages/How-to-Share-Books-with-Your-18-to-23-Month-Old.aspx | 2026-10-28 | updated 2013-03-27 | curl |
| `src.aap-hc.safety-1-to-2-years` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/ages-stages/toddler/Pages/safety-for-your-child-1-to-2-years.aspx | 2026-10-28 | updated 2022-02-25 | curl |
| `src.aap-hc.drowning-prevention-toddlers` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Water-Safety-And-Young-Children.aspx | 2026-10-28 | updated 2026-05-18 | curl |
| `src.aap-hc.summer-safety-outdoors` | AAP / HealthyChildren (US) | https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Summer-Safety-Tips-Staying-Safe-Outdoors.aspx | 2026-10-28 | updated 2017-06-19 | curl |
| `src.cpsc.small-parts-faq` | CPSC (US) | https://www.cpsc.gov/FAQ/Small-Parts-and-Choking-Hazard-Labeling-FAQs | 2026-10-28 | none shown | fetch |
| `src.zero-to-three.play-activities-12-24-months` | ZERO TO THREE (US) | https://www.zerotothree.org/resource/play-activities-for-12-to-24-months/ | 2026-10-28 | pub 2022-04-29 | fetch |
| `src.zero-to-three.active-play-gather-round` | ZERO TO THREE (US) | https://www.zerotothree.org/resource/learning-through-active-play-gather-round-activities/ | 2026-10-28 | pub 2016-06-27 | fetch |

### Reused from other files

I also opened and read each of these pages myself. The page dates match the existing records.

| ID | Registered in | Page date |
|---|---|---|
| `src.cdc.milestones-1-year` | `c.json` | updated 2026-05-16 |
| `src.hse.burns-cooking` | `c.json` | last reviewed 2023-01-23 |
| `src.aap-hc.choking-prevention` | `c.json` | updated 2026-02-27 |
| `src.aap-hc.furniture-tip-overs` | `c.json` | updated 2021-12-01 |
| `src.cpsc.public-playground-handbook` | `c.json` | Publication #325, Nov 2010, cover note 2015-12-29 |
| `src.aap-hc.sun-safety` | `a.json` | updated 2024-08-09 |
| `src.aap-hc.pedestrian-safety` | `a.json` | updated 2026-03-02 |

### Reused core claims

- `clm.core.who-active-play`: movement activities.
- `clm.core.who-reading-storytelling`: book and songs.
- `clm.core.who-not-restrained-1h`: walk, as a reason to let the toddler out of the stroller.

## Claim-to-passage map

### Description claims

| Claim | Supporting passage (locator) | Used by |
|---|---|---|
| `clm.d.push-to-practice-walking` | CDC 1 year: "More parenting tips": push empty boxes, a kiddie chair or push toys to practice walking; walkers not recommended. CDC 18 months: safe push and pull toys. HSE: big-wheeled push and pull toys. | push-toy laps |
| `clm.d.ball-back-and-forth` | CDC 18 months: roll balls to each other. CDC 2 years: balls to kick, roll, throw. HSE: soft footballs, kick between you. | ball |
| `clm.d.toddler-active-play` | AAP Active Toddler: opening paragraph (walking, running, climbing, tossing and kicking balls) and "Active play: good for your toddler" (one-on-one play helps physical and social skills). | ball (goals, why) |
| `clm.d.dance-and-freeze` | AAP Active Toddler: "Dance parties". ZTT 12–24: "Freeze!" (listening, self-regulation, stopping and starting). | freeze dance |
| `clm.d.bubble-play` | AAP Active Toddler: "Bubble play". CDC 15 and 18 months: bubbles to pop, "pop, pop", turn-taking. HSE: blowing bubbles. | bubbles |
| `clm.d.action-songs` | CDC 15 months: songs with gestures ("Wheels on the Bus"). CDC 2 years: body-part songs with pauses. AAP Power of Play, 1–3 years: sing, play rhythms, move to the beat. | songs |
| `clm.d.book-sharing` | AAP book-sharing pages (12–14, 15–17, 18–23 months): intro ("can help teach them to talk") and "What Parents Can Do". ZTT: "Point It Out" (vocabulary). | picture book |
| `clm.d.simple-objects-play` | AAP Power of Play, 1–3 years, bullet 2: blocks, empty containers, wooden spoons, shape sorters, puzzles. | stack, fill-dump, puzzle, busy basket (evidence only) |
| `clm.d.blocks-and-towers` | CDC 1 year: blocks and hand toys. CDC 15 months: you stack, they knock down. CDC 2 years: take turns building towers. HSE: building blocks. | stack |
| `clm.d.fill-and-dump` | ZTT 12–24: "Fill and Dump" (containers a few steps apart for walkers). CDC 18 months: filling and emptying containers. | fill-dump |
| `clm.d.puzzles` | HSE: simple puzzles (hand–eye coordination, problem-solving). CDC toddlers: shape sorting and simple puzzles. CDC 2 years: name each piece. | puzzle |
| `clm.d.pretend-feeding` | CDC 18 months: spoon to feed a stuffed animal, take turns. CDC 15 months: talk through a stuffed animal. ZTT: "Teddy Bear Pretend Play". | teddy |
| `clm.d.pretend-play` | AAP Power of Play: "Pretend play" section, and the 1–3-year make-believe bullet. | teddy (goals, why) |
| `clm.d.hide-and-find` | AAP Active Toddler, 12–18 months: "Scavenger hunt". AAP Power of Play, 7–12 months: peekaboo and object permanence. CDC 15 months: hide and seek. HSE: peekaboo and hide and seek. | hidden toy |
| `clm.d.helping-tasks` | CDC 15 months: help with everyday activities (socks in the basket). CDC 2 years: chores (toys or laundry in a basket). HSE: tidy toys into a box. | sock helper |
| `clm.d.child-led-walks` | AAP Active Toddler: "Child-led walks". ZTT: "Leaf Collector". CDC 2 years: walks and park. | walk |
| `clm.d.outdoor-play-senses` | AAP Power of Play: "Outdoor play" (senses, spatial awareness, balance). | bubbles, walk, playground |
| `clm.d.outings-curiosity` | CDC 2 years: park, walks, bus to encourage curiosity. CDC toddlers: "explore and try new things". | playground |
| `clm.d.playground-toddler-equipment` | CPSC handbook §2.2.3 and Table 1 (Toddler, 6–23 months, examples of equipment). | playground |
| `clm.d.water-sand-pouring` | HSE: plastic jugs and a basin (sensory play, hand–eye). CDC 2 years: containers, spoons, funnel in the tub or sandbox. ZTT: "Water, Water Everywhere". | water tub |
| `clm.d.over-under` | ZTT Gather Round, 12–24 months: "over, under, in, and out" game and the word-learning sentence. | over-under |

### Safety claims

| Claim | Supporting passage (locator) | Used by |
|---|---|---|
| `clm.d.bubbles-not-eaten` | ZTT: "Make a Bubble Mound" (watch that the child doesn't eat any). | bubbles |
| `clm.d.playground-checks` | CPSC §2.2.7 Supervision and §3.2.1 Strings and ropes. AAP Summer Safety: "Playground Safety". | playground |
| `clm.d.water-touch-supervision` | AAP Drowning Prevention: "Empty water containers…", "close, constant supervision", "touch supervision", no sibling supervisors. AAP 1–2: "Drowning". | water tub |
| `clm.d.small-parts-under-3` | AAP Choking: household choking hazards and prevention list (age labels; check under cushions). CPSC FAQ: ban scope and the test-cylinder definition. | ball, book, busy basket, stack, fill-dump, puzzle, teddy, walk |
| `clm.d.older-siblings-small-objects` | AAP Choking: "Be aware of what older children are doing." | busy basket, puzzle |
| `clm.d.falls-gates-furniture` | AAP 1–2: opening and "Falls". CDC toddlers: block off stairs. | push, freeze, fill-dump, over-under |
| `clm.d.anchor-furniture` | AAP Tip-Overs: "How furniture can be dangerous" and "How to prevent tip-overs". | push, busy basket, hidden toy, over-under |
| `clm.d.kitchen-while-cooking` | AAP 1–2: "Burns", paragraph 1. HSE cooking: "Cookers…", "Block off an area", "Ovens" (in the caveat). | busy basket |
| `clm.d.sun-protection` | AAP Sun Safety: simple rules, choosing and applying sunscreen, babies over 6 months. | bubbles, walk, playground, water |
| `clm.d.pedestrian-safety` | AAP Pedestrian: opening, and "Teaching pedestrian skills to younger children". | ball, walk |
| `clm.d.household-products` | AAP 1–2: "Poisonings". CDC toddlers: appliances, irons, heaters out of reach. | sock helper |

## Safety and readiness considerations

- **Small parts**
  - Every activity is open to under-3s, so none uses small parts.
  - Items are sized to be "too big to fit in the mouth": balls bigger than the fist, board books, chunky puzzles, rolled socks.
  - Banned items never appear in the instructions.
- **Nearby baby (for the mixed-age team)**
  - Safety notes or adaptations say what to keep away from a baby: ball (not at a baby), bubbles (away from the baby's face), stacked blocks (build away from the baby), push path, puzzle pieces, the busy basket (a separate baby basket), and water (only when the baby is asleep or with another adult).
  - `clm.d.older-siblings-small-objects` covers older children handing things to younger ones.
- **Falls and tip-overs**
  - Climbing and cruising activities cite stair gates and furniture anchoring.
  - Over-under stays at floor level with arm's-reach spotting.
  - The playground uses toddler-sized equipment with arm's-reach spotting.
- **Water**
  - The water tub is arm's reach, not shareable, never a parent-moment, and emptied immediately.
  - It notes that a sibling can't be the one watching.
  - Bubbles, the walk and the space notes keep away from ponds and pools.
- **Kitchen**
  - No activity takes place in the kitchen while cooking (see Conflicts).
  - The busy-nearby option is a gated, child-proofed space outside the kitchen and in view.
- **Traffic**
  - The walk is not shareable: hold hands near roads, driveways and crossings.
  - The ball activity says to play away from roads and driveways.
- **Busy-nearby options** (watches, same-room, no hands, shareable, no water/heat/food/traffic): `act.push-toy-laps`, `act.busy-basket-gated-space` and `act.fill-and-dump-relay`. Each says you are in the same room, watching.
- **Readiness**
  - Readiness is expressed as abilities (`pulls-to-stand`, `walks`, `crawls`) rather than age alone.
  - Notes avoid milestone deadlines. The push-toy note says it is "not a walking timeline".
  - The pretend-play note says longer stories "tend to come later" and gives no deadline.
- **Durations** are 2–20 minutes for home play and 15–60 for outings. AAP's book pages note a 12–17-month-old attends to a book "a few minutes at a time".

## Conflicts and jurisdiction differences

1. **Toddler in the kitchen while cooking (unresolved; this shapes the busy-nearby design).**
   - AAP (US, `src.aap-hc.safety-1-to-2-years`): it's best to keep the child out of the kitchen while cooking. A playpen, crib, stationary activity center or buckled high chair is safer when you can't give full attention.
   - HSE (Ireland, `src.hse.burns-cooking`): keep children away from a cooker in use, with a cooker guard and a taped no-go zone in front of the cooker. Use a kitchen gate only if the oven front gets hot.
   - The brief suggested a low cupboard of safe kitchen items while cooking. AAP contradicts that, so I dropped it.
   - Trunk follows AAP (the US default). The "gated, child-proofed play space in view" is Trunk's own adaptation, and the claim's caveat says so.
2. **Screens under 2 (not used here; for Workstream E and the lead).** I did not add media.
   - CDC 1-year, 15-month and 18-month pages: screen time is not recommended under 2, other than video calls.
   - AAP "How Active Is Your Toddler?": no screens other than video chat until 18–24 months; if introduced at 18–24 months, choose high-quality content and watch together.
   - WHO 2019 (core): no sedentary screen time for 1-year-olds.
   - AAP 2026 policy explainer (core): quality, context and co-use rather than fixed limits.
3. **Age of pretend play.** ZERO TO THREE says pretend play is just beginning at about 18 months, while CDC suggests stuffed-animal talk at 15 months. `act.feed-the-teddy` starts at 15m with copying-level play, and the claim's caveat says so.
4. **Object permanence.** AAP places its object-permanence statement in the 7–12-month list. I apply it to a harder toddler hunt, as stated in the claim's caveat.
5. **Older or stale pages.**
   - The HSE play page is past its stated review date (2024).
   - The AAP book-sharing pages are from 2013 (content copyright 1994).
   - The AAP Summer Safety page is from 2017.
   - The CPSC handbook is the 2010 edition.
   - All are still published and consistent with newer pages. Each record's `notes` flags its age.

## Ideas omitted or softened, and why

- **Kitchen cupboard or drawer of safe items while cooking:** omitted because AAP says to keep toddlers out of the kitchen while cooking. It was replaced by the gated busy basket.
- **Separate "board-book basket" busy-nearby record:** merged into the busy basket to avoid a near-duplicate of the book activity.
- **Saucepan and spoon band:** Workstream C covers it (`act.pot-and-spoon-band`, to 18m). For my band, a pot and spoon are among the busy-basket items.
- **Sandbox play:** omitted. It overlaps the water tub's materials and source (HSE's jugs and basin cover both), and I found no sandbox-hygiene source in time.
- **Chunky crayon scribbling:** omitted from D. HSE lists chunky non-toxic crayons for 1–2-year-olds, but crayon pieces are mouthed and broken bits are small. It probably fits Workstream E better, with clear supervision.
- **Cardboard box tunnel peekaboo (ZTT "Hello, Good-Bye"):** folded into the over-under adaptations as a "through" station rather than a separate record.
- **ZTT ideas excluded for small parts or other hazards:**
  - sensory bottles with pennies, glitter or oil
  - cereal in a spice jar (small food items)
  - a shoebox "wagon" on a string (cord hazard)
  - paper-and-tape balls, replaced by rolled socks
  - a flashlight shadow game (battery compartment)
- **AAP Retro Toddler items excluded:**
  - the flashlight variant of the scavenger hunt (batteries)
  - a phone voice-recorder game (a screen device)
  - a stair-climbing game (stairs are gated in this workstream; could be revisited with a sourced spotting note)
  - The 25–30-month "Mylar balloon" jump game is outside this band and banned anyway.
- **Bubble mound through a straw (ZTT):** omitted because a toddler might suck instead of blow. The adult blows bubbles with a wand.
- **Snacks and food:** omitted (policy burden, and no clear need).
- **Hot playground surfaces:** handled as `sun-weather` plus a "touch slides first" safety note rather than the `heat` hazard (see Schema change requests).

## Schema change requests

1. **Hot outdoor surfaces.** The `heat` hazard is treated as "undivided attention" (never shareable), which suits stoves and hot drinks. Hot slides and metal in summer are checked once before use, so I used `sun-weather` plus a safety note.
   - The lead should confirm this. Option: add guidance to the contract that sun-heated equipment is `sun-weather`, or add a distinct hazard.
2. **Cross-workstream near-duplicates.** The validator catches duplicate IDs but not near-identical activities with overlapping ages, such as C's baby versions running to 15–18 months.
   - Option: add a coverage-report warning when two activities share a title stem and overlapping ages, or ask band owners to agree hand-off ages.
3. Otherwise none.

## What the lead should double-check

- **Passages read through the fetch tool** (CDC milestone and toddler pages, CPSC small-parts FAQ, both ZERO TO THREE pages). The tool returned paraphrases rather than full text. The specific bullets I cite are recorded in each claim's `paraphrase`.
- **Playground shareability.** `act.playground-toddler-area` is `shareable: true` with arm's reach, so it can pair only with a same-room track. CPSC's sight-lines guidance supports caregivers watching an older child's area. Confirm this suits the mixed-age team.
- **Water tub handsOn.** `act.water-scoop-tub` uses `handsOn: intermittent` with arm's-reach "touch supervision". AAP means staying within arm's length with full attention, not holding the child continuously.
- **Age shifts against C.** Workstream C's hand-off ages end at 15m. Several of my records now start at 15m, which leaves 12–15m covered mostly by C's records plus my push-toy, freeze dance, bubbles, stack-and-topple, hidden toy, walk and playground.
