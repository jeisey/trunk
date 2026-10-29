# Independent content and safety review

Reviewer: independent content/safety reviewer (did not write any of the content). Review date: 2026-10-29.
Scope: `content/core.json`, `content/workstreams/{a,b,c,d,e,f,mix}.json`, the claim-bearing app files listed below, and the authors' notes. This review edits nothing; the lead fixes.

**Counts:** 2 Blocker, 11 Major, 21 Minor.

## Scope and method

**Versions reviewed**

- Content a–f and core as of commit `362f99b`, unchanged through `4f8fc5b`: 107 activities, 242 claims, 114 sources.
- `content/workstreams/mix.json` at sha256 `e6622c88…`, committed in `1a58a2b` ("Add mixed-age pairings and starter plans"). It adds 29 recipes, 6 starter plans, 1 activity, 6 claims and 3 sources, for a total of 108 activities, 248 claims and 117 sources. `node scripts/build-catalog.ts --check --only content/workstreams/mix.json` exited 0 at 04:35 UTC. The file was unchanged at the end of the review.
- App code at `4f8fc5b`.

**What was checked**

- **All 108 activities, line by line.** The high-risk set got particular attention: tummy time; anything with water, food, heat, traffic, falls, suffocation, small parts or sharp hazards; outings; media; carrier and holding records; and every record that qualifies for "busy nearby".
- **Every recipe and every starter plan.** For each, I made my own one-adult judgment about positions, reach, what a baby could grab, and hazards.
- **Code:**
  - `src/lib/supervision.ts`, `planner.ts`, `share.ts`, `reconcile.ts` and `filters.ts` (the parts on media, energy and busy-nearby gating).
  - `TummyTimeGuide.tsx`, `Details.tsx` (MediaNote), `AboutView.tsx`, `ShareDialog.tsx`, `SharedView.tsx`, `PlanEditor.tsx` (tummy tally) and `export/render.ts`.

**Sources opened:** 42 source pages, each fetched once, plus the CPSC Public Playground Safety Handbook PDF.

- 35 pages were read as raw page text: AAP/HealthyChildren (23 pages), HSE (5), NHS, NICHD, WHO, SickKids/AboutKidsHealth, Children's Wisconsin, Canadian Paediatric Society (CPS), UK Best Start in Life, Fred Rogers Productions and Healthdirect.
- 6 pages blocked scripted download (HTTP 403) and were read through the fetch tool, which returns quoted extracts. These were CDC Positive Parenting: Infants, and CDC Milestones at 2 months, 30 months and 5 years; the CPSC 2017 sling release; and ZERO TO THREE Play Activities for 12–24 Months.

**Claims checked:** about 117 claims against the cited passage.

- All 23 core claims, including every tummy-time target and every media claim.
- Every `safety` and `recommendation` claim used by the high-risk records in A, B, C and D.
- All E media claims.
- About 40 further description and safety claims spread across A–F and mix.

That count includes the fetch-tool sources the authors flagged: CDC (5 pages), CPSC (sling release, playground handbook) and ZERO TO THREE (7 activities).

**Limits**

- The AAP *Pediatrics* article "Digital Ecosystems, Children, and Adolescents" was not read (paywall/403). Only AAP's parent-facing news item and explainer were read.
- The CDC, CPSC-sling and ZERO TO THREE passages were seen only as fetch-tool extracts. The extracts matched the authors' paraphrases.
- I did not run the app or inspect rendered screens.

## Findings

Severity:

- **Blocker:** unsafe or clearly unsupported. Must fix before release.
- **Major:** misleading or materially overstated.
- **Minor:** clarity or wording.

Quotes are exact record text unless marked as a paraphrase.

### Blocker

