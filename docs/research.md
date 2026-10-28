# Research synthesis

How Trunk's content was researched, what the sources say on the questions that matter most, where they disagree, and what remains uncertain. Per-workstream detail (every source, claim-to-passage tables, omissions) is in [`docs/research/`](research/). Machine-checked registry: `content/*.json` (sources and claims), validated by `npm run content`.

## Method

- **Who:** a lead plus research agents working in bounded workstreams by age band (A 1 week–3 months, B 3–6 months, C 6–12 months, D 12–24 months, E 24–36 months plus screen media, F 36–60 months), then a mixed-age workstream and an independent content/safety review. Agents wrote only their own files against a frozen schema; the lead integrated and resolved conflicts.
- **Sources:** current public pediatric and public-health authorities — AAP/HealthyChildren.org (default, US), CDC, NIH/NICHD, CPSC, WHO, NHS (UK), HSE (Ireland), Canadian Paediatric Society, SickKids/AboutKidsHealth (Canada), Children's Wisconsin, ZERO TO THREE. Every source was opened and read on its recorded `checked` date (all 2026-10-28 for this release); publication/update dates are recorded when the page shows one.
- **Claims:** each developmental or safety statement is a claim with its own wording, the source passage's locator, a short paraphrase, its scope (population, age, jurisdiction, positions), and any caveat. Activities cite claims; the validator rejects developmental goals or serious hazards without provenance.
- **Evidence classes:** *described* (a source describes the activity), *adapted* (Trunk's design from source-informed principles), *practical* (an everyday routine; no developmental claim). Institutional guidance informs designs; it does not prove an invented game was tested.
- **No clinical review.** No qualified clinician has reviewed Trunk's content. The app says so.

## Tummy time: amount, age, position, population

Sources are kept separate; Trunk never blends them into one rule. Checked 2026-10-28.

| Source (jurisdiction) | Population | Amount | Positions |
|---|---|---|---|
| AAP, *Back to Sleep, Tummy to Play* (US; updated 2026-09-08) | Infants generally | 3–5 min, 2–3×/day at first; work up to 15–30 min/day by ~7 weeks | Lists on-your-chest play among tummy-time ideas; does not limit the total to the floor |
| WHO 2019 guidelines (global) | Infants not yet mobile | ≥ 30 min/day prone, spread out, while awake | "Prone position" within interactive floor-based play |
| HSE, *Tummy time for babies* (Ireland; reviewed 2026-05-17) | Infants generally | ≥ 30 min/day in first 3 months; build to 60 min between 4 and 6 months | Chest, lap, arms, or floor mat from birth; **from 3 months, all tummy time on a firm, flat mat** |
| Children's Wisconsin teaching sheet (US; rev. 2023-01-01) | Infants generally | Start 2–3 min; at least 60 min/day total by 4 months | Tummy-to-tummy, face-to-face on floor, over a small blanket roll, tummy carry; does not say only floor counts |
| SickKids neonatal follow-up, 4-month visit (Canada; updated 2021-03-30) | Babies followed after NICU/cardiac critical care; **corrected age** | 50–60 min/day in short periods | Emphasizes floor play ("the bed is not appropriate"); does not list which positions count |
| NICHD Safe to Sleep, tummy time (US) — via Workstream B | Infants generally | 15–30 min/day by about 2 months | Floor, chest, lap; includes a rolled towel under the chest |
| **Reported, individualized (not public):** this family's CHOP neonatal clinicians | One 4-month-old | 60 min/day | **Flat surface only; elevated positions excluded** |

How Trunk applies this:

- Every tummy-time record states its position; only `floor` is a flat surface. Chest, lap, carried, and propped (towel roll) time is shown as useful but **never credited toward a flat-surface target**. Plans show floor and held/supported minutes separately.
- The CHOP instruction is preserved as reported individualized clinical guidance. It is not a public CHOP protocol, it was not verified from a public document, and the app never applies it to every baby. The app tells parents to follow their own clinicians' targets.
- Tummy time is only for awake, closely supervised babies; a baby who falls asleep goes on their back on their own firm, flat sleep surface (AAP, HSE). Chest/lap positions require an awake, alert adult (AAP safe-sleep guide on sofas/armchairs).
- HSE's flat-mat-from-3-months rule is stricter than the US sources; Trunk's 3-month-plus floor records use a firm, flat mat, and the one propped record (B: towel roll, 3–6 months, from NICHD/NHS/Children's Wisconsin) is labelled not flat.

## Screen media

Current guidance has moved. The AAP's 2026 policy statement *Digital Ecosystems, Children, and Adolescents* (explained on HealthyChildren.org, updated 2026-06-03) emphasizes quality, context, co-use, and screen-free times rather than a single time limit, and says babies under 18 months learn best from real-world interaction. WHO's 2019 guideline is stricter for 1-year-olds (no sedentary screen time) and sets ≤ 1 hour/day for ages 2–4. SickKids' NICU follow-up page says no electronic media under 2. See Workstream E's notes for the full, dated summary.

How Trunk applies this: screen options exist only for ages 2+ and appear only when the parent chooses "busy nearby" or "low energy"; each states that watching alone is not equal to playing together and does not replace supervision, shows the guidance it relies on, and links a no-screen alternative. At most one screen option appears in a generated plan, and never in an energetic context.

## Sun for babies under 6 months

AAP's *Baby Sunburn Prevention* (updated 2026-04-13) says babies under 6 months should be kept out of direct and indirect sunlight entirely because of heat-stroke risk, recommends shade-covered strollers and sunshades, protective clothing and hats, and avoiding being outside between 10 a.m. and 4 p.m. AAP's general *Sun Safety* page (2024) allows sunscreen on small areas when shade and clothing aren't available. Trunk follows the stricter reading: walks for babies under 6 months are in full shade, with sun-protective clothing, and the planner never schedules them between 10 a.m. and 4 p.m.; the activity notes say to skip them in heat.

## Cross-workstream conflicts and how they were resolved

- **Mobiles:** one HSE play page (2026) suggests a mobile over the cot for 0–3 months; other HSE pages and AAP say nothing over the sleep space. Trunk uses hanging toys only over an awake floor mat, and ends floor play-gym batting at 5 months (AAP's crib-toy removal rule applied conservatively).
- **Changing surfaces:** AAP allows a changing table (or a bed) with precautions; NHS prefers a floor mat; HSE never leaves a baby on a raised surface. Trunk's changing and dressing records require a hand on the baby at all times and prefer the floor.
- **Feeding in a sling:** HSE/NHS say take the baby out to feed; a 2017 CPSC release describes repositioning after nursing in a sling. Trunk's carrier records don't involve feeding.
- **Premature babies in carriers:** AAP says not in upright carriers; HSE/CPSC say extra care. Readiness notes direct prematurity questions to the clinician.
- **Peekaboo cloth:** AAP drapes a cloth over the baby's head; CDC guidance avoids covering the face. Trunk puts the cloth over the parent or a toy.
- **Toddlers in the kitchen while cooking:** AAP prefers the toddler out of the kitchen (play yard, high chair, gated space); HSE allows a toddler in the kitchen with a no-go zone by the cooker. Trunk's "busy nearby" options use a gated or baby-proofed space in view, never a kitchen cupboard by the stove; babywearing is never suggested while cooking (HSE: never cook while holding your baby).
- **Play-yard time:** HSE says short periods; older AAP guidance is looser; CPSC sets no limit. Trunk keeps the parent in the same room for 5–20 minutes.
- **Knee bouncing:** CPS and HSE mention it; Trunk's policy excludes bouncing instructions for babies and young toddlers.
- **Screens under 2:** CDC (no screens under 2 except video chat), AAP (real-world interaction under 18 months), WHO (none for 1-year-olds). Trunk offers no screen options under 2.

## Verification caveats

- Some CDC, CPSC, and ZERO TO THREE pages blocked scripted downloads; agents read them through a fetch tool that returns a paraphrase. Those sources say so in their `notes`; the independent review spot-checked them where possible.
- Several sources are older or past their stated review dates (for example AAP *Playpen safety* 2009, AAP changing-table guidance 2009, HSE *Play 0–6 months* and *Play and toys* 2021, NHS pages past review). They were kept only where current pages agree; they are first in line for the next recheck.

## What the lead corrected during integration

- Consolidated duplicate source registrations across workstreams (one ID per URL).
- Added the midday-sun planner rule for babies under 6 months.
- Kept two-child suggestions limited to curated, feasibility-checked pairings.

## Known limitations

- Content is source-informed, not clinician-reviewed, and US-default with other jurisdictions labelled.
- Durations, setup times, and effort levels are editorial estimates.
- Readiness filtering is opt-in ("not yet" toggles); age is only a starting filter.
- Two-child suggestions exist only where a curated pairing fits both ages; some age pairs have few options.
