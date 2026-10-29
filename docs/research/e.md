# Workstream E research notes: children 24 to under 36 months, plus screen media

Owner: Workstream E. Content file: `content/workstreams/e.json`. Sources checked 2026-10-28.

## Summary

- **15 non-media activities.** All start at 24m (the sticker picture starts at 30m). Six end at 36m and nine run to 48m. The six that end at 36m are the ideas Workstream F covers from 36m with its own record.
- **1 seated snack routine:** `act.sit-down-snack-together`, 12m–60m. Its evidence type is practical and it has no developmental goals.
- **2 media records.** These are the catalog's only `kind: "media"` records. Both run 24m–60m, have no goals, have evidence type "adapted", and cite current media guidance from the US, Canada, Ireland, the UK and WHO.
- **6 busy-nearby-compatible records**, meaning the adult watches from the same room, hands are free, the record is shareable, and there are no water, heat, food or traffic hazards. Five are play or routine records; the sixth is the cooking-time media record.
- **New registrations:** 15 sources and 32 claims (`clm.e.*`). I also reuse sources and claims from core, C and D.
- `node scripts/build-catalog.ts --check --only content/workstreams/e.json` exits 0.

## Method

- I opened every registered source myself, through the fetch tool or with curl and `pdftotext` for the CPSC PDF. CDC pages were read through the fetch tool, as Workstream D did.
- Claims paraphrase the passage named in `locator`. Durations, setup times and effort levels are editorial estimates.
- After reading, I reworded the two load-bearing passages for the cooking option against the page text: HSE's "busy, cooking a meal" line and AAP's "find something safe for your child to do while you are cooking".
- Where an idea overlapped Workstream D (12–24m) or Workstream F (36–60m), I either gave my record a different design or limited its age range (see Coordination).

## Activities

| ID | Ages | Readiness | Supervision (participation / proximity / hands) | Shareable | Busy-nearby | Hazards | Evidence |
|---|---|---|---|---|---|---|---|
| `act.pretend-kitchen-cook` | 24m–48m | none | watches / same-room / none | yes | **yes** | none | described |
| `act.big-box-car-or-house` | 24m–48m | none | watches / same-room / none | yes | **yes** | sharp, mouthing | described |
| `act.playdough-squish-and-roll` | 24m–36m | no-longer-mouthing | joins / arms-reach / intermittent | yes | no | mouthing, allergens | described |
| `act.paint-with-water-outside` | 24m–48m | none | joins / arms-reach / intermittent | **no** (water) | no | water, sun-weather | adapted |
| `act.chalk-drawing-outside` | 24m–48m | none | joins / arms-reach / intermittent | **no** (traffic) | no | traffic, mouthing, sun-weather | described |
| `act.follow-the-leader-parade` | 24m–36m | walks | leads / same-room / none | yes | no | falls | described |
| `act.floor-obstacle-course` | 24m–48m | walks | joins / arms-reach / intermittent | no (spotting) | no | falls | adapted |
| `act.color-sort-bowls` | 24m–36m | none | watches / same-room / none | yes | **yes** | mouthing | adapted |
| `act.carry-to-the-table-helper` (routine) | 24m–36m | walks | joins / same-room / intermittent | yes | no | none | described |
| `act.wipe-the-table-helper` (routine) | 24m–48m | none | watches / same-room / none | yes | **yes** | none | adapted |
| `act.who-what-where-book-chat` | 24m–36m | none | leads / arms-reach / none | yes | no | none | described |
| `act.library-story-time` (outing) | 24m–48m | none | joins / arms-reach / intermittent | yes | no | none | described |
| `act.preschool-playground-area` (outing) | 24m–36m | walks, climbs | joins / arms-reach / intermittent | yes | no | falls, sun-weather | described |
| `act.nature-find-walk` (outing) | 24m–36m | walks | joins / arms-reach / intermittent | **no** (traffic) | no | traffic, sun-weather, mouthing, falls | described |
| `act.big-sticker-picture` | 30m–48m | no-longer-mouthing | watches / same-room / none | yes | **yes** | mouthing | adapted |
| `act.sit-down-snack-together` (routine) | 12m–60m | eats-solids | joins / arms-reach / intermittent | **no** (food) | no | food, allergens | practical |
| `act.calm-show-while-you-cook` (media) | 24m–60m | none | watches / same-room / none | yes | **yes** (media) | none | adapted |
| `act.watch-one-together-and-talk` (media) | 24m–60m | none | joins / arms-reach / none | yes | no | none | adapted |

