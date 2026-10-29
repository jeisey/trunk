# Workstream A research notes: 1 week to under 3 months

Owner file: `content/workstreams/a.json` (15 activities, 40 claims, 32 sources).
Every source below was opened and read on **2026-10-28**. Summaries are in my own
words. No clinician has reviewed this content.

Validation: `node scripts/build-catalog.ts --check --only content/workstreams/a.json`
exits 0 with no warnings for `a.json`.

## Activities

All records start at `1w`. Most end at `4m` (exclusive) because the activity is just
as suitable at 3 months and the sources cover "0–3" or "0–6" months. Bold-picture
gazing ends at `3m` because the high-contrast preference is described at about
1 month.

| ID | Ages | Evidence | Supervision (participation / proximity / hands / shareable) | Hazards |
|---|---|---|---|---|
| `act.coo-and-copy-chat` | 1w–4m | described | leads / holding / continuous / yes | – |
| `act.diaper-change-chat` | 1w–4m | described | leads / arms-reach / continuous / **no** | falls, suffocation |
| `act.sway-and-hum` | 1w–4m | described | leads / holding / continuous / yes | falls, suffocation |
| `act.read-aloud-anything` | 1w–4m | described | leads / holding / continuous / yes | suffocation (dozing) |
| `act.bold-picture-gazing` | 1w–3m | described | leads / arms-reach / intermittent / yes | – |
| `act.rattle-look-and-listen` | 1w–4m | described | leads / arms-reach / intermittent / yes | – |
| `act.pat-a-cake-touch-rhymes` | 1w–4m | described | leads / arms-reach / continuous / yes | – |
| `act.gentle-hand-foot-massage` | 1w–4m | described | leads / arms-reach / continuous / yes | – |
| `act.diaper-off-kick-time` | 1w–4m | described | joins / arms-reach / intermittent / yes | – |
| `act.play-gym-mat-gazing` | 1w–4m | adapted | **watches / same-room / none / yes** (the only "busy nearby" option) | cords |
| `act.side-lying-play` | 1w–4m | described | leads / arms-reach / intermittent / yes | suffocation |
| `act.mirror-hello-in-arms` | 1w–4m | described | leads / holding / continuous / yes | – |
| `act.stroller-stroll-point-and-name` | 1w–4m | described | leads / arms-reach / intermittent / **no** (outing) | sun-weather, traffic |
| `act.home-tour-in-arms` | 1w–4m | adapted | leads / holding / continuous / yes | falls, suffocation |
| `act.shade-sit-outdoors` | 1w–4m | adapted | leads / holding / continuous / yes | sun-weather |

Core records are not duplicated: chest, lap, and floor tummy time stay with
`content/core.json`. Side-lying play has no `tummyTime` field because it is not tummy
time.

## Sources consulted

### Registered in `a.json`

Page dates are as shown on the page. HSE pages use DD/MM/YYYY, which is converted below.