| ID | Record / claim / file | Problem | Evidence (source passage, URL) | Suggested fix |
|---|---|---|---|---|
| B1 | `act.busy-basket-gated-space` (D) adaptation: "Toddler and baby: a separate basket for the baby, and nothing small enough for a baby's mouth in either."<br>`act.pretend-kitchen-cook` (E) adaptation: "Baby nearby: give the baby their own wooden spoon and bowl beside the 'kitchen'."<br>`act.push-toy-laps` (D) adaptation: "Baby crawling nearby: keep the baby out of the push path or give the toddler a separate space." | All three records qualify for busy nearby (`watches`/`same-room`/`none`). The Finder describes that mode as "like cooking". Each adaptation puts a baby in the toddler's space while the only adult is at the stove. That is an uncurated two-child setup that bypasses the mixed-age feasibility review. It contradicts the mix workstream's own rule and the About page ("Two-child ideas come only from curated pairings that were checked for one adult's supervision"). With the parent's hands on hot pans, the toddler and baby are effectively together without an adult who can step in. | Healthdirect (AU): "Never leave a toddler alone with a baby. They may be tempted to share their food, which could choke the baby, or rock the pram…" (https://www.pregnancybirthbaby.org.au/toddler-and-the-new-baby).<br>AAP: "Many choking incidents happen when older brothers or sisters give dangerous foods, toys or small objects to a younger child" (https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx).<br>AAP 1–2 yrs: "A safer place for your child while you are cooking… is the playpen, crib, or stationary activity center" (https://www.healthychildren.org/English/ages-stages/toddler/Pages/safety-for-your-child-1-to-2-years.aspx). | Delete the three adaptations. If a sibling line is wanted: "Baby at home too? Keep the baby in their own play yard, apart from the toddler, or choose a two-child idea." Then add a validator or test rule: adaptations on busy-nearby records may not introduce a second child. |
| B2 | `act.preschool-playground` (F, 36m–60m) adaptation: "Confident child: monkey bars with you spotting." | It invites 3-year-olds onto overhead (horizontal) ladders. The US playground standard says not to. The record's own supporting claim (`clm.f.playground-preschool`) places CDC's monkey-bar tip at 5 years. Falls from upper-body equipment are a leading playground injury. | CPSC Handbook §5.3.2: "Four-year-olds are generally the youngest children able to use upper body devices… horizontal ladders should not be used on playgrounds intended for toddlers and 3-year-olds." Table 1 says preschool horizontal ladders should be no higher than 60 in, for ages 4–5 (https://www.cpsc.gov/s3fs-public/325.pdf).<br>CDC 5 yrs: "help her play on the monkey bars" (https://www.cdc.gov/act-early/milestones/5-years.html). | Reword to: "From age 4: low, preschool-height monkey bars with you spotting underneath. Not for 3-year-olds." Better still, split by age or gate it on ≥ 48m in the copy. |

### Major

| ID | Record / claim / file | Problem | Evidence (source passage, URL) | Suggested fix |
|---|---|---|---|---|
| M1 | **Sun wording, under 6 months.**<br>`act.stroller-stroll-point-and-name` and `act.shade-sit-outdoors` (A): "Avoid midday sun."<br>`act.shaded-stroller-walk` (B): "…Sunscreen only on small areas if there's no shade."<br>Claims `clm.a.sun-under-6m` ("avoid the strongest sun from 10 a.m. to 4 p.m.") and `clm.b.sun-under-6-months`. | AAP's newer page (2026) is stricter, and `docs/research.md` says Trunk follows the stricter reading. The record text does not. "Avoid midday sun" understates "don't be outside 10–4". B's sunscreen line implies an unshaded outing is acceptable with sunscreen. That line comes from the older 2024 page, and the 2026 page restricts sunscreen to 6 months and older. | AAP *Baby Sunburn Prevention* (updated 2026-04-13): "Babies younger than 6 months should be kept out of direct and indirect sunlight entirely because of the risk of heat stroke… Avoid having a baby outside between 10 a.m. and 4 p.m." (https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Baby-Sunburn-Prevention.aspx).<br>The 2024 *Sun Safety* page permits sunscreen on small areas if shade and clothing aren't available (https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Sun-Safety.aspx). | Use one shared safety line on every under-6-month outdoor record: "AAP (2026): keep babies under 6 months out of direct and indirect sun because of heat-stroke risk, and don't go out between 10 a.m. and 4 p.m. Go early or late, in full shade and covering clothes; skip it on hot days." Remove the sunscreen sentence from B, or move it to the claim caveat as the older page's position. |
| M2 | **Sun-rule enforcement**, `src/lib/planner.ts` and related code | Four gaps. (a) `inMiddaySun(window - remaining)` tests only the segment's start, so a 45-minute walk starting at 09:45 runs into 10:00–16:00. (b) The rule is not applied in the plan editor (add, reorder, resize), to starter plans (`starterFits`/`reconcileSegments`), or to imported share links. (c) The rule keys on the `sun-weather` hazard, so under-6-month records with `places: outdoors` and no such hazard are never filtered: `act.tummy-time-lap`, `act.tummy-time-reach-and-play`, `act.coo-and-copy-chat`, `act.read-aloud-anything`, `act.pat-a-cake-touch-rhymes`, `act.rattle-track-and-grab`, `act.babble-copycat-chat`, `act.body-part-action-song`, `act.bold-picture-lap-book`, `act.peekaboo-hands`, and the recipe `mix.action-song-circle` ("shaded grass"). (d) Recipes read only the younger activity's hazard. `docs/research.md` says "the planner never schedules them between 10 a.m. and 4 p.m.", which overstates what the code does. | Same AAP passage as M1. Code reading: `planner.ts` lines with `inMiddaySun(window - remaining)` and `sun: a.hazards.includes('sun-weather') && …`. | Test the whole interval `[start, start+setup+minutes+cleanup)` against 10:00–16:00. Run the same check, with a visible warning, in the editor, starter-plan loading and share import. Add `sun-weather` and a shade note to under-6-month records that allow outdoors, or drop `outdoors` from them. Correct the research.md sentence. |
| M3 | **"Busy nearby" floor records with no kitchen exclusion:** `act.play-gym-mat-gazing` (1w–4m), `act.play-gym-bat-and-grab` (3–5m), `act.toe-catch-back-play` (4–7m), `act.push-toy-laps` (12–24m), `act.fill-and-dump-relay` (15–24m) | `FinderView.tsx` explains busy nearby as "like cooking". These records put a baby on the floor, or a mobile toddler "in the room you're in", with no "not in the kitchen while you cook" constraint. That makes a baby on the kitchen floor, or a toddler underfoot, possible while hot pans are carried. Sibling records already carry the constraint: `act.chore-chat-from-the-mat` ("no cooking, hot drinks…"), `act.play-yard-in-view` and `act.busy-basket-gated-space`. | AAP 1–2 yrs: "The kitchen is a dangerous place for your child during meal preparation… It's best to keep your child out of the kitchen while cooking" (URL in B1).<br>AAP *Kitchen Safety*: "Whenever you have to walk with hot liquid… be sure you know where your child is, so you don't trip over them" (https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Kitchen-Safety.aspx). | Add to each record's `supervision.space`: "If you're cooking: outside the cooking area and out of your path with hot pans or drinks." Also show that line on every busy-nearby card. |
| M4 | **Playgrounds marked shareable:** `act.playground-toddler-area` (12–24m), `act.preschool-playground-area` (24–36m), `act.preschool-playground` (36–60m) are `shareable: true` | Each record's own space field requires arm's reach "whenever they're off the ground". Because they are shareable, the card does not show "Needs your full attention" (`labels.ts` `attentionNote`), and the validator would accept them in parallel recipes. The mix author's own note says "One adult can't spot tall equipment and mind a baby at once." | AAP *Playground Safety*: "lack of supervision is linked with nearly half of playground-related injuries… keep an eye on the action" (https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Safety-on-the-Playground.aspx).<br>CPSC Handbook §2.2.7: toddlers and preschoolers need more attentive supervision (URL in B2). | Set `shareable: false`. The curated together recipe `mix.playground-stroller-spotting`, which keeps the child on low equipment, can stay. |
| M5 | **Outdoor chase games leave out traffic:** `act.big-ball-kick-and-chase`, `act.bubble-pop-outside` (D); `act.red-light-green-light`, `act.throw-catch-kick`, `act.copycat-moves` (F); `act.follow-the-leader-parade` (E) | Spaces include `yard-or-park` (any park), proximity is `same-room`, `shareable: true`, and `traffic` is not listed. Three of the records (`act.big-ball-kick-and-chase`, `act.red-light-green-light`, `act.throw-catch-kick`) even cite street-safety claims in their safety text. That defeats the "traffic is never shareable" rule. A child chasing a ball or bubbles across an unfenced lawn is the classic run-into-the-road scenario. | AAP 2–4 yrs: don't let a young child play in the street; driveways are dangerous (https://www.healthychildren.org/English/ages-stages/toddler/Pages/Safety-for-Your-Child-2-to-4-Years.aspx).<br>CDC Preschoolers: tell the child not to play in the street or run after stray balls (https://www.cdc.gov/child-development/positive-parenting-tips/preschooler-3-5-years.html).<br>AAP Pedestrian: small children should not play on or next to driveways (https://www.healthychildren.org/English/safety-prevention/all-around/Pages/pedestrian-safety-tips-for-families.aspx). | Outdoors, require "a fenced yard or fully enclosed play area" in `supervision.space`. If unfenced parks stay allowed, add `traffic`, which makes the record non-shareable, and use arm's reach for under-3s. Better: split indoor and outdoor variants. |
| M6 | **Parallel recipes:** `mix.blanket-and-red-light` (6–12m on grass + 36–60m running) and `mix.blanket-and-bubbles` (6–12m + 12–30m chasing bubbles "downwind, away from the baby") | One adult sits within arm's reach of a baby who mouths things on grass, while the other child runs away from the adult. The space allows a "park lawn". If the older child runs toward a road, pond or exit, the adult either leaves a mouthing baby on the grass or doesn't follow. Bubbles blown downwind deliberately draw a 1-year-old away. The recipes pass `checkParallel` only because the chase activities are under-labelled (see M5). | Same sources as M5.<br>AAP choking: babies mouth small objects (URL in B1).<br>`clm.c.yard-hazards`, recipe safety text. | Restrict both to a fenced yard or fully enclosed area. Blow bubbles short range so the toddler stays within a few steps. Add the stop rule: "If the older child heads off, pick up the baby and follow; never leave the baby on the blanket." |
| M7 | **Held infant + moving toddler:**<br>`mix.newborn-sway-toddler-dance` (1w–4m held; "Stands or sits", while a 15–30m toddler dances).<br>`mix.slow-dance-follow-the-leader` (adult "follows a step or two behind the toddler, holding the baby in both arms") | Trip and collision risk while carrying an infant. The recipes' own stop cues, "Toddler running into you" and "turning back into you", show the risk is expected. Telling a 15-month-old to stay in a "marked patch" is not a reliable control. | NHS: "Watch where you're putting your feet while carrying your baby. It's easy to trip over something like a toy" (https://www.nhs.uk/baby/first-aid-and-safety/safety/baby-and-toddler-safety/).<br>AAP *Kitchen Safety* (trip-over-child warning, URL in M3). | Newborn recipe: the adult sits on a sofa or chair and sways from the waist; the toddler dances in front. Parade: the adult stands or sits at the centre and sways in place while the toddler marches the loop. Never walk behind a toddler while holding a baby. Apply the same seated default to `act.held-slow-dance` when another child is present. |
| M8 | **Preterm and carriers, softened:**<br>`act.home-tour-in-arms` (A) readiness: "Under 4 months, born early, or breathing concerns? Ask your clinician before using a carrier or sling", with safety "Take extra care".<br>`act.shaded-stroller-walk` (B): "Born early or breathing problems? Ask your baby's clinician before using an upright carrier."<br>Claim `clm.a.carrier-young-preterm`: "Take extra care and ask your clinician first". | The US default is a "should not", not "ask first". The A note also tells every user of a 1w–4m record to consult a clinician, which over-medicalizes healthy term babies while under-stating the rule for preterm babies. | AAP *Baby Carriers* (2025): "Infants born prematurely or with respiratory problems should not be placed in backpacks or other upright positioning devices, as the positioning… may make it harder for them to breathe" (https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Baby-Carriers.aspx).<br>CPSC 2017: be cautious with slings under 4 months (fetch-tool extract). | "Born early or breathing problems: AAP advises against upright carriers and slings. Carry your baby in your arms unless their clinician has cleared a carrier. Under 4 months: take extra care (CPSC); follow TICKS and check often." Keep HSE's "extra care" wording as labelled Irish guidance in the caveat. |
| M9 | **Bath water play:** `act.splash-and-pour` (C, 6–12m, bath or basin): "Stay within arm's reach, hand ready, every second."<br>Claim `clm.c.water-touch-supervision`: "keep a hand on or within arm's reach" | For an infant in a bath, AAP's instruction is touch supervision with a hand on the baby. The record keeps "one hand on their back" only as an adaptation for less steady sitters. | AAP *Infant Water Safety*: "Use touch supervision. Have a towel and other bath supplies within reach so you can keep a hand on your baby at all times… bring your baby with you… even if you are using a supportive infant tub or bath seat" (https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Infant-Water-Safety.aspx). | For infants: "Keep a hand on your baby the whole time ('touch supervision')". Make that the main step, not an adaptation. Tighten the claim text to match. For the toddler and preschool water records, see m14. |
| M10 | **Screen while cooking:** `act.calm-show-while-you-cook` (E). Why: "HSE recognizes screens can feel easier while cooking; UK and Irish guidance favor calm, slow-paced shows…". Evidence also lists `clm.e.uk-2026-limits` and `clm.e.hse-busy-cooking`. | Two of the cited jurisdictions advise against this exact setup, a child watching alone. HSE's cooking passage offers alternatives to a screen, not support for one. Citing them as the "why" claims support the sources don't give. The US default supports the record better. | HSE: "You may find it easier to let your child have screen time if you are busy, for example, cooking a meal. But there are other things you can do… give your child a toy… involve them". For 2–5 years: "Make sure to choose something you can watch or play together" (https://www2.hse.ie/babies-children/play/screen-time/).<br>UK (2026): "Avoid young children using screens alone" (https://beststartinlife.gov.uk/screen-time-under-5s/).<br>US: AAP 5 Cs, "Keep screens for regular times of day" (https://www.healthychildren.org/English/family-life/Media/Pages/kids-and-screen-time-5-cs-questions-for-toddlers-and-preschoolers.aspx); CDC 30 mo, "no more than 1 hour per day of a children's program with an adult present" (https://www.cdc.gov/act-early/milestones/30-months.html). | Rewrite the why around the US sources: a regular time, a quality show, autoplay off, about an hour a day with an adult present. Add a labelled jurisdiction note: "Irish and UK guidance advise watching together rather than alone; if you follow it, choose 'Watch one together'." Drop HSE and UK from this record's supporting evidence, or show them as contrasting guidance. |
| M11 | **Tummy-time tally:** `PlanEditor.tsx` `tummyTally` | It counts every planned minute of a floor tummy-time segment as "min on a flat floor surface". The records themselves include rests on the back: the core floor record step 4 says "Roll them onto their back for a rest", and the mix tummy recipes say "the restaurant can stay open" after the baby rests. A family tracking a clinician's flat-surface target, such as the reported CHOP 60 min/day, would over-count. Held and propped time is correctly excluded. | Code reading.<br>HSE: from 3 months babies may stay on their tummy "5 to 10 minutes at a time (or longer)" (https://www.hse.ie/babies-children/parenting-advice/caring-for-a-new-baby/tummy-time/). | Relabel as "up to N min of floor tummy time planned; count only the time your baby actually spends on their tummy." Optionally show the planned range, not a single figure. |

### Minor

| ID | Record / claim / file | Problem | Evidence / note | Suggested fix |
|---|---|---|---|---|
| m1 | `share.ts` `reconcile`; `SharedView.tsx` | Import re-checks age, retirement, pairing and duration. But it re-checks against the sender's adult count (`compact.o[3]`) and with empty readiness ("not yet") flags, and the preview never shows how many adults the plan assumes. No current record needs two adults, so this is latent. The dialog's "checked against Trunk's current safety rules" is broader than what happens: no sun timing, no readiness. | Code reading. | Show "Planned for N adult(s)" in the preview. Re-check using the recipient's adult count, defaulting to 1, and their saved readiness. Narrow the dialog sentence to "checked against Trunk's current age and pairing rules". |
| m2 | `export/render.ts` | Exported images show only `safety[0]`. For some records the first note isn't the critical one. In `act.preschool-playground` the arm's-reach note is second. In `act.sit-down-snack-together` the high-risk-foods note is dropped. | Code reading. | Order every record's safety notes most-critical first (add a test), or render all serious-hazard notes. |
| m3 | `PlannerView.tsx` `starterFits`; `AboutView.tsx` | `plan.dinner-prep-hour` contains media, and it is offered whatever energy the parent chose: `starterFits` uses `energy: 'plenty'` and reconcile doesn't gate media. That contradicts the About page: "only when you say you're busy nearby or low on energy". | Code reading. | Gate starter plans that contain media by `mediaAllowed`, or soften the About sentence. |
| m4 | Planner pool | `act.sit-down-snack-together` (food) is eligible for auto-generated plans by default, because readiness flags are opt-in. Policy: "a snack is not a universal activity". | `content-policy.md` (Food). | Exclude records with the `food` hazard from auto-generation unless the parent adds them. Keep them in the Finder and in starter plans. |
| m5 | `mix.tummy-time-book-helper`, `mix.tummy-time-picture-show`, `mix.tummy-time-and-pretend-kitchen` safety: "It counts toward a flat-surface target only if your baby's clinician set one; Trunk sets no target." | Confusing, and it conflicts with `TummyTimeGuide`, which lists public targets. | — | "This is floor tummy time on a flat surface, the position flat-surface targets count. Follow any target your baby's clinician gave you." |
| m6 | `TummyTimeGuide.tsx` | No "awake and closely supervised only" line. Naming CHOP, even with a disclaimer, may read as an institutional protocol and reveals a family's care provider. The CHOP framing itself is correct: "individualized guidance… not a public CHOP standard, and not a rule for every baby". | `content-policy.md` (Tummy time). | Add "Tummy time is only for an awake baby with an adult watching." Consider "their hospital's neonatal team" in place of "CHOP". |
| m7 | `act.toddler-action-songs` (D) | Supervision is `leads/same-room/none`, but the steps and safety text put the child on your lap. | — | Proximity `arms-reach`. |
| m8 | `act.put-in-tip-out` (C) adaptation: "posting big jar-free lids" | Unclear phrase. "Big lids" small enough to post must still pass the toilet-roll test. | — | "…posting large jar lids or balled-up socks (each too big to fit through a toilet-paper tube)". |
| m9 | `act.library-story-time` (`shareable: true`), `act.bucket-swing`, the three playground records | The safety text names parking lots and roads, but `traffic` isn't in the hazard list. | Policy: outdoors, name traffic "where it applies". | Add `traffic`, or a getting-there safety note that is kept apart from the activity's shareability. |
| m10 | `act.preschool-playground-area`, `act.preschool-playground` why: "exercise their bodies, brains and social skills" | Brain language. It is a faithful quote of AAP, but the policy asks to avoid it. | AAP *Playground Safety* (URL in M4). | "a chance to move, think and play with others". |
| m11 | `act.playdough-squish-and-shape` (F) | Says "Playdough" without "store-bought". E's playdough record follows Poison Control's advice against homemade raw-flour dough. | Poison Control: homemade play dough isn't safe because it contains raw flour (https://www.poison.org/articles/raw-flour-don-t-lick-the-spoon). | "Store-bought dough labelled for your child's age", matching E. |
| m12 | Second-child adaptations in non-busy single-child records: `act.toddler-led-walk`, `act.nature-find-walk` ("Baby too: …"), `act.shaded-stroller-walk` ("Older child along…"), `act.big-box-car-or-house` ("Two children…"), `act.library-story-time` ("Baby too…") | They bypass the curated recipes. In the traffic records they also contradict "traffic is never shareable". Curated equivalents now exist (`mix.newborn-stroll-toddler-walks`, `mix.shaded-walk-nature-find`, `mix.stroller-walk-toddler-hunt`). | — | Replace with a pointer to the two-child idea, or remove. |
| m13 | `mix.tummy-time-and-pretend-kitchen` | The toddler "delivers 'food' to you at the mat's edge", carrying pots next to a baby's head at floor level. | — | "You sit between the table and the mat; the toddler delivers to your side, never to the mat." |
| m14 | `act.water-scoop-tub` (D), `act.paint-with-water-outside` (E), `act.wash-fruit-and-veg`, `act.plant-and-water-seeds` (F) | They say "arm's reach with full attention", which is right, but drop AAP's term "touch supervision". | AAP toddlers: "staying within arm's length, providing constant 'touch supervision'" (https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Water-Safety-And-Young-Children.aspx). | Add "(AAP: 'touch supervision')" to the shared water line. |
| m15 | `mix.stroller-walk-toddler-hunt` younger adaptation: "Wants out? Let them out only in a fenced, traffic-free spot…" | It creates two mobile children outdoors with one adult mid-walk, and is not covered by the recipe's supervision plan. | — | "…pause the walk there and stay within reach of both, or keep the baby buckled." |
| m16 | `act.stroller-stroll-point-and-name` (A): "move them… once you're home" | AAP says to move a sleeping baby "as soon as possible", not "once you're home". | AAP *Safe Sleep*: "move them to a firm sleep surface on their back as soon as possible" (https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/A-Parents-Guide-to-Safe-Sleep.aspx). | "as soon as you can (head home or to a flat, safe sleep space)". |
| m17 | `act.grass-blanket-explore` (C) adaptation: "try a few minutes on their tummy facing you" | Tummy time without a `tummyTime` position, a flat-surface statement, or an awake-and-supervised note. | Policy: each tummy-time record states its position. | Remove it, or add "awake, with you right there; grass isn't a firm, flat mat". |
| m18 | `docs/research.md` tummy table | The NICHD row says positions are "Floor, chest, lap; includes a rolled towel under the chest". The NICHD page lists a floor blanket and "a rolled-up towel under baby's arms", not chest or lap. | NICHD (https://safetosleep.nichd.nih.gov/reduce-risk/tummy-time). | Correct the row. |
| m19 | `docs/research/e.md` | "Never at meals, and never to calm an upset child. All five frameworks agree on this." AAP 5 Cs, HSE and CPS say this; the CDC and WHO pages read do not address calming. | Pages listed in M10. | "AAP, CPS and HSE advise against…" |
| m20 | `AboutView.tsx`: "Each source was opened and read on the date shown." | Several CDC, CPSC, ZERO TO THREE and Healthdirect pages were read only through a summarizing fetch tool, as the source `notes` and `research.md` disclose. | — | Add "(a few through a summarizing tool when the site blocked downloads; see notes)". |
| m21 | Tooling and validator | (a) `--check --only content/workstreams/mix.json` exited 0 while the file did not exist. (b) `checkParallel` compares only `places`, not `spaces` or rooms. (c) Together-mode recipes don't go through any one-adult check, though five combine non-shareable hazards: traffic in three stroller walks plus `mix.playground-stroller-spotting`, and food in `mix.seated-snack-for-two`. I reviewed all five by hand and accept them with the notes above. | Observed: the check ran before `mix.json` existed and printed "from 7 file(s)". | Fail `--only` when the file is missing. State in the contract that together recipes with water, heat, food or traffic need explicit full-attention roles, and add a test that they carry `handsOnFor: both`. |

## Recipes and starter plans

`mix.json` validated (exit 0) and was reviewed in full at sha256 `e6622c88…`.

### Together recipes (16)

| Recipe | Verdict |
|---|---|
| `mix.tummy-time-book-helper`, `mix.tummy-time-picture-show` | OK. Floor, adult in arm's reach, older child as playmate only. Supported by AAP: "While keeping watch, have a young child play with the baby while on their tummy." Wording fix m5. |
| `mix.newborn-sway-toddler-dance`, `mix.slow-dance-follow-the-leader` | **Change (M7).** Adult seated or in place; never walking behind a toddler while holding a baby. |
| `mix.newborn-stroll-toddler-walks`, `mix.shaded-walk-nature-find`, `mix.stroller-walk-toddler-hunt` | Acceptable as together recipes: full-attention adult, hand-holding near roads, the toddler never pushes the stroller (Healthdirect). The sun rule must actually be enforced (M1, M2). m15 for the "wants out" adaptation. |
| `mix.newborn-story-big-kid-reader`, `mix.baby-book-big-kid-story`, `mix.action-song-circle` | OK. The action-song circle allows "shaded grass" with a 4-month-old, so the M2(c) sun-gap applies. |
| `mix.diaper-change-helper` | OK. Floor mat, hand on baby, toddler fetches for the adult, sacks and creams up high. |
| `mix.two-toddlers-freeze-dance`, `mix.big-kid-leads-toddler-copies`, `mix.opposites-parade` | OK. |
| `mix.seated-snack-for-two` | OK. One adult seated within reach of both, the same safe food for both, no sharing. This answers the mix author's question: acceptable, provided a 12-month-old is in a strapped high chair next to the adult. |
| `mix.playground-stroller-spotting` | Acceptable as written. Low equipment only, stroller braked within reach, "save tall/monkey bars for a second adult". This answers the mix author's question: keep it, but set the underlying playground records to non-shareable (M4). |

### Parallel recipes (13)

| Recipe | Verdict |
|---|---|
| `mix.mat-and-table-side-by-side`, `mix.sofa-cuddle-sock-sort`, `mix.newborn-mat-teddy-meal`, `mix.newborn-mat-sock-match`, `mix.play-yard-and-color-sort`, `mix.treasure-basket-and-sock-match`, `mix.two-toddlers-blocks-and-puzzle`, `mix.toddler-blocks-big-kid-socks`, `mix.toddler-kitchen-big-kid-memory`, `mix.twin-quiet-table` | One adult can genuinely supervise both tracks. The adult sits between the children with the baby in view and the older child's materials kept away from the baby. No small parts are offered to under-3s. Note: the mats used by the newborn recipes still need the kitchen exclusion from M3. |
| `mix.tummy-time-and-pretend-kitchen` | OK with the delivery-route fix (m13). |
| `mix.blanket-and-red-light`, `mix.blanket-and-bubbles` | **Change (M6).** Fenced or enclosed space only, and never leave the baby to follow the runner. |

The new activity `act.held-slow-dance` (4–12m) is supported as an adaptation of AAP "Crocodile Rock": "Hold your baby securely, tummy down on your chest. Rock your body from side to side" (4–6 months). It correctly excludes AAP's bouncing ideas for older babies. With another child present it should default to seated (M7).

### Starter plans (6)

All segment minutes fall within each record's duration range. Totals below are segment minutes, then wall time including setup and cleanup.

| Plan | Total (min) | Verdict |
|---|---|---|
| `plan.gentle-newborn-hour` (3w) | 60 / 63 | Realistic. Tiny sessions, long breaks, a 3-minute floor tummy time, and a feed or nap can replace any piece. |
| `plan.rainy-afternoon-4m-28m` | 59 / 66 | Inherits M7 for its last segment (`mix.slow-dance-follow-the-leader`). |
| `plan.park-snack-playdough` (30m) | 65 / 90 | The 90-minute wall time is not obvious from the summary. Dough is store-bought per the E record. |
| `plan.dinner-prep-hour` (30m) | 55 / 68 | Called an "hour". Contains the optional show; inherits M10 and m3. All play segments are outside the cooking area. |
| `plan.saturday-morning-4-year-old` (48m) | 65 / 79 | OK. At 48 months, monkey bars would be within CPSC age guidance if attempted. |
| `plan.baby-and-preschooler-9m-4y` | 58 / 70 | Inherits M6 for `mix.blanket-and-red-light`. |

Suggest showing wall time, including setup and travel, in the starter-plan summaries.

## What looked solid

- **Core tummy-time records and claims.** Every target claim matches its source passage: AAP's 3–5 min, 2–3 times a day, working up to 15–30 min by 7 weeks; HSE's 30 then 60 minutes and flat mat from 3 months; Children's Wisconsin's 60 min by 4 months; SickKids' 50–60 min at corrected age; WHO's 30 min prone. Each is labelled with its jurisdiction, population and position scope and never blended. Chest, lap and propped positions are `flatSurface: false` and excluded from the flat tally. Awake-only handling and the move-to-back-for-sleep transition appear on every tummy, holding and carrier record. `TummyTimeGuide` keeps the reported CHOP instruction individualized.
- **Hazard handling.** No banned items appear anywhere: no water beads, button batteries, magnets, balloons, marbles or plastic bags. Swept terms such as bouncing, jiggling and shaking appear only as prohibitions; the AAP knee-bounce and balloon ideas were correctly left out. Choking guidance consistently uses the toilet-roll check, small-parts rules and AAP's under-4 high-risk foods list. Every water record and every food record is `shareable: false`. Changing and dressing happen on the floor with a hand on the baby. Cushion courses carry AAP's smothering warning.
- **Children never handle babies.** In all 29 recipes the older child is a playmate who never lifts, holds or feeds the baby. The Healthdirect and AAP suggestions that a toddler hold the baby were deliberately not adopted.
- **Media.**
  - E's media summary (`docs/research/e.md`) matches every source checked:
    - AAP 2026 news item and explainer: the new policy "replace[s] prior AAP guidance", has no hourly limit, and says babies under 18 months learn best from real-world interaction.
    - AAP 5 Cs (ages 2–4).
    - CDC: 1 hour a day with an adult present.
    - WHO 2019.
    - CPS: about 1 hour or less.
    - HSE: ideally no more than 1 hour, watched together.
    - UK 2026: about 1 hour, and avoid solo use.
  - Media appears only for children 24 months and older.
  - The Mister Rogers' Neighborhood statement is supported: the producer's show page lists "Ages: 2-4".
  - `MediaNote` says watching isn't equal to playing and doesn't replace supervision, and links a non-screen alternative.
- **Sharing defaults.**
  - The link contains no title, custom text or notes unless the sender opts in, and no names or birthdays.
  - The dialog says plainly "it isn't encrypted".
  - The payload sits in the URL fragment.
  - Decoding is size-limited and schema-validated.
  - The import preview flags dropped and adjusted items.
  - No network calls exist in `src/`.
- **Claim writing.** Paraphrases were faithful in essentially every passage checked. Caveats candidly record conflicts: HSE mobile-in-cot, AAP vs HSE kitchen advice, sunscreen pages, HSE homemade dough.

## Residual risks I could not resolve

- **Claims not opened:** about 130 of 248, mostly low-risk description claims behind `why` text in A–F. They were not individually opened.
- **Fetch-tool extracts only:** the CDC milestone and positive-parenting pages, the CPSC sling release and the ZERO TO THREE pages could be read only as extracts. The extracts matched, but full surrounding context was not seen.
- **AAP 2026 policy statement:** the *Pediatrics* article itself was not read (403). Media framing rests on AAP's own summaries.
- **The CHOP instruction** is unverifiable by design (reported family guidance). The app handles it as individualized.
- **Out-of-date source pages:** several pages are past their stated review dates (HSE play pages 2021, NHS "Help your baby learn to talk", AAP changing table and playpen 2009). They should be first in the next recheck.
- **Not inspected:**
  - Rendered UI and exported images were not visually inspected.
  - The busy-nearby banner copy was reviewed only in `FinderView.tsx` source.
- **Durations and effort** are editorial estimates. I flagged only implausible ones; none were implausible for age.
- **Later edits:** any change to `mix.json` or other content after sha256 `e6622c88…` / commit `4f8fc5b` is not covered.

## Resolution (lead, 2026-10-29)

Every Blocker and Major was fixed; Minors were fixed except where noted. Content validates, 106 unit tests and all browser journeys pass after the changes.

| ID | Resolution |
|---|---|
| B1 | Removed the three second-child adaptations; replaced with a pointer to the two-child ideas. New validator rule: single-child records may not add a second child (all nine other occurrences found by the rule were replaced too). |
| B2 | `act.preschool-playground`: monkey bars only "from age 4: low, preschool-height… not for 3-year-olds"; the arm's-reach note now leads. |
| M1 | One shared AAP-2026 line on every under-6-month outdoor record; sunscreen line dropped; both sun claims rewritten to the 2026 wording with the 2024 page as a caveat. Detail pages add the same line to any outdoor-capable activity viewed for a baby under 6 months, and to pairings whose younger role starts under 6 months. |
| M2 | New `src/lib/timeRules.ts`: whole-segment overlap check (a 09:45 + 45-minute walk is caught), applied when "Outside" is chosen as well as to outdoor-only ideas; used by the planner and, as visible warnings, by the plan editor and the share preview (so starter, edited, and imported plans are covered). `docs/research.md` wording corrected. |
| M3 | All six busy-nearby floor/mat records now carry "If you're cooking, set this up outside the cooking area and out of your path with hot pans." |
| M4 | The three playground records are `shareable: false` (and list `traffic` for the trip; see m9). |
| M5 | The six outdoor chase/ball games require a fenced yard or enclosed play area outdoors. |
| M6 | Both blanket recipes: fenced or enclosed only; new lead safety note "If the big kid runs out of reach, pick up the baby and follow. Never leave the baby on the blanket."; bubbles blown a short way downwind. |
| M7 | Both dance recipes: the adult sits or stands in one spot, sways in place, and never walks behind the toddler while holding the baby. |
| M8 | `clm.a.carrier-young-preterm` now states AAP's advice (no upright carriers for babies born early or with breathing problems), with HSE/CPSC "extra care" labelled separately; readiness notes on both records updated. AAP passage re-read 2026-10-29. |
| M9 | `act.splash-and-pour`: a hand on the baby the whole time is now a step and the lead safety note (touch supervision). |
| M10 | `act.calm-show-while-you-cook` "why" rests on AAP 5 Cs and CDC; Irish/UK preference for watching together is labelled in the "why" and the readiness note. |
| M11 | Tally reads "up to N min of floor tummy time planned" and asks parents to count only minutes actually on the tummy, awake and watched. |
| m1 | Share preview shows "planned for one/two adults"; share dialog sentence narrowed to catalog, age, and pairing rules. Re-checking against the recipient's readiness is not done (readiness flags are never shared). |
| m2 | Validator: records with serious hazards must lead with a sourced safety note; two records reordered. Exported images show the two leading notes for serious-hazard records. |
| m3 | Starter plans containing a screen option appear only in busy-nearby/low-energy contexts. |
| m4 | Food records are never auto-added to generated plans. |
| m5 | Tummy-time recipe wording replaced as suggested. |
| m6 | Guide now opens with "only for an awake baby with an adult watching"; the public example says "their hospital's neonatal team" (full reported context stays in the docs). |
| m7 | `act.toddler-action-songs` proximity → arm's reach. |
| m8 | Wording fixed as suggested. |
| m9 | `traffic` added (and `shareable: false`) for the library, bucket-swing, and playground outings; trip safety notes cite pedestrian guidance. |
| m10 | "Brains" wording replaced. |
| m11 | F playdough: store-bought dough labelled for their age. |
| m12 | Replaced (see B1). |
| m13 | Deliveries come to the adult's side, never onto the mat. |
| m14 | AAP's "touch supervision" named on the four water records. |
| m15 | Adaptation now pauses the walk and keeps the adult within reach of both, or keeps the baby buckled. |
| m16 | "As soon as you can." |
| m17 | Tummy adaptation removed from the grass blanket record. |
| m18 | NICHD row corrected after re-reading the page (blanket on the floor; rolled towel under the arms; 15–30 min/day by about 2 months). |
| m19 | Corrected in `docs/research/e.md`. |
| m20 | About page discloses that a few pages were read through a summarizing tool. |
| m21 | `--only` now fails for a missing file; new validator rule: together recipes with water/heat/food/traffic must have `adult.handsOnFor: "both"` (all five already did). Room-level (`spaces`) comparison in `checkParallel` is not added; parallel pairings are curated and reviewed by hand. |