Design notes:

- **Snack.** It sits at the table, a bench or a blanket. It has `food` and `allergens` hazards, the `eats-solids` readiness ability, and arm's-reach supervision. It is not shareable, and it does not use `parent-moment`.
  - The steps never name foods. The specific high-risk choking foods appear only in a safety note that cites `clm.e.high-risk-foods-under-4`.
  - One adaptation is "After the playground: sit on a bench", so the snack can follow the playground in a plan.
  - I set the range to 12m–60m because a seated, supervised snack applies across ages. The lead may want to narrow it.
- **Calm show while you cook.** The child sits outside the cooking area, in view, and the adult checks often.
  - A safety note says the show doesn't replace supervision.
  - The steps cover choosing one calm episode, turning off autoplay, switching off at the end, and one question about the show at dinner.
  - Mister Rogers' Neighborhood appears only as an example, with the producer's 2–4 age listing. Nothing is said about where to watch it or what children learn.
- **Watch one together and talk.** The adult co-views at arm's reach, pauses to talk about feelings, then does one related activity afterward (sing the song, draw, or act it out).

### Coordination with Workstreams D and F

- **Workstream D (to 24–30m)** covers freeze dance, action songs, chunky puzzles, the sock basket, feed the teddy, the toddler-led walk, the toddler playground area, the water tub, and a busy basket that includes board books.
  - I did not repeat these.
  - My pretend kitchen is open-ended cooking, not D's teddy feeding.
  - D's notes suggested chunky crayon drawing for E. It appears here as chalk drawing, the sticker picture and the box decorating.
- **Workstream F (36–60m)**, written at the same time, has its own versions of five of my ideas: copycat moves, the preschool playground, the nature hunt, sock match and sort, and playdough. F also has a 36–60m `act.set-the-table-helper`.
  - To avoid near-duplicate suggestions at 36–48m, I narrowed my matching records to 24m–36m.
  - I renamed my table helper `act.carry-to-the-table-helper` (24m–36m), so it no longer collides with F's ID. It was never published under the old ID.
- **Shared sources with F.** F also registered `src.cdc.milestones-3-years` and `src.aap-hc.safety-2-to-4-years`, with the same IDs and URLs as mine. Because `e.json` loads first, the validator reported the duplicates in `f.json`. When I last ran the full check, those errors no longer appeared.
  - F should reference my registrations rather than re-register them.
  - Keep these IDs as they are.

## Sources consulted

### Registered in `e.json`