| ID | Org | Jurisdiction | Page date | URL |
|---|---|---|---|---|
| `src.aap-hc.hearing-making-sounds` | AAP (HealthyChildren.org) | US | updated 2021-02-22 | https://www.healthychildren.org/English/ages-stages/baby/Pages/Hearing-and-Making-Sounds.aspx |
| `src.aap-hc.emotional-social-0-3m` | AAP | US | updated 2026-03-18 | https://www.healthychildren.org/English/ages-stages/baby/Pages/Emotional-and-Social-Development-Birth-to-3-Months.aspx |
| `src.aap-hc.share-books-baby` | AAP | US | updated 2024-09-29 | https://www.healthychildren.org/English/ages-stages/baby/Pages/how-to-share-books-with-your-baby.aspx |
| `src.aap-hc.simple-ways-entertain` | AAP (from *Retro Baby*, 2022) | US | updated 2023-07-27 | https://www.healthychildren.org/English/family-life/power-of-play/Pages/simple-ways-to-entertain-and-boost-your-babys-development-at-home.aspx |
| `src.aap-hc.movement-0-3m` | AAP Section on Neurology | US | updated 2020-08-12 | https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-Birth-to-Three-Months.aspx |
| `src.aap-hc.vision-development` | AAP | US | updated 2024-11-05 | https://www.healthychildren.org/English/ages-stages/baby/Pages/Babys-Vision-Development.aspx |
| `src.aap-hc.milestones-1-month` | AAP | US | updated 2026-04-21 | https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-1-Month.aspx |
| `src.aap-hc.baby-carriers` | AAP | US | updated 2025-04-11 | https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Baby-Carriers.aspx |
| `src.aap-hc.sun-safety` | AAP | US | updated 2024-08-09 | https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Sun-Safety.aspx |
| `src.aap-hc.baby-sunburn-prevention` | AAP Section on Dermatology | US | updated 2026-04-13 | https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Baby-Sunburn-Prevention.aspx |
| `src.aap-hc.calming-fussy-baby` | AAP | US | updated 2022-03-21 | https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/Calming-A-Fussy-Baby.aspx |
| `src.aap-hc.responding-to-cries` | AAP | US | updated 2025-02-20 | https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/Responding-to-Your-Babys-Cries.aspx |
| `src.aap-hc.abusive-head-trauma` | AAP | US | updated 2025-02-24 | https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Abusive-Head-Trauma-Shaken-Baby-Syndrome.aspx |
| `src.aap-hc.baby-massage` | AAP (OT and pediatrician authors) | US | updated 2024-04-22 | https://www.healthychildren.org/English/ages-stages/baby/Pages/the-benefits-of-baby-massage.aspx |
| `src.aap-hc.changing-table-safety` | AAP | US | updated **2009-11-02** (old) | https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Changing-Table-Safety.aspx |
| `src.aap-hc.pedestrian-safety` | AAP | US | updated 2026-03-02 | https://www.healthychildren.org/English/safety-prevention/all-around/Pages/pedestrian-safety-tips-for-families.aspx |
| `src.cdc.positive-parenting-infants` | CDC | US | 2026-02-20 | https://www.cdc.gov/child-development/positive-parenting-tips/infants.html |
| `src.cdc.milestones-2-months` | CDC (Learn the Signs. Act Early.) | US | published 2025-09-04; updated/reviewed 2026-05-16 | https://www.cdc.gov/act-early/milestones/2-months.html |
| `src.cpsc.sling-standard-2017` | U.S. CPSC | US | published 2017-01-13 | https://www.cpsc.gov/Newsroom/News-Releases/2017/CPSC-Approves-New-Federal-Safety-Standard-for-Infant-Sling-Carriers |
| `src.hse.how-to-play` | HSE | IE | reviewed 2026-06-16 | https://www2.hse.ie/babies-children/play/how-to-play/ |
| `src.hse.play-0-6-months` | HSE | IE | reviewed 2021-04-20 (**review overdue**) | https://www2.hse.ie/babies-children/play/0-6-months/ |
| `src.hse.play-toys` | HSE | IE | reviewed 2021-04-20 (**review overdue**) | https://www2.hse.ie/babies-children/play/play-toys/ |
| `src.hse.change-nappy` | HSE | IE | reviewed 2025-08-27 | https://www2.hse.ie/babies-children/parenting-advice/caring-for-a-new-baby/change-nappy/ |
| `src.hse.carrier-sling-safety` | HSE | IE | reviewed 2025-04-29 | https://www2.hse.ie/babies-children/child-safety/choking-strangulation-suffocation/baby-carriers-sling-safety/ |
| `src.hse.suffocation-risks` | HSE | IE | reviewed 2025-05-16 | https://www2.hse.ie/babies-children/child-safety/choking-strangulation-suffocation/suffocation-risks/ |
| `src.hse.preventing-falls-babies` | HSE | IE | reviewed 2026-07-02 | https://www2.hse.ie/babies-children/child-safety/at-home/preventing-falls-babies-0-12-months/ |
| `src.nhs.baby-toddler-safety` | NHS | UK | reviewed 2026-02-19 | https://www.nhs.uk/baby/first-aid-and-safety/safety/baby-and-toddler-safety/ |
| `src.nhs.first-sounds-0-6` | NHS Best Start in Life | UK | no date shown | https://www.nhs.uk/best-start-in-life/baby/learning-to-talk/first-sounds-0-to-6-months/ |
| `src.nhs.help-baby-talk` | NHS | UK | reviewed 2023-04-26 (**review due 2026-04-26 has passed**) | https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/ |
| `src.nhs.play-ideas` | NHS | UK | reviewed 2024-08-27 | https://www.nhs.uk/baby/babys-development/play-and-learning/baby-and-toddler-play-ideas/ |
| `src.cps.read-speak-sing` | Canadian Paediatric Society (Caring for Kids) | CA | updated 2021-03 | https://caringforkids.cps.ca/handouts/behavior-and-development/read_speak_sing_to_your_baby |
| `src.sickkids.newborn-baby-safety` | SickKids (AboutKidsHealth) | CA | updated 2024-05-24 | https://www.aboutkidshealth.ca/newborn-baby-safety |

