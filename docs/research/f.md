# Workstream F research notes: children 36 to under 60 months (3 and 4 years)

Owner files: `content/workstreams/f.json`, `docs/research/f.md`. Sources checked 2026-10-28.
`node scripts/build-catalog.ts --check --only content/workstreams/f.json` exits 0 with no warnings for this file.

## Summary

- 22 distinct activities, all `36m`–`60m`.
  - **Movement and outdoors (6):** copycat moves, red light green light, ball skills, trike ride, playground, nature hunt.
  - **Language and thinking (5):** opposites game, picture-book questions, take-turns story, I spy, memory match.
  - **Fine motor and making (4):** drawing, jigsaw, playdough, scissors.
  - **Everyday life (5):** sock sort, set the table, wash fruit and veg, tear-and-spread helper, planting seeds.
  - **Calm (2):** breathing, calm corner.
- 4 activities pass the app's busy-nearby check (`isBusyNearbyCompatible`): sock sort, draw-and-tell, jigsaw and playdough. All four are also shareable.
- 33 claims (`clm.f.*`): 25 descriptive or recommendation claims and 8 safety claims.
- 13 new sources. My own claims also cite 6 existing source IDs, each re-read on 2026-10-28. In addition, 5 existing claims are reused as written: `clm.core.who-active-play`, `clm.core.who-reading-storytelling`, `clm.d.pedestrian-safety`, `clm.d.sun-protection` and `clm.a.keep-face-clear`. Their owners verified them; I did not re-read their WHO, pedestrian-safety or sun-safety pages.
- No media records and no seated-snack routine, because Workstream E owns both. The one food record, `act.tear-and-spread-helper`, is a food-preparation helper job, not a snack.
- Activities are source-informed. No clinician has reviewed them. Durations, setup times and effort levels are editorial estimates.

## Method

I opened every page and read it before citing it.

- **Read with `curl` and HTML-to-text (pandoc):** HealthyChildren.org (AAP), HSE and NHS pages. I read the full article text, including the "Last Updated" or "Page last reviewed" dates.
- **Read through a fetch tool:** cdc.gov pages.
  - Direct download returned HTTP 403, as Workstream D also found.
  - The tool returns near-verbatim segments or close paraphrases, not the full page. For CDC 4 years, it paraphrased every tip.
  - Each affected source says this in its `notes`. The lead may want to spot-check the CDC tip lists in a browser.
- Milestone pages (AAP 3–4 and 4–5, CDC 3/4/5 years) are used only:
  - to describe skills many children are building; or
  - for their parenting-tip lists.
- No activity sets a deadline, and readiness is expressed through abilities.
- Claims use original wording. Paraphrases are summaries, not copies.

## Activities

| ID | Ages | Readiness | Supervision (participation / proximity / hands) | Shareable | Busy-nearby | Hazards | Evidence |
|---|---|---|---|---|---|---|---|
| `act.copycat-moves` | 36m–60m | walks | leads / same-room / none | yes | no | none | described |
| `act.red-light-green-light` | 36m–60m | runs, follows-directions | leads / same-room / none | yes | no | none | described |
| `act.throw-catch-kick` | 36m–60m | runs | joins / same-room / intermittent | yes | no | none | described |
| `act.trike-or-balance-bike-ride` (outing) | 36m–60m | walks, follows-directions | joins / arms-reach / intermittent | **no** | no | traffic, falls, sun-weather | described |
| `act.preschool-playground` (outing) | 36m–60m | climbs | joins / arms-reach / intermittent | yes | no | falls, sun-weather | described |
| `act.nature-hunt-and-count` (outing) | 36m–60m | walks, no-longer-mouthing | joins / arms-reach / intermittent | **no** | no | traffic, sun-weather | adapted |
| `act.big-small-opposites-game` | 36m–60m | none | leads / same-room / none | yes | no | none | described |
| `act.what-happens-next-book` | 36m–60m | none | leads / arms-reach / none | yes | no | none | described |
| `act.take-turns-story` | 36m–60m | none | leads / same-room / none | yes | no | none | adapted |
| `act.i-spy-colors-sounds` | 36m–60m | none | leads / same-room / none | yes | no | none | described |
| `act.memory-match-cards` | 36m–60m | follows-directions | joins / same-room / intermittent | yes | no | none | described |
| `act.sock-match-and-sort` (routine) | 36m–60m | follows-directions | watches / same-room / none | yes | **yes** | none | described |
| `act.draw-and-tell` | 36m–60m | no-longer-mouthing | watches / same-room / none | yes | **yes** | small-parts | described |
| `act.jigsaw-at-the-table` | 36m–60m | no-longer-mouthing | watches / same-room / none | yes | **yes** | small-parts | described |
| `act.playdough-squish-and-shape` | 36m–60m | no-longer-mouthing | watches / same-room / none | yes | **yes** | small-parts, allergens | described |
| `act.scissor-snipping` | 36m–60m | no-longer-mouthing, follows-directions | joins / arms-reach / intermittent | **no** | no | sharp | adapted |
| `act.set-the-table-helper` (routine) | 36m–60m | follows-directions | joins / same-room / intermittent | yes | no | none | described |
| `act.wash-fruit-and-veg` (routine) | 36m–60m | follows-directions | joins / arms-reach / intermittent | **no** | no | water, falls | described |
| `act.tear-and-spread-helper` (routine) | 36m–60m | eats-solids, follows-directions | joins / arms-reach / intermittent | **no** | no | food, allergens | described |
| `act.plant-and-water-seeds` | 36m–60m | no-longer-mouthing, follows-directions | joins / arms-reach / intermittent | **no** | no | water, small-parts | described |
| `act.smell-flower-blow-candle` | 36m–60m | none | leads / same-room / none | yes | no | none | adapted |
| `act.calm-corner-together` | 36m–60m | none | joins / same-room / none | yes | no | suffocation | described |