| ID | Organization | Jurisdiction | URL | Checked | Page date |
|---|---|---|---|---|---|
| `src.aap-hc.new-media-recommendations-2026` | AAP (HealthyChildren.org) | US | https://www.healthychildren.org/English/news/Pages/creating-a-child-friendly-digital-world-AAP-releases-new-media-recommendations.aspx | 2026-10-28 | published 2026-01-20 |
| `src.aap-hc.5cs-toddlers-preschoolers` | AAP (HealthyChildren.org), Center of Excellence on Social Media and Youth Mental Health | US | https://www.healthychildren.org/English/family-life/Media/Pages/kids-and-screen-time-5-cs-questions-for-toddlers-and-preschoolers.aspx | 2026-10-28 | updated 2024-04-30 |
| `src.cdc.milestones-30-months` | CDC, Learn the Signs. Act Early. | US | https://www.cdc.gov/act-early/milestones/30-months.html | 2026-10-28 | published 2025-09-04; updated 2026-05-16 |
| `src.cdc.milestones-3-years` | CDC, Learn the Signs. Act Early. | US | https://www.cdc.gov/act-early/milestones/3-years.html | 2026-10-28 | published 2025-09-04; updated 2026-05-16 |
| `src.cdc.positive-parenting-toddlers-2-3` | CDC | US | https://www.cdc.gov/child-development/positive-parenting-tips/toddlers-2-3-years.html | 2026-10-28 | 2026-01-29 (only date shown) |
| `src.aap-hc.safety-2-to-4-years` | AAP (HealthyChildren.org), from TIPP © 2019 | US | https://www.healthychildren.org/English/ages-stages/toddler/Pages/Safety-for-Your-Child-2-to-4-Years.aspx | 2026-10-28 | updated 2022-09-29 |
| `src.cps.screen-time-preschool` | Canadian Paediatric Society (Digital Health Task Force) | CA | https://cps.ca/en/documents/position/screen-time-and-preschool-children | 2026-10-28 | posted 2022-11-24 |
| `src.cps.screen-use-young-children` | Canadian Paediatric Society (Caring for Kids) | CA | https://caringforkids.cps.ca/handouts/behavior-and-development/screen-time-and-young-children | 2026-10-28 | updated 2025-03 |
| `src.hse.screen-time` | Health Service Executive | IE | https://www2.hse.ie/babies-children/play/screen-time/ | 2026-10-28 | reviewed 2024-05-02 (next review 2027-05-02) |
| `src.gov-uk.screen-time-under-5s` | UK Government, Best Start in Life | UK | https://beststartinlife.gov.uk/screen-time-under-5s/ | 2026-10-28 | updated 2026-06-29 |
| `src.fredrogers.mister-rogers-neighborhood` | Fred Rogers Productions | US | https://www.fredrogers.org/production/mister-rogers-neighborhood/ | 2026-10-28 | none (© 2026 footer) |
| `src.hse.types-of-play` | Health Service Executive | IE | https://www2.hse.ie/babies-children/play/types-of-play/ | 2026-10-28 | reviewed 2026-08-11 (next review 2029-08-11) |
| `src.hse.playdough` | Health Service Executive | IE | https://www2.hse.ie/babies-children/disabilities/play/playdough/ | 2026-10-28 | none shown |
| `src.poison-control.play-doh` | National Capital Poison Center (Poison Control) | US | https://www.poison.org/articles/playdoh | 2026-10-28 | none (© 2012–2026) |
| `src.poison-control.raw-flour` | National Capital Poison Center (Poison Control) | US | https://www.poison.org/articles/raw-flour-don-t-lick-the-spoon | 2026-10-28 | none (cited sources accessed July 2026) |

HSE dates are day/month/year on the page (for example, "02/05/2024" is 2 May 2024).

### Reused from other files (passages re-read where my claims cite them)

- **Core:**
  - `src.who.sit-less-play-more-2019`, with `clm.core.who-screen-under-5`, `clm.core.who-active-play` and `clm.core.who-reading-storytelling`.
  - `src.aap-hc.digital-ecosystem-explained` (updated 2026-06-03; I re-read it), with `clm.core.aap-coview-quality`.
- **Workstream C:**
  - `src.aap-hc.choking-prevention` (updated 2026-02-27; I re-read it for the snack claims).
  - `src.aap-hc.playground-safety` (updated 2025-03-31; re-read).
  - `src.cpsc.public-playground-handbook` (2010 edition; I read Definitions, §2.2.7 and Table 1).
  - Claims `clm.c.toilet-roll-test` and `clm.c.choking-small-objects`.
- **Workstream D:**
  - `src.cdc.milestones-2-years` (re-read for the screen, art, chores and mealtime tips).
  - Claims: `clm.d.pretend-play`, `clm.d.simple-objects-play`, `clm.d.helping-tasks`, `clm.d.water-sand-pouring`, `clm.d.water-touch-supervision`, `clm.d.sun-protection`, `clm.d.pedestrian-safety`, `clm.d.small-parts-under-3`, `clm.d.older-siblings-small-objects`, `clm.d.household-products`, `clm.d.anchor-furniture`, `clm.d.falls-gates-furniture`, `clm.d.kitchen-while-cooking`, `clm.d.child-led-walks` and `clm.d.outdoor-play-senses`.

### Consulted but not registered