Core sources reused rather than registered again: `src.aap-hc.tummy-time-activities`
(for side-lying) and `src.aap-hc.safe-sleep-guide`. I re-read both on 2026-10-28.
Core claims I cite: `clm.core.sleep-on-back`, `clm.core.stay-awake-holding`,
`clm.core.floor-not-bed`, `clm.core.tummy-vary-positions`,
`clm.core.who-reading-storytelling`, and `clm.core.who-not-restrained-1h`.

### How the pages were accessed

- **CDC and CPSC pages:** `curl` returned HTTP 403, so I read them with the WebFetch
  tool. The tool returns close paraphrases rather than raw HTML, so the CDC and CPSC
  claims rest on those paraphrases. The lead's spot-check should start with these
  three pages.

### Consulted but not registered

- **AAP "3 Brain-Building Ways to Play With Your Baby"** (HealthyChildren.org,
  updated 2023-11-20). It is adapted from a Melissa & Doug blog, a commercial
  partner. I used AAP's own book-derived pages for serve-and-return instead.
- **HSE "Skin-to-skin contact with newborns"** (www2.hse.ie, reviewed 04/01/2026).
  I read it for a skin-to-skin activity that I then left out (see below).
- **Raising Children Network baby massage page** (AU): blocked with HTTP 403 and
  not used.
- **Old HealthyChildren URLs that returned 404:**
  - `Playing-With-Your-Baby.aspx`
  - `Movement-Birth-to-3-Months.aspx` (the working page is `…Birth-to-Three-Months.aspx`)
  - `Vision-Birth-to-3-months.aspx`
  - `Your-Baby%27s-Vision-1-Month.aspx`
  - `Baby-Carriers-Backpacks-Front-Packs-and-Slings.aspx` (the working page is `Baby-Carriers.aspx`)
- **Old HSE slings URL** `…/baby-carriers-slings/`: 404. The working page is
  `…/baby-carriers-sling-safety/`.
- **Side-lying play from other sources:** search results showed NHS trust leaflets
  and Pathways.org. I did not open them and did not cite them. The AAP's core page
  is the only cited source for side-lying.

## Claim-to-passage map

The locators and paraphrases in `a.json` give the full detail. This table gives the
supporting passage for each claim in brief.