Notes on supervision choices:

- **Busy-nearby (watches / same-room / no hands / shareable):** only table or floor jobs with no water, heat, food or traffic.
  - Three of them (drawing, jigsaw, playdough) list `small-parts` honestly. Each has a sourced note to keep pieces away from babies and younger siblings.
  - Because of `small-parts`, the validator will reject them as the older track of a parallel recipe when the younger child is under 3. That is intended.
- **Not shareable:**
  - The trike ride and the nature hunt involve traffic.
  - Washing fruit and veg and planting seeds involve water.
  - The tear-and-spread helper involves food.
  - Scissor snipping is marked not shareable on purpose. Scissors near a baby are a hazard, and the adult needs to be at arm's reach. The `sharp` hazard is not in the validator's serious list, so this is an editorial choice.
- **Arm's reach:**
  - Climbing at the playground follows the policy that climbing needs arm's-reach spotting.
  - The trike ride needs arm's reach near roads.
  - Water and food activities always need arm's reach.
- **The playground is shareable,** matching Workstream D's playground record. The adult spots one child on climbers while a second child stays within view. Two arm's-reach tracks are still rejected by `checkParallel`.

## Sources

New sources registered in `f.json`:

| ID | Title (link) | Org | Jurisdiction | Page date | Checked | Read via |
|---|---|---|---|---|---|---|
| `src.cdc.milestones-3-years` | [Milestones by 3 Years](https://www.cdc.gov/act-early/milestones/3-years.html) | Centers for Disease Control and Prevention (CDC), Learn the Signs. Act Early. | US | pub. 2025-09-04; upd. 2026-05-16 | 2026-10-28 | fetch tool (paraphrase) |
| `src.cdc.milestones-4-years` | [Milestones by 4 Years](https://www.cdc.gov/act-early/milestones/4-years.html) | Centers for Disease Control and Prevention (CDC), Learn the Signs. Act Early. | US | pub. 2025-09-04; upd. 2026-05-16 | 2026-10-28 | fetch tool (paraphrase) |
| `src.cdc.milestones-5-years` | [Milestones by 5 Years](https://www.cdc.gov/act-early/milestones/5-years.html) | Centers for Disease Control and Prevention (CDC), Learn the Signs. Act Early. | US | pub. 2025-09-04; upd. 2026-05-16 | 2026-10-28 | fetch tool (paraphrase) |
| `src.cdc.positive-parenting-preschoolers` | [Positive Parenting Tips: Preschoolers (3–5 years old)](https://www.cdc.gov/child-development/positive-parenting-tips/preschooler-3-5-years.html) | Centers for Disease Control and Prevention (CDC) | US | upd. 2026-02-20 | 2026-10-28 | fetch tool (paraphrase) |
| `src.aap-hc.milestones-3-4-years` | [Developmental Milestones: 3 to 4 Year Olds](https://www.healthychildren.org/English/ages-stages/preschool/Pages/Developmental-Milestones-3-to-4-Year-Olds.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2023-04-04 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.milestones-4-5-years` | [Developmental Milestones: 4 to 5 Year Olds](https://www.healthychildren.org/English/ages-stages/preschool/Pages/Developmental-Milestones-4-to-5-Year-Olds.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2023-04-04 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.safety-2-to-4-years` | [Safety for Your Child: 2 to 4 Years Old](https://www.healthychildren.org/English/ages-stages/toddler/Pages/Safety-for-Your-Child-2-to-4-Years.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2022-09-29 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.ready-for-tricycle` | [Ready for a Tricycle?](https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Ready-For-A-Tricycle.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2021-08-04 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.first-tricycle-or-bike` | [Your Child's First Tricycle or Bike: Important Safety Rules](https://www.healthychildren.org/English/safety-prevention/at-play/Pages/your-childs-first-tricycle-or-bike-teaching-them-to-ride-safely.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2022-08-11 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.bike-helmets-faq` | [Bike Helmets for Kids: Parent FAQs](https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Bicycle-Helmets-What-Every-Parent-Should-Know.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2024-06-28 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.food-allergies` | [Food Allergies in Children: Causes, Symptoms, Diagnosis & Treatment](https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Food-Allergies-in-Children.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2025-10-08 | 2026-10-28 | curl + pandoc (full text) |
| `src.hse.play-3-5-years` | [Play and toys to help your child develop - 3 to 5 years old](https://www2.hse.ie/babies-children/play/3-5-years/) | Health Service Executive (Ireland) | IE | upd. 2021-04-20 | 2026-10-28 | curl + pandoc (full text) |
| `src.nhs.activity-under-5` | [Physical activity guidelines for children (under 5 years)](https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-children-under-five-years/) | NHS (UK) | UK | upd. 2025-10-27 | 2026-10-28 | curl + pandoc (full text) |

Existing sources cited by `clm.f.*` claims. Other workstreams registered them; I re-read each page on 2026-10-28 before citing it:

| ID | Title (link) | Org | Jurisdiction | Page date | Checked | Read via |
|---|---|---|---|---|---|---|
| `src.aap-hc.playing-outside` | [Playing Outside: Why It's Important for Kids](https://www.healthychildren.org/English/family-life/power-of-play/Pages/playing-outside-why-its-important-for-kids.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2026-04-06 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.playground-safety` | [Playground Safety: How to Ensure Injury-Free Fun](https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Safety-on-the-Playground.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2025-03-31 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.backyard-safety` | [Playing Outside in the Yard: 8 Tips to Keep it Fun & Safe for Kids](https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Backyard-Safety.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2022-06-28 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.choking-prevention` | [Choking Prevention for Babies & Children: What Every Parent Needs to Know](https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2026-02-27 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.kitchen-safety` | [Kitchen Safety: 10 Tips for Families With Young Children](https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Kitchen-Safety.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2023-04-11 | 2026-10-28 | curl + pandoc (full text) |
| `src.aap-hc.drowning-prevention-toddlers` | [Drowning Prevention for Curious Toddlers: What Parents Need to Know](https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Water-Safety-And-Young-Children.aspx) | American Academy of Pediatrics (HealthyChildren.org) | US | upd. 2026-05-18 | 2026-10-28 | curl + pandoc (full text) |

## Claim-to-passage map

| Claim | Kind | Sources | Locator | Supporting passage (paraphrase) |
|---|---|---|---|---|
| `clm.f.copycat-and-chasing-games` | description | `src.hse.play-3-5-years`, `src.aap-hc.playing-outside` | HSE 3–5 years: 'Ways to play with children this age' list. AAP Playing Outside: 'Explore with preschoolers & grade-school age kids' — 'Go for a silly stroll'. | HSE lists copycat activities (tiptoes, skip, jump, hop), chasing games and hide-and-seek among ways to play with 3–5-year-olds. AAP suggests challenging kids to tiptoe, turn in circles, march with high knees or wiggle, then letting them call the moves and trading off being the leader. |
| `clm.f.uk-active-play` | recommendation | `src.nhs.activity-under-5` | Sections 'Pre-schoolers (aged 3 to 4)' and 'Physical activity ideas for under 5s'. | Pre-schoolers should spend at least 180 minutes a day in a variety of physical activities spread through the day, including active and outdoor play, with at least 60 minutes moderate-to-vigorous. Ideas for under-5s include jumping, dancing, playground activities, climbing, skipping, hide and seek, throwing and catching, scooting and riding a bike. *Caveat:* Same targets as WHO 2019 (clm.core.who-active-play). No jurisdiction conflict found. |
| `clm.f.stop-and-go-games` | recommendation | `src.cdc.milestones-4-years`, `src.cdc.milestones-5-years` | CDC 4 years and 5 years: 'More parenting tips and activities' lists. | The 4-year page suggests red light, green light or freeze dance to teach a child to stop and wait when excited, and outdoor games with friends such as tag, follow the leader and hide and seek. The 5-year page suggests teaching rule-following with simple board games, card games or Simon Says. |
| `clm.f.ball-skills` | description | `src.hse.play-3-5-years`, `src.cdc.positive-parenting-preschoolers` | HSE 3–5 years: 'Ways to play' list (ball activities) and toys list (large and small balls). CDC Preschoolers: 'Healthy Bodies'. | HSE encourages more ball activities like kicking, catching and throwing, and lists large and small balls. CDC says to provide age-appropriate play equipment like balls and plastic bats, let the child choose what to play, and keep being active fun. |
| `clm.f.motor-skills-vary` | description | `src.aap-hc.milestones-3-4-years`, `src.aap-hc.milestones-4-5-years` | 'Movement milestones' lists and 'Developmental health watch' paragraphs on both pages. | The 3–4 page lists hopping, kicking a ball forward, throwing overhand, catching a bounced ball most of the time and pedaling a tricycle. The 4–5 page adds somersaults, swinging and climbing. Both say no one can tell exactly when a child will perfect a skill. *Caveat:* Trunk uses these lists only to describe what play may involve. Questions about a child's development go to their clinician. |
| `clm.f.trike-readiness` | description | `src.aap-hc.ready-for-tricycle`, `src.hse.play-3-5-years` | AAP Ready for a Tricycle?: tips 1 ('Be ready') and 2 ('Go low'). HSE 3–5 years: intro paragraph and 'Ways to play' list. | AAP: don't get a tricycle until the child can physically handle it; most are ready around 3; choose one low to the ground with big wheels, which is less likely to tip. HSE suggests pushing along on or pedaling a tricycle or small bike with stabilisers, balance bikes and scooters, and notes scooting moves from two feet to pushing off with one. |
| `clm.f.trike-helmet-place` | safety | `src.aap-hc.ready-for-tricycle`, `src.aap-hc.first-tricycle-or-bike`, `src.aap-hc.bike-helmets-faq`, `src.cdc.positive-parenting-preschoolers` | AAP Ready for a Tricycle?: tips 3–5. AAP First Tricycle or Bike: 'Tips to teach your child safe bicycle use'. AAP Bike Helmets FAQ: fit section. CDC Preschoolers: 'Child Safety First'. | AAP: a well-fitting helmet meeting CPSC standards on every ride, chin strap snug, closed-toe shoes, no riding near cars, driveways or pools, trikes only in protected places; young children ride only with adult supervision and off the street. Helmets sit level over the forehead and don't slide. CDC: keep the child on the sidewalk, away from the street, always with a helmet. *Caveat:* CDC says 'sidewalk'; AAP says protected places off the street, away from driveways. Trunk uses the stricter version: paths or closed areas away from streets and driveways, with an adult close by. |
| `clm.f.street-play-safety` | safety | `src.cdc.positive-parenting-preschoolers`, `src.aap-hc.safety-2-to-4-years` | CDC Preschoolers: 'Child Safety First'. AAP Safety 2 to 4 Years: intro and 'Car & traffic-related crashes', last paragraph. | CDC: explain why staying out of traffic matters, and tell the child not to play in the street or run after stray balls. AAP: children this age don't understand dangers or remember 'no' while playing; don't let a child play or ride a tricycle in the street; driveways are dangerous, so walk behind the car before backing out. |
| `clm.f.playground-preschool` | description | `src.cdc.milestones-5-years`, `src.cdc.milestones-3-years`, `src.aap-hc.playground-safety` | CDC 5 years and 3 years: 'More parenting tips and activities'. AAP Safety on the Playground: opening paragraph and 'Sizing up playground equipment'. | CDC 5 years: take your child to the playground, teach her to pump her legs on a swing and help her on the monkey bars. CDC 3 years: play outside with your child at the park or on a walking trail. AAP: playground visits exercise bodies, brains and social skills; choose equipment geared to the child's age, abilities and size. |
| `clm.f.playground-safety` | safety | `src.aap-hc.playground-safety`, `src.aap-hc.safety-2-to-4-years`, `src.cdc.positive-parenting-preschoolers` | AAP Playground: 'Playground surfaces', 'Climbing structures', 'Slides', 'Swings', 'Remember'. AAP Safety 2 to 4 Years: 'Falls'. CDC Preschoolers: 'Child Safety First'. | AAP: most playground injuries are falls, so look for deep wood chips, mulch, sand or safety-tested mats (grass doesn't absorb shock); slides can burn; go feet first once the slide is clear; don't run in front of swings; no drawstrings, and a helmet comes off while playing; lack of supervision is linked to nearly half of injuries. CDC: check equipment for loose parts or sharp edges. |
| `clm.f.outdoor-explore-preschool` | description | `src.aap-hc.playing-outside` | 'Outdoor play ideas by age': 'Explore with preschoolers & grade-school age kids' and 'Challenge older children & teens' (scavenger hunt). | For preschoolers and grade-schoolers, AAP suggests nature sculptures from collected twigs, leaves, cones and rocks, imaginative outdoor play, chalk obstacle courses, silly strolls and small supervised yard jobs like watering flowers. Nature scavenger hunts and collections, using a list of things to find, appear under ideas for older children and teens. *Caveat:* Trunk's preschool nature hunt is adapted: a short picture list with counting, not AAP's older-child version. |
| `clm.f.counting-everyday` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-4-years` | CDC 3 years and 4 years: 'More parenting tips and activities'. | The 3-year page suggests counting games with body parts, stairs and other things used or seen every day, noting that children this age are starting to learn about numbers. The 4-year page suggests counting common items such as fingers, toys or bananas. |
| `clm.f.matching-memory-games` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-4-years`, `src.cdc.milestones-5-years`, `src.hse.play-3-5-years` | CDC 3, 4 and 5 years: 'More parenting tips and activities'. HSE 3–5 years: 'Toys and items children of this age will enjoy'. | CDC 3 years: play matching games, asking the child to find things in books or around the house that are the same. CDC 4 years: simple games such as tic-tac-toe or matching games. CDC 5 years: games that help memory and attention, such as card games, tic-tac-toe, I Spy or Hot and Cold. HSE lists puzzles, simple dice games and lotto games. |
| `clm.f.opposites-game` | recommendation | `src.cdc.milestones-3-years` | 'More parenting tips and activities', opposites bullet. | Play games to teach opposites: get down low and say you are small, then stand up and say you are big; repeat with fast and slow, and quiet and loud. |
| `clm.f.read-ask-what-next` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-5-years`, `src.cdc.milestones-4-years`, `src.cdc.positive-parenting-preschoolers` | CDC 3, 4 and 5 years: 'More parenting tips and activities'. CDC Preschoolers: 'Positive Parenting Tips', reading bullet. | CDC 3 years: read together, ask what is happening in the picture or what will happen next, and ask for more details. CDC 5 years: encourage the child to 'read' by looking at the pictures and telling the story, and ask about pictures and what comes next. CDC 4 years: library trips to pick books. Preschool tips: continue to read to your child. |
| `clm.f.story-skills` | description | `src.aap-hc.milestones-3-4-years`, `src.aap-hc.milestones-4-5-years`, `src.cdc.milestones-5-years` | AAP 3–4 and 4–5: 'Language milestones' and 'Cognitive milestones'. CDC 5 years: 'Language/Communication Milestones'. | AAP's 3–4 page lists telling stories and recalling parts of a story; the 4–5 page lists recalling part of a story and telling longer stories. CDC's 5-year list includes telling a story heard or made up with at least two events, and answering simple questions about a book or story. *Caveat:* Milestones describe what many children do. Trunk does not use them to judge a child; concerns go to the child's clinician. |
| `clm.f.drawing-and-art` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-5-years`, `src.hse.play-3-5-years` | CDC 3 years: 'More parenting tips and activities'. CDC 5 years: 'More parenting tips and activities' and 'What You Can Do'. HSE 3–5 years: toys list. | CDC 3 years: give an 'activity box' with paper, crayons and coloring books, and color and draw lines and shapes together. CDC 5 years: keep a box of crayons, paper, paint, child scissors and glue for creative play; ask what the child is playing and help expand answers with 'why' and 'how'. HSE lists non-toxic paint, crayons, stencils and finger paints. |
| `clm.f.playdough-hands` | recommendation | `src.cdc.milestones-3-years` | 'More parenting tips and activities', playdough bullet. | Let your child play with playdough by squishing, pressing, pinching and making balls in different colors; this builds hand and finger muscles for writing, buttoning and cutting. |
| `clm.f.child-safe-scissors` | description | `src.aap-hc.milestones-3-4-years`, `src.cdc.milestones-5-years` | AAP 3–4: 'Milestones in hand and finger skills'. CDC 5 years: 'More parenting tips and activities', art-supplies bullet. | AAP lists using child-safe scissors, copying square shapes and drawing circles and squares for 3–4-year-olds. CDC suggests keeping a box of crayons, paper, paint, child scissors and glue for creative play. |
| `clm.f.puzzles-building` | recommendation | `src.cdc.milestones-5-years`, `src.hse.play-3-5-years` | CDC 5 years: 'What You Can Do for Your 5-year-old'. HSE 3–5 years: toys list. | CDC: play with toys that encourage your child to put things together, such as puzzles and building blocks. HSE lists puzzles among toys children aged 3 to 5 enjoy. |
| `clm.f.simple-chores` | recommendation | `src.cdc.positive-parenting-preschoolers`, `src.cdc.milestones-4-years`, `src.cdc.milestones-5-years`, `src.hse.play-3-5-years` | CDC Preschoolers: 'Positive Parenting Tips'. CDC 4 years: social milestones and tips. CDC 5 years: 'Social/Emotional Milestones'. HSE 3–5: 'Ways to play'. | CDC: let your child help with simple chores. The 4-year page lists 'likes to be a helper' and suggests simple chores such as bringing in the mail, feeding a pet or wiping tables. The 5-year page lists simple chores such as matching socks or clearing the table after eating. HSE: let them help with little jobs around the home. |
| `clm.f.help-with-meals` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-5-years` | CDC 3 years and 5 years: 'More parenting tips and activities'. | CDC 3 years: let your child help make meals and give simple tasks such as washing fruits and vegetables or stirring. CDC 5 years: let your child help prepare the healthy foods and enjoy them together. |
| `clm.f.grow-seeds` | description | `src.hse.play-3-5-years`, `src.aap-hc.playing-outside`, `src.aap-hc.backyard-safety` | HSE 3–5 years: toys list. AAP Playing Outside: 'Raise a yardwork helper'. AAP Backyard Safety: tip 5. | HSE lists a window box or small area in the garden to dig and grow seeds. AAP says preschoolers are the right age for small, supervised helpful tasks like watering flowers, and many yardwork tasks give sensory input that can be calming; its backyard page suggests a container garden with kid-friendly shovels and gloves. |
| `clm.f.calm-tools` | recommendation | `src.cdc.milestones-3-years`, `src.cdc.milestones-4-years` | CDC 3 years: 'What You Can Do for Your 3-year-old'. CDC 4 years: 'More parenting tips and activities'. | CDC 3 years: talk about your child's emotions and give words for feelings; help manage stressful feelings by teaching deep breaths, hugging a favorite toy or going to a quiet, safe place when upset. CDC 4 years: comfort a scared child, talk about the fear and suggest coping steps such as hugging a stuffed animal. |
| `clm.f.calm-space-feelings` | recommendation | `src.cdc.milestones-5-years`, `src.cdc.milestones-3-years` | CDC 5 years: 'More parenting tips and activities' (calm spot; naming feelings). CDC 3 years: 'What You Can Do for Your 3-year-old'. | CDC 5 years: create a spot in your home for your child to go when upset; stay nearby so they know they are safe and can come to you for help calming; talk about and label your child's and your own feelings. CDC 3 years: talk about emotions and give words to explain feelings. |
| `clm.f.small-pieces-away-from-babies` | safety | `src.aap-hc.choking-prevention` | 'Household items that are choking hazards' and 'How to prevent choking in children' (older siblings; age labels; check under furniture). | AAP lists toys with small parts, small balls, coins and pen or marker caps among choking hazards to keep from infants and young children. It advises following toy age labels, checking under furniture and between cushions, and watching older children, because many choking incidents happen when older siblings give foods, toys or small objects to a younger child. |
| `clm.f.choking-foods-under-4` | safety | `src.aap-hc.choking-prevention` | 'Foods that can cause choking' and 'How to prevent choking in children'. | Keep high-risk foods from children until 4 or older, depending on development; round, firm foods can be served chopped into tiny pieces, and nut butters spread thinly. Children should eat sitting down and never run, walk, play or lie down with food in their mouths; supervise meals and cut food no larger than half an inch. |
| `clm.f.food-allergy-check` | safety | `src.aap-hc.food-allergies` | 'Living with a food allergy: tips for families' and 'Signs & symptoms of food allergies in children & teens'. | Read food labels carefully every time because ingredients change. At home, don't mix the allergen into the child's safe food, use clean utensils, plates, pans and trays, and store unsafe foods separately. Symptoms can follow eating, inhaling or touching food allergens; milk, egg, peanut, soy, wheat, tree nuts, fish, shellfish and sesame cause most allergies. |
| `clm.f.sharp-and-hot-in-kitchen` | safety | `src.aap-hc.kitchen-safety`, `src.aap-hc.safety-2-to-4-years` | AAP Kitchen Safety: items 2 and 4. AAP Safety 2 to 4 Years: 'Burns'. | AAP: keep knives, forks, scissors and other sharp instruments separate from 'safe' utensils and store sharp appliances out of reach; turn pot handles toward the back. The 2-to-4 page says the kitchen is dangerous while cooking, hot liquids and foods can spill on a child underfoot, so find something safe for them to do; appliances stay hot after use, and tap water should be no hotter than 120°F. |
| `clm.f.water-arms-reach` | safety | `src.aap-hc.drowning-prevention-toddlers`, `src.cdc.positive-parenting-preschoolers`, `src.aap-hc.backyard-safety` | AAP Water Safety: opening; 'Empty water containers'; 'Provide close, constant supervision'; 'Use touch supervision'. CDC Preschoolers: 'Child Safety First'. AAP Backyard: tip 2. | AAP: drowning is the leading cause of death in children 1–4; young children can drown in an inch or two of water, quickly and silently; empty buckets and containers right after use; give full attention and stay within arm's length ('touch supervision'); don't let a young sibling supervise. CDC: watch preschoolers at all times in or near any water, including kiddie pools. |
| `clm.f.falls-preschool` | safety | `src.aap-hc.safety-2-to-4-years` | 'Falls' section. | Children this age can fall off play equipment, out of windows, down stairs, off a bike or tricycle and off anything that can be climbed. Use safety-tested mats or loose fill at least 9 inches deep under play equipment, stairway gates, and operable window guards above the first floor. Call the doctor after a serious fall or if the child doesn't act normally. |
| `clm.f.garden-chemicals-plants` | safety | `src.aap-hc.backyard-safety`, `src.aap-hc.safety-2-to-4-years` | AAP Backyard Safety: tips 5 and 7. AAP Safety 2 to 4 Years: 'Poisonings'. | AAP: store mowers, trimmers, gasoline and lawn chemicals out of reach, with outdoor chemicals under lock and key; keep children off lawns and gardens for 48 hours after spraying; some plants are poisonous, so check trees, plants and shrubs; call Poison Control if a child eats something dangerous. The 2-to-4 page says children may swallow anything they find. |
| `clm.f.products-out-of-reach` | safety | `src.aap-hc.kitchen-safety`, `src.aap-hc.safety-2-to-4-years` | AAP Kitchen Safety: item 1. AAP Safety 2 to 4 Years: 'Poisonings'. | AAP: store cleaners, dishwasher soap and other dangerous products high, locked and out of sight; detergent pods are a special risk because children mistake them for candy. Children 2–4 can open any drawer and climb anywhere, so keep products and medicines capped, out of sight and reach, and in original containers; call the Poison Help Line if a child puts something poisonous in their mouth. |

Reused claims (not re-authored):

| Claim | Owner | Used for |
|---|---|---|
| `clm.core.who-active-play` | core | Evidence for the movement records. It gives WHO's 180 minutes a day for ages 1–4, including 60 minutes of moderate-to-vigorous activity for 3–4-year-olds, as a daily total, not per activity. |
| `clm.core.who-reading-storytelling` | core | Picture-book, take-turns story and jigsaw records (WHO lists reading, storytelling and puzzles with a caregiver). |
| `clm.d.pedestrian-safety` | D | Hold-hands-near-roads notes on the trike ride and nature hunt. AAP pedestrian guidance for young children. |
| `clm.d.sun-protection` | D | Sun notes on outdoor records. The AAP sunscreen guidance covers all children over 6 months. |
| `clm.a.keep-face-clear` | A | Calm corner: keep loose cushions and blankets out of a baby's space. |

## Safety and readiness considerations

- **Small parts and younger siblings.** Every record that lists `small-parts` starts at `36m` and has a note citing `clm.f.small-pieces-away-from-babies` (AAP choking prevention). These are drawing, jigsaw, playdough and planting seeds. That AAP page lists pen and marker caps, toys with small parts and small balls. It also says many choking incidents happen when older siblings hand objects to a younger child.
- **Banned items.** Instructional text contains none. Sunflower seeds were deliberately left out of the planting record because AAP lists them as a choking food. High-risk foods are named only in safety notes, never in steps.
- **Food (`act.tear-and-spread-helper`).**
  - It meets every validator rule: `eats-solids`, arm's reach, not shareable, no parent-moment.
  - Its notes cover high-risk foods until at least 4 (AAP) and eating seated. They also cover allergy labels and cross-contact (AAP food allergies), and blunt tools only.
  - It is a helper task and does not duplicate E's snack routine.
  - Choking specifics are in safety notes only.
- **Water.**
  - Washing fruit and veg, and watering seeds, list `water`. Both are arm's reach and not shareable, and neither carries the parent-moment intent.
  - Their notes cite `clm.f.water-arms-reach`: AAP "Water Safety and Young Children" (drowning is the leading cause of death for ages 1–4; arm's-length touch supervision; empty containers; a young sibling never supervises), plus CDC preschool "watch at all times near any water".
- **Heat.** No record uses heat. The kitchen records keep the child seated or at the sink, away from the stove. They use cool water only and cite AAP kitchen safety and AAP "Safety for Your Child: 2 to 4 Years" (burns).
- **Traffic.**
  - The trike ride and nature hunt list `traffic`.
  - Ball and red-light games keep play away from streets and cite CDC (don't chase stray balls) and AAP 2–4 (no riding or playing in the street; driveways).
  - The trike ride uses AAP's "protected places, off the street, adult supervision", with a CPSC-certified helmet and closed-toe shoes on every ride.
  - AAP's playground page says to take a helmet off before playing on equipment, and the trike record says so.
- **Falls.** The playground, trike ride and step-stool records cite AAP 2–4 falls guidance (soft surfacing, falls from anything climbable). Playground surfacing, hot slides, feet-first sliding and swings come from the AAP playground page.
- **Chemicals and plants.** The planting and nature-hunt records cite AAP backyard safety: chemicals locked away, 48 hours off treated lawns, checking plants are non-toxic, and Poison Help. The Poison Help number is US-only, as the claim's scope says. The sock sort cites AAP's warning about detergents and pods.
- **Readiness.**
  - Abilities are used instead of age: `walks`, `runs`, `climbs`, `follows-directions`, `no-longer-mouthing` and `eats-solids`.
  - The trike note says readiness depends on being able to get on, steer and stop. It reports AAP's "most children are ready around 3" as "many", which is softer wording.
  - Each record's adaptations include a not-yet version: march instead of hop, roll instead of catch, tear instead of cut, push along before pedaling.
- **Social-emotional records** (breathing and calm corner) avoid therapy and diagnostic language.
  - They follow CDC's parenting tips: deep breaths, hug a favorite toy, a quiet safe place, a calm spot with the adult nearby, and naming feelings.
  - The calm corner says plainly that it is never a punishment or a way of sending a child away alone.
  - The breathing record is `adapted`, because "smell the flower, blow the candle" is Trunk's own framing of CDC's "teach deep breaths".
- **No milestone pressure.** Milestone claims (`clm.f.motor-skills-vary` and `clm.f.story-skills`) have caveats saying they describe, don't judge, and that concerns go to the clinician. No record mentions school readiness.

## Conflicts and jurisdiction differences

- **Active play targets.**
  - WHO (international, 2019) and NHS (UK, reviewed 2025-10-27) agree: at least 180 minutes a day for 3–4-year-olds, including 60 minutes of moderate-to-vigorous activity.
  - CDC (US) says to make time for active play each day but gives no minutes. This is no conflict, just less detail.
- **Where young riders ride.**
  - CDC says to keep the child on the sidewalk, away from the street.
  - AAP says trikes only in protected places, off the street, away from driveways and pools.
  - Trunk uses the stricter AAP version: paths or closed areas with an adult close by. This is recorded in the caveat on `clm.f.trike-helmet-place`.
  - HSE's play page suggests trikes, balance bikes and scooters but doesn't mention helmets. Trunk applies the US helmet rule everywhere.
  - CPSC certification is a US standard; the claim says to look for the local equivalent elsewhere. I did not read Irish or UK helmet guidance, so none is claimed.
- **Choking foods.** I used only AAP, which says to keep high-risk foods away until at least 4, depending on development. UK and Irish guidance on preparing grapes and similar foods may use a different age, but I did not read those pages this round, so they are not cited. The lead or Workstream E may want to add them if E's snack research covers this.
- **Hot tap water** (120°F / 49°C) is a US figure from AAP. It is kept in a paraphrase only and not stated as a universal rule.
- **Poison Help number** (1-800-222-1222) is US-only. It is mentioned in a claim scope, not in activity text.
- **Screen time is out of scope** (Workstream E). For reference, the CDC preschool page says no more than 1 hour a day of quality programming, which matches WHO's under-5 guidance. The 2026 AAP explainer moves toward quality and context over fixed limits.
- **Stale page.** HSE "3 to 5 years" was last reviewed 2021-04-20, and its stated next review (2024-04-20) has passed. Its suggestions are general play ideas, consistent with the CDC and AAP pages, and no safety claim depends on it alone.

## Ideas omitted or softened, and why

- **Obstacle course with furniture.** Left out to keep the set manageable, and because furniture climbing needs arm's-reach spotting and tip-over checks. The AAP "Playing Outside" page mentions chalk obstacle courses, so this could be added later as an `adapted` floor-only course.
- **Blanket fort or cardboard-box house.** I read no preschool source that describes it. A fort also adds furniture-tip and baby-suffocation issues. Pretend play is supported by CDC (4 and 5 years), so the lead could add it with those claims.
- **Animal walks and hopping games.** Not described in the sources I read. Hopping, tiptoeing, marching and jumping are folded into `act.copycat-moves`, which HSE and AAP describe.
- **Counting on a walk.** Folded into `act.nature-hunt-and-count`. AAP frames nature scavenger hunts for older children, so this record is `adapted` and uses a short picture list.
- **Sorting cutlery.** Replaced by sock and laundry sorting (CDC lists matching socks), to avoid knives.
- **Retelling with puppets.** Folded into the picture-book record's adaptations ("act the story out with toys").
- **Quiet book basket as a solo busy-nearby option.** Left out because the WHO and CDC reading claims are about reading with a caregiver. Solo looking at books appears as the very-tired-parent adaptation of the picture-book record.
- **Scooter as a separate record.** Folded into the trike ride's adaptations, with the same helmet rule.
- **Swimming, pools and water tables.** Not included: higher risk, and D already covers water tubs.
- **Trampolines.** AAP recommends against home trampolines (backyard safety page), so not suggested.
- **Media and seated snacks.** Owned by Workstream E.
- **Softened wording.**
  - The CDC playdough tip says it "builds" hand and finger muscles; the `why` text attributes that to CDC rather than promising it.
  - The trike readiness note says "many children" where AAP says "most".
  - The AAP yardwork note ("sensory input that can be calming") is attributed to AAP and not presented as a promised outcome.

## Schema change requests

1. **Hazard code for poisons and chemicals.** The vocabulary has no code for household products, garden chemicals or poisonous plants. Today these hazards live only in safety notes (sock sort, planting, nature hunt). A `poisons` hazard would let the validator require a sourced note and let the mixed-age planner see it.
2. **Validator: require a cited note for `allergens`.** `allergens` is not in the validator's serious-hazards set, so a record could list it without a sourced note. My two `allergens` records cite `clm.f.food-allergy-check` anyway. Suggest adding `allergens` (and perhaps `sharp`) to the cited-note rule.

## Open items for the lead

- If Workstream E also registers `https://www.cdc.gov/act-early/milestones/3-years.html` (it borders E's band), the duplicate-URL error will be reported in whichever file loads second (`e.json` loads before `f.json`). One file should reuse the other's ID. Mine is `src.cdc.milestones-3-years`.
- Spot-check the CDC 4-year tips list in a browser; the fetch tool paraphrased every bullet.