| Page | Result | Why not registered |
|---|---|---|
| AAP Pediatrics, "Digital Ecosystems, Children, and Adolescents" (157(2):e2025075320) | HTTP 403 | Not read. I rely on AAP's HealthyChildren summaries. |
| AAP Pediatrics, "Media and Young Minds" (2016) | HTTP 403 | Not read. |
| HealthyChildren "Where We Stand: Screen Time" (`Where-We-Stand-TV-Viewing-Time.aspx`) | HTTP 404 (curl confirmed) | This was the older AAP age-limit summary; it is no longer published at that URL. |
| HealthyChildren "Healthy Digital Media Use Habits for Babies, Toddlers & Preschoolers" | HTTP 404 (curl confirmed) | Same as above. |
| HealthyChildren "Why to Avoid TV for Infants & Toddlers" (`Why-to-Avoid-TV-Before-Age-2.aspx`) | Read; last updated 2016-10-21 | Older AAP guidance, superseded. Summarized below for transparency only. |
| HealthyChildren "Toddler Activity" (`healthy-living/growing-healthy/toddler-activity.aspx`) | Read; no date | It says to limit TV to 2 hours a day, which predates even the 2016 guidance. The page is stale, so I used it neither as a media source nor as an activity source. Flagged for AAP or the lead. |
| HealthyChildren "How to Share Books with Your Preschooler" | Read; updated 2013, content © 1994 | Aimed at 4-year-olds and old. The current CDC pages cover the same tips (library, questions). |
| HealthyChildren "7 Ways to Help Young Children Build a Healthy Relationship With Media" (2024-07-22) | Read | The tip text sits behind interactive cards and was not in the fetched content. |
| HealthyChildren "Why Co-Viewing Is Important" (2026-06-25) | Read | Aimed at school-age children and teens; nothing specific to under-5s. |
| HealthyChildren Family Media Plan tool | Read | Interactive tool; no static guidance text visible. |
| HealthyChildren "4 Play Ideas to Get Kids Moving" (2024-01-09) | Read | Adapted from a toy company's blog, with no age range. HSE was used for the obstacle course instead. |
| Poison Control "Sodium: Too much of a good thing" | Read | Does not mention play dough (see Omitted). |

## Media guidance summary

This section is written for the About page and the docs. Guidance was checked on 2026-10-28.

### What applies to which ages, by jurisdiction