| Claim | Kind | Source → passage (section) |
|---|---|---|
| `clm.a.talk-copy-sounds` | rec | CDC Infants "Positive parenting tips" (talk; repeat sounds, add words). CDC 2 mo "What you can do…" (talk back, take turns) and tips list (copy sounds). AAP Hearing "First conversations" (imitate cooing, add words). NHS Help to talk "0 to 6 months" (repeat sounds back). |
| `clm.a.smile-conversations` | desc | AAP Emotional & social, "Smile 'conversations'…" (quick, enthusiastic responses tell baby they matter and can trust you). |
| `clm.a.play-when-calm-pause` | rec | CDC Infants (play when alert and calm; watch for tiredness). CDC 2 mo (play cues vs. break). AAP Books "Birth to 6 months" (looking away, arching, fussing). AAP Emotional & social "Holding your gaze". |
| `clm.a.babies-prefer-faces-voices` | desc | AAP Hearing "The sound of your voice". AAP 1 month "Visual and hearing milestones". HSE 0–6 opening paragraph (face and voice over toys). |
| `clm.a.talk-during-care` | rec | NHS First sounds "Nappy changing". HSE Nappy "Building a bond". CDC 2 mo (talk while feeding, dressing, bathing). CPS "Speak and tell stories" bullet 1. |
| `clm.a.changing-surface-falls` | safety | HSE Nappy "Where to change a nappy". NHS "Falls in babies". AAP Changing table items 3–4. AboutKidsHealth (one hand on baby). |
| `clm.a.plastic-out-of-reach` | safety | HSE Nappy "Suffocation risk – nappy bag or sack". HSE Suffocation "Plastic bags and nappy sacks". NHS "Suffocation". |
| `clm.a.head-support` | safety | AboutKidsHealth (support the head; weak neck for first months). AAP Movement "Month one – Neck control". AAP 1 month (head flops back if unsupported). |
| `clm.a.never-shake` | safety | CDC Infants "Child safety first". CDC 2 mo tips (safe spot, walk away, check every 5–10 min). AAP Abusive head trauma "When your baby cries, take a break". AboutKidsHealth. |
| `clm.a.no-hot-drinks-holding` | safety | CDC Infants "Child safety first". NHS "Burns and scalds" bullet 2. |
| `clm.a.carrying-trips` | safety | NHS "Falls in babies" (handrail; watch your feet; clear stairs). |
| `clm.a.rock-sway-sing-calms` | rec | AAP Cries (rocking or swaying in arms, singing, walking in arms, stroller or carriage). AAP Fussy (body carrier; hum or walk if bored). AAP Emotional & social (taking them outside). CDC 2 mo (talk softly, hold, rock, sing). |
| `clm.a.dance-over-shoulder` | desc | AAP Simple ways "Newborn to 3 Months – Footloose". |
| `clm.a.cuddle-hold-secure` | rec | CDC 2 mo and CDC Infants (cuddle and hold). AAP Emotional & social "Helping your baby feel secure". AAP Cries (can't spoil a young baby). |
| `clm.a.read-from-birth` | rec | AAP Books (AAP recommends reading from birth; voice and snuggling matter most; no need to finish). AAP Hearing (read even if baby doesn't understand). CPS "Share books". NHS Play ideas "Reading to your baby". |
| `clm.a.sing-rhymes` | rec | NHS Help to talk "0 to 6 months". NHS First sounds "Enjoy singing together". CPS "Sing". CDC Infants. |
| `clm.a.touch-rhymes` | desc | CPS "Speak and tell stories" bullet 3 (gentle-touch rhymes for newborns). AAP Simple ways "Pat-a-Cake". NHS First sounds "Nappy changing" ("Round and round the garden"). |
| `clm.a.newborn-focus-distance` | desc | AAP Vision "Newborns" (8–12 in / 20–30 cm; detects movement). AAP 1 month. |
| `clm.a.high-contrast-preference` | desc | AAP 1 month "Visual and hearing milestones". |
| `clm.a.look-at-pictures-talk` | rec | CDC 2 mo (bright pictures or faces, talk about them). HSE 0–6 (hold toys close to help focusing). |
| `clm.a.rattle-to-side` | rec | CDC 2 mo tips list (rattle to one side of head). |
| `clm.a.moving-toy-in-view` | desc | AAP Vision (detects movement). AAP Hearing opening (turns toward sound, 1–3 mo). AAP Simple ways "Puppet Play". |
| `clm.a.copy-faces` | desc | NHS First sounds "Little tips…" (tongue out, blink). AAP Simple ways "Can't Smile Without You". |
| `clm.a.mirror-play` | rec | CDC 2 mo (baby-safe mirror). HSE 0–6 (play in front of a mirror). |
| `clm.a.massage-follow-cues` | rec | AAP Massage "Follow your baby's cues", "6 massage techniques…", "How touch & massage can soothe…". |
| `clm.a.diaper-free-kicking` | rec | HSE How to play "0 to 3 months". HSE 0–6 "You can also" list. |
| `clm.a.back-play-mobile` | rec | HSE 0–6 (play on back; mobile above head, not above cot). AAP 1 month "Toys appropriate…" (mobile not on sleep surface). AAP Movement "Month Three – Get a grip". CDC Infants "Healthy bodies" (floor time). |
| `clm.a.observe-content-baby` | desc | AAP Emotional & social "…3 levels of needs", bullet 2 (alert, content baby; rest or other business; observe from a distance). |
| `clm.a.keep-face-clear` | safety | CDC Infants "Child safety first". HSE Suffocation opening section. |
| `clm.a.toys-safe-condition` | safety | HSE Play and toys "Keeping your child safe…". NHS "Strangulation". |
| `clm.a.side-lying-play` | desc | AAP 3 Tummy Time Activities "Activity #3: Side lying with support" (core source). |
| `clm.a.side-not-for-sleep` | safety | AAP Safe sleep guide "Place your baby on their back…" (side position as dangerous as stomach) (core source). |
| `clm.a.carrier-safe-position` | safety | AAP Carriers items 2–3. HSE Slings TICKS. NHS "Suffocation" TICKS. CPSC 2017 tips. |
| `clm.a.carrier-young-preterm` | safety | AAP Carriers items 1 and 3. HSE Slings "Babies with poor neck control…". CPSC 2017 (extra care under 4 months). |
| `clm.a.sun-under-6m` | safety | AAP Sun safety "Simple rules…" and "Sunscreen for babies". AAP Baby sunburn "What is the best way…". |
| `clm.a.no-blanket-over-stroller` | safety | HSE Suffocation "Buggy" (last paragraph). |
| `clm.a.strap-in-stroller` | safety | NHS "Falls in babies" (5-point harness every time). HSE Falls "Seats". |
| `clm.a.walk-sidewalks-crosswalks` | safety | AAP Pedestrian "Teaching pedestrian skills…" and "Key points…". |
| `clm.a.asleep-in-device` | safety | AAP Safe sleep "Choose a firm, flat sleep surface". AboutKidsHealth. HSE Slings "Sleeping in a baby carrier or sling". HSE Suffocation "Buggy". |
| `clm.a.point-and-name` | rec | NHS First sounds "Out and about" and "Be inspired…". CPS "Speak and tell stories" bullet 1. |

## Safety and readiness considerations

- **Sleep vs. play:**
  - Every floor or position record (kick time, play gym, side-lying) says it is for an
    awake baby only. Each one moves a drowsy baby onto their back in their own sleep
    space (`clm.core.sleep-on-back`).
  - Side-lying cites AAP's statement that the side is as risky as the stomach for
    sleep.
  - No record suggests inclined seats, sleeping on an adult, or soft surfaces.
- **Dozing while holding:** The low-effort holding records are reading aloud,
  sway-and-hum (seated rocking), and shade-sit. These are exactly the moments when a
  tired parent might fall asleep in an armchair or on a sofa. Each one lists
  `suffocation` where that is honest and carries a note citing
  `clm.core.stay-awake-holding`.
- **Handling:**
  - Head and neck support is required in every holding record.
  - Movement words are limited to "sway", "rock", and "slow-dance gently". The
    validator's rough-handling words are not used.
  - Sway-and-hum includes the never-shake / step-away note.
- **Falls:**
  - The diaper change recommends a floor mat. On a raised surface it says to keep a
    hand on the baby and never step away.
  - Kick time is floor only.
  - Carrying records include the trip / handrail note.
- **Suffocation and strangulation:**
  - Diaper sacks and plastic are kept out of reach.
  - Nothing soft goes near the face during floor play.
  - The side-lying towel roll goes behind the back only. AAP's washcloth under the
    head is left out.
  - Play-gym toys must have no long cords.
  - Pictures and mobiles never go in the sleep space.
- **Carriers:** I did not write a stand-alone babywearing record. A carrier appears
  only as an option in the home tour, with:
  - TICKS / AAP / CPSC position rules;
  - an extra-care note for under 4 months or born early;
  - a readiness note to ask the clinician first;
  - no stove or hot drinks (babywearing is not a cooking position).
- **Outdoors:** The stroll and shade-sit records keep babies under 6 months in shade,
  with covering clothes and a hat, avoiding midday sun. The stroll adds:
  - no blanket over the stroller;
  - harness every time;
  - sidewalks and crosswalks;
  - one hour at most (WHO restraint limit; the HSE carrier page says the same);
  - not shareable, because of traffic.
- **"Busy nearby":** Only `act.play-gym-mat-gazing` qualifies (watches / same-room /
  no hands / shareable). It is supported by AAP's description of watching an alert,
  content baby "from a distance". Its conditions are:
  - the baby stays in view;
  - you check often;
  - pets and older children are kept off the mat;
  - the baby is picked up when drowsy.

  I did not force a second option. At this age, most play needs the adult right
  there.
- **Readiness:**
  - Notes send prematurity (corrected age), reflux, head-shape or neck concerns,
    skin concerns, and breathing issues to the child's clinician.
  - The crying note says to call the clinician if crying won't settle or seems
    unusual.
  - No milestone deadlines are used. Cooing is described as "once cooing starts".
- **Estimates:** Durations are short for newborns (1–10 minutes for most play; walks
  10–45 minutes). They are estimates, not targets.

## Conflicts and jurisdiction differences

1. **Mobiles in the cot:**
   - HSE "How to play" (reviewed 2026-06-16) suggests a colourful toy such as a
     mobile in the cot for 0–3 months.
   - This conflicts with HSE "Play 0–6 months" (do not hang one above the cot) and
     HSE "Suffocation risks" (keep the cot clear of toys).
   - It also conflicts with AAP's 1-month page (do not attach a mobile to the
     sleeping surface).
   - Trunk uses mobiles only over a floor mat. This is recorded in the
     `clm.a.back-play-mobile` caveat.
   - The lead may want to tell other workstreams that cite `src.hse.how-to-play`.
2. **Where to change a diaper:**
   - NHS (UK) says to use a mat on the floor.
   - HSE (IE) accepts a floor mat, bed, or changing table if you never leave.
   - AAP (US, 2009 page) describes a guarded table with a strap but says not to rely
     on the strap.
   - Trunk recommends the floor and gives the hand-on-baby rule for raised surfaces.
3. **Feeding in a sling:**
   - HSE and NHS say not to feed in a carrier or sling.
   - The CPSC 2017 release instead says to reposition the baby after nursing in a
     sling.
   - Trunk does not suggest feeding in a carrier. No claim encodes this, because no
     record needs it.
4. **Premature babies in carriers:**
   - AAP says babies born prematurely or with breathing problems should not go in
     upright positioning devices.
   - HSE and CPSC advise extra care for under 4 months, premature, low birth weight,
     or unwell babies.
   - Trunk uses the readiness note "ask your clinician before using a carrier".
5. **Sun for babies under 6 months (two AAP pages):**
   - The 2024 Sun Safety page says no direct sun, with sunscreen on small areas if
     shade and clothing aren't available.
   - The 2026 Sunburn Prevention page says no direct *or indirect* sun, citing
     heat-stroke risk.
   - Trunk says full shade and does not suggest sunscreen.
6. **Naps in strollers:**
   - AAP and AboutKidsHealth say to move the baby to a firm, flat sleep surface as
     soon as possible.
   - HSE tolerates a buggy nap if the baby is reclined flat, strapped in, not
     overheated, and checked often.
   - Trunk follows the AAP wording.
7. **Shake-baby break timing:** CDC says to check every 5–10 minutes; AAP describes
   about 10–15 minutes. Trunk's activity text does not give a number.
8. **Bouncing:** CPS ("a little bounce" while talking) and HSE (3–6 months: "bounce
   them on your knee") mention bouncing. AAP's movement page describes supported
   "bouncing" at about 3 months. Trunk policy and the validator exclude bouncing, so
   it is left out.

## Ideas omitted or softened, and why

- **Skin-to-skin rest:** omitted.
  - HSE supports regular skin-to-skin in the early weeks and months, awake and
    semi-reclined, with the face visible.
  - Physically, it is the same position as core `act.tummy-time-chest`, so it would
    be a renamed duplicate.
  - Suggestion for the lead: add skin-to-skin as an adaptation of the core chest
    record, citing HSE's skin-to-skin page. It is not registered yet; the URL is
    https://www2.hse.ie/babies-children/breastfeeding/a-good-start/skin-contact/,
    reviewed 04/01/2026.
- **Stand-alone babywearing walk:** folded into the home tour. A second "walk" record
  would duplicate the stroller stroll. Carriers for babies under 4 months carry the
  extra-risk wording described above.
- **Separate slow-dance and calm-down records:** merged into `act.sway-and-hum`.
  AAP's "Footloose" over-the-shoulder dance became an adaptation.
- **Separate face-copying game:** merged into `act.coo-and-copy-chat` (step 4). It
  overlaps with vocal turn-taking.
- **Sock puppet:** became an adaptation of the rattle record rather than its own
  activity. AAP's "puppet gives kisses" is left out to keep fabric off the face.
- **Second "busy nearby" option** (for example, chore narration with the baby on a
  mat): merged into the play-gym record as a step. I would not invent a second
  low-supervision option for this age.
- **Massage:**
  - Kept to hands, feet, legs, and (optionally) back.
  - Tummy strokes are left out because I found no read source on cord-stump timing.
    Raising Children (403) and local NHS trust pages were not opened.
  - Oils are not mentioned.
  - The AAP page's health-benefit list (immunity, digestion, colic) is not repeated.
- **Side-lying washcloth under the head:** left out (soft item near the face).
- **Supported "standing" bouncing, knee bouncing, lifting overhead:** excluded by
  policy and the validator.
- **White-noise machines and swaddling:** mentioned by AAP calming pages but left out.
  They are sleep and settling tools, not play, and swaddling has its own safe-sleep
  rules.
- **"Promotes brain development" wording:** several sources use it (AAP books, CPS,
  CDC "brain development", NHS "90% of brain growth"). Trunk's `why` text describes
  listening, turn-taking, and focusing instead, without promises.

## Notes for the lead

- **Shared source IDs:** other workstreams (b, c, d) already reference
  `src.nhs.baby-toddler-safety`, `src.hse.preventing-falls-babies`,
  `src.hse.play-0-6-months`, `src.cdc.positive-parenting-infants`,
  `src.aap-hc.sun-safety`, `src.hse.play-toys`, `src.hse.change-nappy`,
  `src.aap-hc.baby-carriers`, `src.hse.how-to-play`, `src.aap-hc.pedestrian-safety`,
  and `src.aap-hc.baby-sunburn-prevention`. These IDs must stay stable.
- **Overdue reviews:** `src.hse.play-0-6-months` and `src.hse.play-toys` (2021) and
  `src.nhs.help-baby-talk` (due 2026-04-26) are past their stated review dates.
  Recheck them first.
- **Old page:** `src.aap-hc.changing-table-safety` dates from 2009. It is
  corroborated by current HSE, NHS, and AboutKidsHealth pages.

## Schema change requests

None. One optional idea: a way to mark a safety note as "editorial, no source" (for
example, the shatterproof-mirror note in `act.mirror-hello-in-arms`, which has
`claims: []`) would make unsourced notes explicit to reviewers. The current schema
already allows empty claims for non-serious hazards, so this is not blocking.