| Source (jurisdiction, page date) | Under 18 months | 18 to 24 months | 2 to 5 years | Other points |
|---|---|---|---|---|
| **AAP 2026 policy** "Digital Ecosystems, Children, and Adolescents" (US; Pediatrics Feb 2026; HealthyChildren explainer updated 2026-06-03; news item 2026-01-20) | Babies under 18 months learn best from real-world interactions. Heavy solo screen use can affect language and social skills. | No separate rule. | **No hourly limit.** It "moves beyond simple screen-time limits" toward quality, context and conversation. | Family Media Plan; the 5 Cs; choose quality content; watch together when you can; screen-free meals, bedrooms and the hour before bed. It says autoplay and endless scrolling aren't built for children. It replaces prior AAP communications and media guidance. |
| **AAP 5 Cs for toddlers and preschoolers** (US; updated 2024-04-30; still published and named in the 2026 news item) | n/a | n/a | Ages 2–4. No hourly limit. | Choose high-quality shows; turn off autoplay; keep screens for regular times, not to distract an upset or bored child; talk about the show and do something related. |
| **CDC milestone pages** (US; 2-year, 30-month and 3-year pages updated 2026-05-16) | Not covered by my pages (D's notes report CDC says no screens under 2 except video calls). | Not covered here. | **No more than 1 hour a day of a children's program with an adult present.** | Screen-free meals (30m page); no screens in the bedroom (3y page). CDC's positive-parenting page for 2–3 (2026-01-29) says 1 hour of quality programming and suggests a family media plan. |
| **WHO 2019** (international; news release 2019-04-24) | No sedentary screen time at age 1 or younger. | Same: no sedentary screen time for 1-year-olds. | **2–4 years: no more than 1 hour a day; less is better.** | Encourages reading, storytelling and singing with a caregiver when children are sitting still. |
| **Canadian Paediatric Society** (CA; position statement posted 2022-11-24; parent handout updated 2025-03) | Not recommended except video chat with caring adults. | Same (under 2). | **About 1 hour a day or less** of routine or sedentary screen time. | Co-view; educational, age-appropriate content; avoid background TV; screen-free meals; no screens for at least 1 hour before bed; don't routinely use screens to calm. |
| **HSE** (IE; reviewed 2024-05-02) | Try not to (video calls are fine). | Limit as much as possible. | **Ideally no more than 1 hour a day**, choosing something to watch together. | Same room as your child; avoid very noisy or fast-paced content; avoid background TV; screen-free meals and the hour before bed; don't use screens to calm. It acknowledges screens can feel easier while cooking and suggests a toy or job near you. |
| **UK Government, Best Start in Life** (UK; page updated 2026-06-29; first released March 2026 per news coverage) | Avoid, except shared activities such as video calls or looking at photos together. | Same (under 2). | **About 1 hour a day, less if possible.** | Slow-paced, predictable content; avoid fast-paced, social-media-style videos; watch and talk together; young children should avoid using screens alone; screen-free meals, hour before bed and bedrooms; no AI toys or chatbots. |

How Trunk applies this:

- **Ages 24m–60m only.** Media records start at 24m. Every jurisdiction allows some screen use from 2 years, and starting there avoids the under-2 disagreement (WHO and CPS: none; HSE: none to 18 months; AAP 2026: no fixed rule).
- **One episode, at most 30 minutes.** This fits inside every hourly figure above and inside AAP's quality-first framing.
- **Never at meals, and never to calm an upset child.** All five frameworks agree on this.
- **A non-screen alternative is always shown.** The app adds it automatically.

### Current vs. older AAP guidance

- **Current (2026):**
  - The policy statement "Digital Ecosystems, Children, and Adolescents" (Pediatrics, February 2026, published online 2026-01-20).
  - Two HealthyChildren pages describe it: the news item (2026-01-20) and the explainer (updated 2026-06-03).
  - The news item says the statement "replaces prior AAP guidance on communications and media". It does not name "Media and Young Minds" (2016), but that statement was AAP's prior media policy for young children.
- **Older and removed:** HealthyChildren's "Where We Stand: Screen Time" and "Healthy Digital Media Use Habits for Babies, Toddlers & Preschoolers" pages returned 404 on 2026-10-28. These were the parent-facing summaries of the 2016 limits.
- **Older but still online:**
  - "Why to Avoid TV for Infants & Toddlers" (updated 2016-10-21). It says to avoid TV and apps before 18 months and to "cap" entertainment screen time at 1 hour a day from 18 months to 5 years. It also says using TV to get dinner made is "better than starving" but worse than no TV.
  - "Toddler Activity" (undated) says to limit TV to 2 hours a day, which is pre-2016 guidance.
  - Trunk does not cite either page.
- **CDC (US government) still gives 1 hour a day for 2–3-year-olds** on pages updated in May 2026. So within the US, CDC's figure and AAP's no-fixed-limit framing differ.

### Mister Rogers' Neighborhood: audience finding

- Fred Rogers Productions' own show page lists **"Ages: 2-4"**. It calls the show a PBS series that premiered in 1968, and "a television visit with young viewers exploring early childhood themes".
- Trunk uses it only as an example of a calm show made for preschoolers.
- The producer page doesn't describe the show's pace. "Calm, slow-paced" is Trunk's framing, backed by UK and HSE advice to choose slow-paced, not-too-noisy content, not by the producer.
- Trunk does not say where the show can be watched, and makes no claim about what children learn from it. The producer's page makes educational statements that Trunk does not repeat.
- Secondary sites give "ages 2 to 5", but none of them is authoritative, so they are not used.

## Claim-to-passage map

### Media claims

| Claim | Passage (paraphrased) | Used by |
|---|---|---|
| `clm.e.aap-2026-policy-replaces` | AAP news (2026-01-20): the statement and technical report replace prior communications and media guidance; families get a media plan, modelling, the 5 Cs and screen-free times. Explainer: moves beyond simple screen-time limits; no hour figures. | watch-one-together (evidence) |
| `clm.e.aap-5cs-preschool` | AAP 5 Cs (ages 2–4), sections Content, Calm, Crowding out and Communication: high-quality shows, turn off autoplay, don't use a device whenever a child is upset or bored, talk about the show and do something related. | both media records |
| `clm.e.cdc-one-hour-adult-present` | CDC 2-year, 30-month and 3-year tips: no more than 1 hour a day of a children's program with an adult present; screen-free meals (30m); no screens in the bedroom (3y). Positive-parenting 2–3 "Healthy Bodies" list: 1 hour of quality programming. | both media records; snack (safety) |
| `clm.e.cps-screen-limits` | CPS statement recommendations and Caring for Kids handout: not under 2 except video chat; about 1 hour or less for ages 2–5; co-view; avoid background TV; screen-free meals; nothing 1 hour before bed. | watch-one-together |
| `clm.e.hse-screen-limits` | HSE age sections: under 18 months, 18 months to 2 years, and 2 to 5 years (ideally no more than 1 hour; choose something to watch together). | watch-one-together |
| `clm.e.uk-2026-limits` | UK page: time limits by age; slow-paced content; watch and discuss together; young children should avoid using screens alone. | both media records |
| `clm.e.hse-busy-cooking` | HSE "18 months to 2 years": "You may find it easier to let your child have screen time if you are busy, for example, cooking a meal", with a toy or activity near you, or involving the child, as alternatives. "Get involved…": be in the same room to see what they watch. | calm-show-while-you-cook |
| `clm.e.slow-calm-content` | UK: slow-paced, predictable content; simple stories, fewer scene changes, clear speech. HSE: avoid videos or apps that are very noisy or fast-paced. | calm-show-while-you-cook |
| `clm.e.screen-free-meals-and-bedtime` | AAP explainer "Screen-free time" tip; CPS meals and bedtime tips; HSE screen-free zones and before bed; UK meals and before bed. | snack, watch-one-together |
| `clm.e.mister-rogers-audience` | Fred Rogers Productions show page: "Ages: 2-4"; the opening description. | calm-show-while-you-cook (evidence) |

### Activity description claims

| Claim | Passage (paraphrased) | Used by |
|---|---|---|
| `clm.e.pretend-kitchen` | CDC 30m tips: pretend to cook with safe kitchen items. HSE "Imaginative (pretend) play": a whisk and bowl for pretending to be a baker. | pretend-kitchen-cook |
| `clm.e.big-box-pretend` | CDC 30m tips: a large box becomes a vehicle or house to color, paint or add stickers to. | big-box, big-sticker |
| `clm.e.simple-art` | CDC 2y: simple art (crayons, finger paint). CDC 30m: crayons, chalk or shaving cream; model a line, then a circle. CDC 3y: activity box with paper and crayons. | water painting, chalk, sticker |
| `clm.e.hse-fine-motor-play` | HSE "Physical play": fine-motor examples are playdough, threading, jigsaws and drawing. "Constructive play": drawing, music and building. | chalk, playdough, sticker |
| `clm.e.playdough-hands` | CDC 3y: squish, press, pinch and roll to build hand muscles. HSE playdough page: helps hands develop strength and control. | playdough |
| `clm.e.colors-and-matching` | CDC 30m: name colors, body parts and pictures in books. CDC 3y: find matching objects; opposites games. | color sort |
| `clm.e.mealtime-helper` | CDC 2y: help get ready for meals, carrying cups or napkins; simple chores; thank them. CDC 3y: washing produce, stirring. | carry-to-the-table, wipe-the-table |
| `clm.e.book-questions` | CDC 30m: read together; ask who, what and where questions. CDC 3y: ask about pictures and what happens next. CDC positive-parenting 2–3: regular reading time. | book chat, library |
| `clm.e.library-and-parks` | CDC 30m: visit the library; visit parks or libraries with other children to practice sharing and turns. | library |
| `clm.e.follow-the-leader` | CDC 30m: follow the leader with lines, turns, backward steps and tiptoeing; then the child leads. | parade |
| `clm.e.hse-physical-play` | HSE "Physical play": obstacle courses, dancing, chasing games and playground visits; outdoor play gives room to run, jump and climb. | obstacle course, parade |
| `clm.e.preschool-playground` | CPSC handbook: Definitions (preschool-age is 2 through 5), §2.2.7 (preschoolers need more attentive supervision), Table 1 (equipment examples). | playground |
| `clm.e.playground-play` | AAP playground page, opening: playgrounds exercise bodies, brains and social skills; swinging can calm children. | playground |
| `clm.e.park-walks-child-leads` | CDC positive-parenting 2–3: walks or wagon rides. CDC 30m: park, climbing and running in safe areas. CDC 3y: park or trail, where the child chooses and leads. | nature walk, playground |

### Safety claims

| Claim | Passage (paraphrased) | Used by |
|---|---|---|
| `clm.e.playdough-safety` | Poison Control "Is Play-Doh edible?": not toxic, but a possible choking hazard; labeled 2+; contains wheat; keep it from mouths; store it up and away. "Raw flour": homemade play dough isn't safe for children because of raw flour (E. coli, Salmonella). | playdough |
| `clm.e.crayons-out-of-mouth` | CDC positive-parenting 2–3, "Child Safety First": keep crayons and pencils out of the mouth; check toys for loose parts. | box, chalk, sticker |
| `clm.e.seated-eating` | AAP choking prevention list: pieces no larger than ½ inch, chew well, sit to eat, no running, walking, playing or lying down with food, supervise. CDC: sit while eating. | snack |
| `clm.e.high-risk-foods-under-4` | AAP "Foods that are choking hazards" list; avoid until about 4; chop round foods into tiny pieces. | snack (safety note only) |
| `clm.e.falls-2-to-4` | AAP 2–4: "doesn't understand dangers or remember 'no'"; falls from play equipment, windows, stairs and climbable things; gates, window guards, surfacing. | parade, obstacle course, box, wipe-table, library, playground |
| `clm.e.kitchen-underfoot` | AAP 2–4 "Burns": a child underfoot can be burned by spills; "Find something safe for your child to do while you are cooking." | pretend kitchen, carry-to-the-table, calm show |
| `clm.e.street-driveway` | AAP 2–4 "Car & traffic": no playing in the street; driveways are dangerous; walk behind the car. | water painting, chalk, nature walk |
| `clm.e.playground-safety` | AAP playground page: supervision, surfacing, hot slides, drawstrings, no lap sliding. CPSC §2.2.7 checklist. | playground |

## Safety and readiness considerations

- **Small parts and nearby babies.** No record open to under-3s lists the small-parts hazard. Several records carry a note that materials must stay out of a baby's reach (`clm.d.older-siblings-small-objects`): crayons and chalk, playdough, stickers, and sorting items. The color sort uses the toilet-roll test.
- **Mouthing readiness.**
  - Playdough and the sticker picture require `no-longer-mouthing`, so parents who mark it "not yet" won't see them.
  - Chalk, crayons and sorting items carry the `mouthing` hazard instead, with a CDC note to keep crayons out of mouths.
- **Playdough.** Store-bought dough labeled for the child's age only. There is no homemade recipe (see Conflicts). A wheat allergy note is included.
- **Water.** Water painting uses a small cup and is tipped out afterward. It requires arm's reach, is not shareable, and has no parent-moment intent (`clm.d.water-touch-supervision`).
- **Falls.**
  - The obstacle course stays at floor level with no climbing on furniture, and the adult spots within arm's reach.
  - The playground uses only equipment for ages 2–5, with arm's reach whenever the child climbs and no sliding on an adult's lap.
- **Traffic.** Chalk and the nature walk list `traffic`, are not shareable, and require hand-holding near roads, driveways and parking lots. The library notes cover the trip there.
- **Kitchen.** D follows AAP's 1–2-year advice to keep toddlers out of the kitchen while cooking. AAP's 2–4 page says to find something safe for the child to do. Every E record that happens around cooking puts the child in view but outside the cooking area.
- **Food.**
  - The snack is seated and supervised at arm's reach, and requires `eats-solids`. It is not shareable and is never a parent-moment.
  - Foods are cut small, and food names appear only in safety notes.
  - It gives no feeding protocol or nutrition target, and says to ask the clinician about allergies.
- **Screens.**
  - The calm show still needs real supervision: the child is in view and away from the stove, and the adult checks often.
  - The TV should be on a low, stable stand or anchored (`clm.d.anchor-furniture`).
  - The show is not used to calm an upset child.
- **Readiness over age.** The playground requires `walks` and `climbs`. The parade, obstacle course, walk and table helper require `walks`. No milestone deadlines are stated, and "Nearly 3" appears only in adaptations.

## Conflicts and jurisdiction differences

1. **Hour limits versus no limit (US internal conflict, unresolved).**
   - The 2026 AAP policy gives no hourly limit.
   - CDC (updated May 2026), WHO, CPS, HSE and the UK government all give about 1 hour a day for ages 2–5.
   - Trunk's media records stay within 30 minutes per episode and cite both views. The About page should state that the frameworks differ, not invent one rule.
2. **Solo viewing while the parent cooks.**
   - HSE acknowledges screens when busy cooking and advises being in the same room.
   - CDC says "with an adult present".
   - AAP 2026 says to watch together "when you can".
   - **UK 2026 says young children should avoid using screens alone.** That is stricter than the cooking option, where the parent is in view but not co-viewing.
   - The record's evidence cites the UK claim, and the claim caveat flags the difference. The lead may want to hide `act.calm-show-while-you-cook` for UK users, or add UK wording.
3. **HSE's busy-time sentence is in its 18-months-to-2 section.** Trunk applies it from 24m, together with the 2–5 section, which says to choose something to watch together. This is stated in the claim's scope.
4. **Under 2.** WHO: no sedentary screen time for 1-year-olds. CPS and UK: none except video calls. HSE: none to 18 months, then limit. AAP 2026: no fixed rule. Trunk avoids the question by starting media at 24m. The validator floor is 18m.
5. **Homemade playdough.**
   - HSE publishes a no-cook recipe with raw flour and 1 cup of salt to 2 cups of flour.
   - US Poison Control says homemade play dough isn't safe for children because of raw flour.
   - Trunk follows Poison Control and suggests store-bought dough labeled for the child's age.
6. **Kitchen during cooking.** AAP's 1–2-year page says to keep the toddler out (D). AAP's 2–4 page says to find something safe for them to do. E uses "in view, outside the cooking area".
7. **Mister Rogers' audience.** The producer lists 2–4, while secondary sites say 2–5. Trunk uses the producer's figure. The media records run to 60m, but the example is labeled with the producer's 2–4.
8. **Stale AAP pages still online.**
   - "Why to Avoid TV…" (2016): 1 hour a day from 18 months to 5 years.
   - "Toddler Activity" (undated): 2 hours a day.
   - Neither is cited. Both are worth reporting to AAP or noting in the docs.
9. **Older sources still used.** AAP Safety 2–4 (2022, from TIPP 2019), the CPSC handbook (2010 edition), the CPS position statement (2022) and the AAP 5 Cs page (2024). Each is still published and consistent with newer pages.

## Ideas omitted or softened, and why

- **Homemade playdough and salt warning.**
  - I found no authoritative source that discusses salt in homemade dough. Poison Control's sodium article doesn't mention it, and the Play-Doh article lists salt only as an ingredient.
  - So I make no salt claim. The playdough record avoids homemade dough altogether, citing Poison Control's raw-flour warning.
- **Homemade shakers.** Fillings such as rice or beans become small parts if the container opens, and the record would be open to under-3s. I found no source for a safe sealed design. Music appears instead as an optional pot drum and marching song in the parade.
- **Tear-and-glue collage.** Paper scraps and glue-stick caps are choking risks, and caps are on AAP's list. I replaced it with the big-sticker picture, gated by `no-longer-mouthing` and starting at 30m.
- **Freeze dance, animal moves, chunky puzzles, sock matching, feeding a teddy.** D (to 30m) or F (from 36m) already cover these. Animal moves appear only as a "crawl like a bear" station in the obstacle course.
- **Putting groceries away.** It involves food items, heavy cans and bags. Omitted.
- **Washing fruit and vegetables at the sink.** CDC suggests it at about 3, but it involves standing on a stool at a sink with water. F covers it from 36m (`act.wash-fruit-and-veg`).
- **Separate board-book basket.** D merged this into its busy basket (to 30m), so I made no near-duplicate.
- **Dress-up box.** CDC suggests grown-up clothes, but scarves, belts and ties raise strangulation concerns that I had no specific source to address in time. Omitted.
- **"Jump to touch a ball hung from the ceiling"** (AAP Toddler Activity page). The page's example uses a Mylar balloon, and the page is stale. Omitted.
- **Fixed-limit language in the app.** Records give no hour figure as a rule. The figures appear only in claims and in this summary.

## Schema change requests

None required. Suggestions for the lead:

1. Consider a per-jurisdiction display or filter for media records. UK 2026 guidance discourages solo viewing, which conflicts with `act.calm-show-while-you-cook`.
2. Consider an optional `jurisdictionNotes` field, or a convention, so About-page text can be generated from claims instead of copied by hand.

## What the lead should double-check

- **F's duplicate source entries.** F should reference my `src.cdc.milestones-3-years` and `src.aap-hc.safety-2-to-4-years` and not re-register them (same IDs and URLs). Keep the IDs as they are.
- **F's version of the table helper.** F keeps `act.set-the-table-helper` (36–60m). Mine is now `act.carry-to-the-table-helper` (24–36m).
- **Snack range.** Whether 12m–60m suits the catalog, or whether D and F want their own seated-snack records.
- **The cooking-time show for UK users** (see Conflicts 2).
- **About-page wording** for the US internal difference between AAP 2026 (no fixed limit) and CDC (1 hour with an adult present).
- **The AAP Pediatrics article (403).** If the lead has access, confirm it says nothing age-specific for 2–5 that contradicts the explainer.
- **The UK page's org label and scope.** I labeled it "UK Government, Best Start in Life" with jurisdiction UK. It may be England-focused; the page itself didn't say.
