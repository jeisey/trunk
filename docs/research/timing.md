# Timing research and classification

Workstream 1 (timing research and content), **2026-10-29**. This is agent review of
public guidance plus Trunk's own editorial conventions. **No clinician has reviewed
it.** The contract it fills is [`docs/timing-and-routines.md`](../timing-and-routines.md);
the machine records are `timingRules`, claims and sources in `content/core.json`, and
the `timing` field on every activity and recipe.

## What this work does not claim

- **No universal post-meal ban.** The only post-feed play guidance beyond tummy time
  is the AAP's advice for babies who spit up. It is an advisory rule (`condition:
  spit-up`), limited to babies 1 week to under 12 months, keyed to milk feeds only,
  ranked lower but never used to exclude anything, and listed on 12 infant records.
  No toddler or preschool record carries it (the validator rejects listing it on a
  record that starts at 12 months or later).
- **No sleep promises.** The nap rules are planning preferences. No rule or cue says
  an activity helps a child sleep.
- **No wind-down science.** No source reviewed gives a number of minutes for winding
  down before a nap. Every nap window (30 minutes before, 15 after) is Trunk's
  editorial convention, labelled as such in each rule's `reason`.
- **No schedules.** Nothing here sets nap times, nap lengths, wake windows or feed
  intervals, tells a parent to keep a child awake, or to delay or move a feed. The
  HSE naps page's nap counts, spacing between naps and 3.30 pm cut-off are recorded
  as context and deliberately not used.
- **Bedtime is not naps.** The NHS winding-down advice is about bedtime. It is cited
  as background for an editorial nap preference, scoped to bedtime in its claim.
- **Meal timing is unassessed.** No source reviewed supports a rule keyed to meals
  or snacks (solids), so there are no meal rules. No rule for an event means "no
  specific guidance", never "cleared".
- **Nothing is labelled "safe after feeding"**, and no medical condition is recorded.

## Sources

Each page was downloaded over HTTPS on 2026-10-29, read in full as extracted text,
and cross-checked with a second fetch. Quotations below are kept to a few words;
everything else is paraphrase.

### `src.aap-hc.why-babies-spit-up` (new)

- **Page:** AAP / HealthyChildren.org, *Why Babies Spit Up*,
  <https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Why-Babies-Spit-Up.aspx>.
  US. By Alejandro Velez, MD, FAAP, and Christine Waasdorp Hurtado, MD, FAAP. Footer:
  last updated 1/3/2025; source AAP Section on Gastroenterology, Hepatology and
  Nutrition (© 2022). Filed under Baby (0–12 months) › Nutrition.
- **Population:** babies; the page is about spit-up after breast milk or formula
  ("meals" and "feedings" are used interchangeably for milk feeds). No age is given
  beyond the Baby (0–12 months) section, so Trunk scopes the rule to 1 week – under
  12 months.
- **Passages relied on:**
  1. Opening, third paragraph: with a full stomach, a change of position such as
     bouncing or sitting up can let stomach contents come back up (background only).
  2. *Common concerns parents have about spit up* › "My baby spits up when you bounce
     them or play with them after meals": possible cause overstimulation; action:
     keep feeding times calm and limit active play for **about 20 to 30 minutes**
     afterward. → `clm.core.aap-spit-up-limit-active-play`; the window number.
  3. *Remedies for spitty babies* › *5 tips to reduce your baby's spit up*, third tip
     ("Limit active play after meals and hold your baby upright"): pressure on the
     belly right after eating makes spit-up more likely; tummy time matters, but
     putting it off for a while after feeds helps. No minutes. →
     `clm.core.aap-spit-up-postpone-tummy`.
  4. *Remember*: limit active play after feeds and hold the baby upright for at
     least 20 minutes, closely supervised (consistent with 2; Trunk does not encode
     upright holding).
- **Not used:** overfeeding, burping, formula or maternal-diet changes, oatmeal
  thickening, and when to call a pediatrician. These are feeding or medical advice,
  which Trunk does not give; the claim's caveat says so.

### `src.hse.tummy-time` (reused; reopened, `checked` → 2026-10-29)

- **Page:** HSE, *Tummy time for babies*,
  <https://www.hse.ie/babies-children/parenting-advice/caring-for-a-new-baby/tummy-time/>.
  Ireland. Last reviewed 17/05/2026, next review 17/06/2029 (unchanged). The page's
  canonical link now points to the same path on `www2.hse.ie`; the registered URL
  still resolves and is kept, with a note on the source saying HSE also serves it on
  `www2.hse.ie`.
- **Passage:** *When to start*, fourth and last paragraph: avoid tummy time just
  before or after a feed, especially if the baby has reflux. **No minutes.** The
  positions on the page are chest-to-chest, lap, carried in arms and a floor mat
  (birth to 3 months), and a firm flat mat for all tummy time from 3 months.
- **Re-verification of `clm.core.hse-not-around-feeds`:** text and locator are
  accurate. The paraphrase was a word-for-word copy of the sentence, against the
  content contract; it is reworded. The scope now names the positions it covers.
- **Rules:** `tim.core.tummy-after-milk-feed` (30 min) and
  `tim.core.tummy-before-milk-feed` (15 min) stay as they were: source-based
  guidance with editorial windows, non-conditional `avoid` (HSE's advice is general,
  stronger with reflux). Their `reason` text already says HSE gives no minutes and
  the window is Trunk's convention, so no change and no `rev` bump.

### `src.hse.naps-babies-toddlers` (new)

- **Page:** HSE, *Naps for babies and toddlers*,
  <https://www2.hse.ie/babies-children/sleep/naps-babies-and-toddlers/>. Ireland.
  Last reviewed 27/03/2026, next review 27/03/2029.
- **Passages relied on:** *Help your baby or toddler nap*: napping is easier with a
  consistent daily routine (item 1), a dark room (item 3) and a story read in a
  calming voice (item 6); also no play in bed, not too warm. →
  `clm.core.hse-nap-calm-routine`. Item 5: a special blanket or toy as a comforter
  **after 12 months of age**. → `clm.core.hse-comforter-after-12m` (used only on
  a record that starts at 12 months, with a safety note for younger babies).
- **Read but not used:** *When your baby or toddler should nap* and *Spacing out
  naps* (nap counts, gaps between naps by age, "think about how long your child has
  been awake", no sleep after 3.30 pm over 9 months). These are scheduling advice;
  Trunk never prescribes nap timing or wake windows. The closing line (better to let
  a child wake on their own) is about waking, not about what to do afterward, so it
  does not support the after-nap rules either.
- **Scope:** daytime naps, babies and toddlers. It describes a pre-nap routine, not
  which play suits the time before it, and gives no wind-down length.

### `src.nhs.helping-baby-sleep` (new)

- **Page:** NHS (England), *Helping your baby to sleep*,
  <https://www.nhs.uk/baby/caring-for-a-newborn/helping-your-baby-to-sleep/>. UK.
  Page last reviewed 28 January 2025, next review 28 January 2028.
- **Passages relied on:** *Establishing a baby bedtime routine*: a simple, soothing
  bedtime routine may help a baby settle (bath, night clothes, a story, dim lights, a
  cuddle, a lullaby); final paragraph: as children get older, too much excitement and
  stimulation just before **bedtime** can wake them up again, so wind down with
  calmer activities such as reading. → `clm.core.nhs-bedtime-wind-down`.
- **Context that limits it:** *How can I get my baby used to night and day?* says
  that in the daytime you can play games and needn't worry about everyday noise while
  a baby sleeps. The page says nothing about activity before daytime naps. The claim
  is scoped to bedtime and its caveat says so.

### Also reopened: `src.aap-hc.baby-massage` (`checked` → 2026-10-29)

Reopened to check whether `act.gentle-hand-foot-massage` (whose first step said "not
right after a feed") should carry a feed rule. The page's "at least 30 minutes after
they eat" applies to its tummy-stroking Colic Relief Routine, and the same page
suggests holding a baby's foot *while* feeding. A feed rule for hand-and-foot massage
would overstate the source, so none was added. Follow-up: the step now uses the
source's framing instead ("Choose a time when your baby is quiet and alert, and
follow their signals as you go"; `rev` 2).

## How the sources map to rules

| Rule | Event / when | Window | Fit | Ages | Condition | Guidance basis | Claims | Change |
|---|---|---|---|---|---|---|---|---|
| `tim.core.tummy-after-milk-feed` | milk feed, after | 30 min, editorial | avoid | activity's | — | source (HSE) | `clm.core.hse-not-around-feeds` | none |
| `tim.core.tummy-before-milk-feed` | milk feed, before | 15 min, editorial | avoid | activity's | — | source (HSE) | `clm.core.hse-not-around-feeds` | none |
| `tim.core.gentle-play-after-feed-spit-up` | milk feed, after | 30 min, **source** | later | 1w–12m | spit-up (advisory) | source (AAP) | `clm.core.aap-spit-up-limit-active-play`, `clm.core.aap-spit-up-postpone-tummy` | **new** |
| `tim.core.wind-down-before-nap` | nap, before | 30 min, editorial | preferred | activity's | — | editorial | `clm.core.hse-nap-calm-routine`, `clm.core.nhs-bedtime-wind-down` (inform) | claims + wording, rev 2 |
| `tim.core.lively-earlier-than-nap` | nap, before | 30 min, editorial | later | activity's | — | editorial | `clm.core.nhs-bedtime-wind-down`, `clm.core.hse-nap-calm-routine` (inform) | claims + wording, rev 2 |
| `tim.core.gentle-start-after-nap` | nap, after | 15 min, editorial | preferred | activity's | — | editorial | none | wording, rev 2 |
| `tim.core.lively-later-after-nap` | nap, after | 15 min, editorial | later | activity's | — | editorial | none | none |

Notes on the new and changed rules:

- **Spit-up advisory.** `later`, not `avoid`: the AAP says *limit* active play and
  *postpone* tummy time, not that play is harmful. It is condition-limited, so it is
  shown as advice and ranked lower (−6) but never excludes. The window uses the top
  of the AAP's "about 20 to 30 minutes" and the reason says so ("Trunk uses 30").
  It is keyed to `milk-feed` only: "Just fed" in the finder emits both a milk-feed
  and a meal event, so a meal twin would duplicate the finding (see open questions).
  Cue: "Spits up? Keep play calm after a feed".
- **Wind-down before a nap.** Reason now names what the sources actually say (HSE: a
  calm story before naps; NHS: winding down before bed) and that applying it to
  naps, and the 30 minutes, are Trunk's. "Nothing guarantees sleep" is kept.
- **Lively earlier than a nap.** Reason now says the NHS point is about bedtime and
  that for naps it is Trunk's preference.
- **Gentle start after a nap.** The old reason began "Children often wake slowly",
  a generalization no reviewed source makes. It now says plainly that this is
  Trunk's convention with no required waiting time.

## Classification method

For every record I read the summary, steps, noise, mess, effort, movement and
setting, not the `intents` alone (for example, chest and lap tummy time are tagged
`calm` but are tummy time, and stay `gentle` with the feed rules).

- **settling**: quiet, slow, familiar, close: reading or telling a story, soft
  singing or rocking, slow massage, sitting still in the shade, slow breathing, a
  calm corner. The validator also requires quiet noise and no or low mess.
- **gentle**: calm but engaging: conversation and copying games, songs with some
  noise, positional and tummy-time play, focused play (puzzles, sorting, pretend,
  crafts; these can frustrate, so they are not offered as wind-downs), everyday
  routines and helper jobs, stroller walks where the baby rides, anything with medium
  mess.
- **lively**: physical activity is the point (courses, chasing, dancing, cruising,
  swings, playgrounds, walks of 25–30 minutes on the child's own feet), or the record
  is loud or very messy (the validator requires `lively` or `variable` for those).
- **variable**: only where the character genuinely depends on something outside the
  record (a screen show, a library session). Each is listed under Unresolved.

Explicit (non-policy) rules:

- **Every tummy-time record** (6: chest, lap, floor face-to-face, reach-and-play,
  towel roll, roll practice) lists both HSE feed rules and the spit-up advisory (the
  AAP names tummy time explicitly).
- **The spit-up advisory** is also listed on infant records (open to babies under
  12 months) that are `lively` (the AAP's cause is overstimulation and its action is
  to limit active play): pots-and-spoon band, cushion crawl course, cruising the
  sofa, splash and pour, bucket swing. And on one `gentle` record whose point is
  self-propelled whole-body movement: free explore (crawling) in a baby-safe room.
- **Not listed** on lying-on-the-back limb play (diaper-off kick time, toe-catching,
  play gym), side-lying, upright held or supported positions (the AAP suggests
  holding a baby upright after feeds), slow held swaying (no bouncing), or seated
  quiet play.
- No other rule is listed: no reviewed source supports another per-activity rule,
  and no new per-activity citations were written.

Recipes are classified for the **shared space**: the noise, excitement and mess both
children share. The evaluator applies each child's own role activity rules to that
child only (the baby's tummy-time feed rules never land on the toddler), and adds
the policy rules for the shared profile to a child whose own role is calmer.

## Activities (111)

Counts: settling 15, gentle 68, lively 25, variable 3. "HSE ×2" = `tim.core.tummy-after-milk-feed` and
`tim.core.tummy-before-milk-feed`; "spit-up" = `tim.core.gentle-play-after-feed-spit-up`.
Nap rules are policy rules and apply by stimulation, so they are not listed.

| Activity | Title | File | Ages | Stimulation | Explicit rules | Rationale |
|---|---|---|---|---|---|---|
| `act.tummy-time-chest` | Chest-to-chest tummy time | core | 1w–4m | gentle | HSE ×2 + spit-up | Quiet and held close, but it is tummy time: the baby works to lift and turn their head. Not offered as a wind-down. |
| `act.tummy-time-lap` | Lap tummy time | core | 1w–4m | gentle | HSE ×2 + spit-up | Quiet lap position with a slow knee sway; still tummy time, so engaging rather than settling. |
| `act.tummy-time-floor-face-to-face` | Face-to-face floor tummy time | core | 1w–3m | gentle | HSE ×2 + spit-up | Quiet floor tummy time with face-to-face chat; effortful for the baby. |
| `act.tummy-time-reach-and-play` | Tummy time reach and play | core | 3m–8m | gentle | HSE ×2 + spit-up | Quiet, but the baby lifts, shifts weight and reaches. |
| `act.story-of-our-day` | Tell the story of your day | core | 4m–36m | settling | — | New. Quiet, slow retelling of familiar events while held close; no book, so distinct from the reading records. |
| `act.window-watch-in-arms` | Quiet window watching | core | 4m–18m | settling | — | New. Held still at a closed window watching something slow, with soft naming and long pauses. |
| `act.whisper-bye-bye-to-toys` | Whisper bye-bye to the toys | core | 12m–36m | settling | — | New. Slow, whispered, repeatable goodbye round ending in a cuddle; a familiar ritual, not a sleep method. |
| `act.coo-and-copy-chat` | Coo-and-copy chat | a | 1w–4m | gentle | — | Quiet turn-taking chat at a calm, alert moment; engaging rather than winding down. |
| `act.diaper-change-chat` | Diaper-change chat | a | 1w–4m | gentle | — | Everyday routine with chat; medium mess rules out settling. |
| `act.sway-and-hum` | Sway and hum | a | 1w–4m | settling | — | Slow rocking and soft humming while held; the steps already cover a baby who drifts off. |
| `act.read-aloud-anything` | Read aloud—any book | a | 1w–4m | settling | — | Quiet reading aloud while held close; reading is the calm example HSE (naps) and NHS (bedtime) give. |
| `act.bold-picture-gazing` | Bold picture gazing | a | 1w–3m | gentle | — | Quiet but alert looking at high-contrast pictures. |
| `act.rattle-look-and-listen` | Rattle look-and-listen | a | 1w–4m | gentle | — | Rattle sound (moderate noise) and eye tracking. |
| `act.pat-a-cake-touch-rhymes` | Pat-a-cake and toe rhymes | a | 1w–4m | gentle | — | Quiet, slow touch rhymes, but a playful game rather than a wind-down. |
| `act.gentle-hand-foot-massage` | Gentle hand-and-foot massage | a | 1w–4m | settling | — | Slow, steady strokes when the baby is quiet and alert. No feed rule: the source times only its tummy colic routine after feeds. |
| `act.diaper-off-kick-time` | Diaper-off kick time | a | 1w–4m | gentle | — | Self-paced kicking on the back; medium mess. No spit-up rule: limbs only, no belly pressure or adult-driven motion. |
| `act.play-gym-mat-gazing` | Play-gym gazing on the mat | a | 1w–4m | gentle | — | Quiet looking and batting under a play gym. |
| `act.side-lying-play` | Side-lying play | a | 1w–4m | gentle | — | Quiet positional play with a toy. |
| `act.mirror-hello-in-arms` | Mirror hello | a | 1w–4m | gentle | — | Held, quiet, engaging mirror chat. |
| `act.stroller-stroll-point-and-name` | Stroller stroll, point and name | a | 1w–4m | gentle | — | Calm, shaded stroller walk with naming; the baby rides. |
| `act.home-tour-in-arms` | Home tour in your arms | a | 1w–4m | gentle | — | Slow carried tour, stopping to name things; exploring rather than winding down. |
| `act.shade-sit-outdoors` | Sit outside in the shade | a | 1w–4m | settling | — | Sitting still in the shade with the baby in your arms, listening together. |
| `act.play-gym-bat-and-grab` | Play-gym batting on the mat | b | 3m–5m | gentle | — | Quiet swiping and grabbing on the back. |
| `act.toe-catch-back-play` | Toe-catching on the mat | b | 4m–7m | gentle | — | Quiet self-paced kicking and toe-catching. No spit-up rule: limbs only. |
| `act.chore-chat-from-the-mat` | Chore chat from the play mat | b | 3m–6m | gentle | — | Quiet chat while the baby watches a chore. |
| `act.rattle-track-and-grab` | Follow and grab the rattle | b | 3m–7m | gentle | — | Rattle sound (moderate noise), tracking and grabbing. |
| `act.babble-copycat-chat` | Babble copycat chat | b | 4m–8m | gentle | — | Turn-taking babble (moderate noise). |
| `act.body-part-action-song` | Body-part action song | b | 4m–8m | gentle | — | Slow action song; moderate noise rules out settling. |
| `act.bold-picture-lap-book` | Bold-picture book in your lap | b | 3m–6m | settling | — | Quiet book sharing in your lap; close it when the baby looks away. |
| `act.mirror-faces-together` | Mirror faces together | b | 4m–8m | gentle | — | Quiet, engaging mirror play. |
| `act.peekaboo-hands` | Peekaboo with your hands | b | 3m–8m | gentle | — | Surprise game (moderate noise); the steps slow it down if the baby startles. |
| `act.tummy-time-towel-roll` | Propped tummy time over a towel roll | b | 3m–6m | gentle | HSE ×2 + spit-up | Quiet propped tummy time; effortful for the baby. |
| `act.tummy-to-back-roll-practice` | Tummy-to-back roll practice | b | 3m–7m | gentle | HSE ×2 + spit-up | Floor tummy time with an assisted roll; positional work. |
| `act.side-lying-toy-play` | Side-lying two-hand play | b | 4m–6m | gentle | — | Quiet two-hand play on the side. |
| `act.supported-sit-lap-play` | Supported sitting in your lap | b | 4m–7m | gentle | — | Quiet supported sitting and reaching. No spit-up rule: the baby is upright, which the AAP page suggests after feeds. |
| `act.texture-touch-tour` | Texture touch tour | b | 3m–8m | gentle | — | Quiet, slow fabric brushing, but exploring new textures; kept gentle rather than settling. |
| `act.dressing-sleeve-peekaboo` | Sleeve peekaboo while dressing | b | 3m–8m | gentle | — | Everyday dressing with a playful game. |
| `act.shaded-stroller-walk` | Shaded stroller or carrier walk | b | 4m–6m | gentle | — | Calm, shaded walk with naming; the baby rides. |
| `act.cloth-peekaboo` | Peekaboo with a cloth | c | 8m–15m | gentle | — | Surprise game (moderate noise). |
| `act.put-in-tip-out` | Put in, tip out | c | 8m–12m | gentle | — | Seated dropping and tipping out (moderate noise). |
| `act.pot-and-spoon-band` | Pots and wooden spoon band | c | 7m–18m | lively | spit-up | Loud banging (loud records must be lively). Exciting play, so the spit-up advisory applies under 12 months. |
| `act.treasure-basket` | Treasure basket of household things | c | 6m–12m | gentle | — | Seated, self-paced exploring with the adult quiet beside. |
| `act.cushion-crawl-course` | Cushion hills crawl course | c | 8m–12m | lively | spit-up | Crawling over cushion hills with cheering: whole-body movement and belly contact. |
| `act.ball-roll-turns` | Roll the ball back and forth | c | 7m–12m | gentle | — | Seated turn-taking with a rolled ball. |
| `act.cruise-the-sofa` | Cruise along the sofa | c | 8m–15m | lively | spit-up | Pulling up and side-stepping: gross-motor practice is the point. |
| `act.point-and-name-books` | Point-and-name book time | c | 6m–12m | settling | — | Quiet book cuddle; a page or two counts. |
| `act.clap-and-wave-songs` | Clapping and waving songs | c | 8m–12m | gentle | — | Action songs (moderate noise). |
| `act.dressing-name-body-parts` | Name body parts while dressing | c | 8m–18m | gentle | — | Everyday dressing with naming and tickles. |
| `act.splash-and-pour` | Splash and pour water play | c | 6m–12m | lively | spit-up | Splashing and pouring: exciting, wet, with tidy-up. |
| `act.grass-blanket-explore` | Blanket on the grass | c | 6m–12m | gentle | — | Quiet touch-and-look on a shaded blanket; medium mess rules out settling. |
| `act.narrated-stroller-walk` | Narrated stroller walk | c | 6m–18m | gentle | — | Stroller walk with running commentary; the baby rides. |
| `act.bucket-swing` | Bucket swing at the playground | c | 7m–18m | lively | spit-up | Swinging at a playground: motion play in a busy place, even with slow pushes. |
| `act.play-yard-in-view` | Play yard play while you work nearby | c | 6m–12m | gentle | — | Quiet toy play in a play yard while you work nearby. |
| `act.safe-space-explore` | Free explore in a baby-safe room | c | 7m–12m | gentle | spit-up | Self-paced crawling and exploring: low-key, but whole-body movement, so the spit-up advisory applies under 12 months. |
| `act.push-toy-laps` | Push a box or push toy around | d | 12m–24m | lively | — | Walking laps pushing a basket; movement is the point. |
| `act.big-ball-kick-and-chase` | Kick and chase a big ball | d | 15m–30m | lively | — | Kicking and chasing a ball. |
| `act.freeze-dance-toddler` | Freeze dance | d | 12m–30m | lively | — | Loud music and dancing. |
| `act.bubble-pop-outside` | Bubble pop outside | d | 12m–30m | lively | — | Chasing and popping bubbles; exciting. |
| `act.toddler-action-songs` | Action songs with pauses | d | 15m–30m | gentle | — | Seated action songs (moderate noise). |
| `act.where-is-it-picture-book` | “Where’s the dog?” picture book | d | 15m–24m | settling | — | Quiet book sharing with the TV off. |
| `act.busy-basket-gated-space` | Busy basket in a gated play space | d | 15m–30m | gentle | — | Self-paced basket exploring (moderate noise). |
| `act.stack-and-topple` | Stack it and knock it down | d | 12m–30m | gentle | — | Seated building with short crashes (moderate noise). |
| `act.fill-and-dump-relay` | Fill-and-dump basket relay | d | 15m–24m | gentle | — | Quiet carrying at the toddler's own pace; medium mess from dumping. |
| `act.chunky-puzzle-or-sorter` | Chunky puzzle or shape sorter | d | 15m–30m | gentle | — | Quiet, focused puzzle; problem-solving can frustrate, so not classed as settling. |
| `act.feed-the-teddy` | Feed the teddy | d | 15m–30m | gentle | — | Quiet pretend play. |
| `act.hide-the-toy-hunt` | Find the hidden toy | d | 12m–24m | gentle | — | Quiet hide-and-find game. |
| `act.sock-basket-helper` | Sock basket helper | d | 15m–30m | gentle | — | Quiet helping routine. |
| `act.toddler-led-walk` | Toddler-led walk | d | 12m–30m | lively | — | About 25 minutes on the toddler's own feet outdoors: a physically active outing. |
| `act.playground-toddler-area` | Toddler area at the playground | d | 12m–24m | lively | — | Loud, busy playground climbing and sliding. |
| `act.water-scoop-tub` | Scoop-and-pour water tub | d | 15m–30m | lively | — | Quiet pouring but very messy water play (very messy records must be lively), with tidy-up. |
| `act.over-under-in-out` | Over, under, in and out | d | 15m–24m | lively | — | Crawling, climbing and in-and-out course. |
| `act.pretend-kitchen-cook` | Pretend cook with real pots | e | 24m–48m | gentle | — | Pretend play (moderate noise). |
| `act.big-box-car-or-house` | Big box car or house | e | 24m–48m | gentle | — | Imaginative box play and drawing. |
| `act.playdough-squish-and-roll` | Playdough squish and roll | e | 24m–36m | gentle | — | Calm table play, but medium mess rules out settling. |
| `act.paint-with-water-outside` | Paint with water outside | e | 24m–48m | gentle | — | Quiet water-brush painting outdoors. |
| `act.chalk-drawing-outside` | Chalk drawing outside | e | 24m–48m | gentle | — | Quiet chalk drawing outdoors. |
| `act.follow-the-leader-parade` | Follow-the-leader parade | e | 24m–36m | lively | — | Loud marching and stomping. |
| `act.floor-obstacle-course` | Floor-level obstacle course | e | 24m–48m | lively | — | Active course with stepping, crawling and jumping. |
| `act.color-sort-bowls` | Color sort into bowls | e | 24m–36m | gentle | — | Quiet sorting at the table. |
| `act.carry-to-the-table-helper` | Carry-to-the-table helper | e | 24m–36m | gentle | — | Quiet helping routine. |
| `act.wipe-the-table-helper` | Wipe-the-table helper | e | 24m–48m | gentle | — | Quiet helping routine. |
| `act.who-what-where-book-chat` | Who, what, where? Book chat | e | 24m–36m | settling | — | Quiet shared picture book. |
| `act.library-story-time` | Library story time | e | 24m–48m | variable | — | Depends on the session (quiet stories or lively rhymes with actions) and the trip; the record already suggests a session that misses nap time. |
| `act.preschool-playground-area` | Playground: the 2-to-5 area | e | 24m–36m | lively | — | Loud, busy playground. |
| `act.nature-find-walk` | Nature find walk | e | 24m–36m | lively | — | Walking hunt outdoors: a physically active outing. |
| `act.big-sticker-picture` | Big-sticker picture | e | 30m–48m | gentle | — | Quiet table craft. |
| `act.sit-down-snack-together` | Sit-down snack together | e | 12m–60m | gentle | — | Seated snack and chat; medium mess. No meal rule: no source reviewed supports one. |
| `act.calm-show-while-you-cook` | One calm show while you cook | e | 24m–60m | variable | — | Screen: depends on the show. AAP's screen-free hour is about bedtime, not naps. |
| `act.watch-one-together-and-talk` | Watch one together and talk | e | 24m–60m | variable | — | Screen: depends on the episode and the talk afterward. |
| `act.copycat-moves` | Copycat moves: hop, tiptoe, march | f | 36m–60m | lively | — | Loud hopping, jumping and marching. |
| `act.red-light-green-light` | Red light, green light | f | 36m–60m | lively | — | Loud running-and-freezing game. |
| `act.throw-catch-kick` | Throw, catch and kick a big ball | f | 36m–60m | lively | — | Throwing, catching and kicking. |
| `act.trike-or-balance-bike-ride` | Trike or balance-bike ride on a path | f | 36m–60m | lively | — | Riding outing; high effort. |
| `act.preschool-playground` | Playground: climb, slide and swing | f | 36m–60m | lively | — | Loud, busy playground. |
| `act.nature-hunt-and-count` | Nature hunt: find and count | f | 36m–60m | lively | — | Walking outing: physically active. |
| `act.big-small-opposites-game` | Big and small opposites game | f | 36m–60m | lively | — | Whole-body moves with fast and loud parts. |
| `act.what-happens-next-book` | Picture book: what happens next? | f | 36m–60m | settling | — | Quiet shared picture book. |
| `act.take-turns-story` | Take-turns made-up story | f | 36m–60m | settling | — | Quiet, slow turn-taking storytelling. |
| `act.i-spy-colors-sounds` | I spy: colors, shapes and sounds | f | 36m–60m | gentle | — | Quiet looking-and-guessing game. |
| `act.memory-match-cards` | Matching pairs memory game | f | 36m–60m | gentle | — | Quiet turn-taking card game. |
| `act.sock-match-and-sort` | Sock matching and laundry sort | f | 36m–60m | gentle | — | Quiet sorting job. |
| `act.draw-and-tell` | Draw, then tell me about it | f | 36m–60m | gentle | — | Quiet drawing, then telling. |
| `act.jigsaw-at-the-table` | Jigsaw puzzle at the table | f | 36m–60m | gentle | — | Quiet, focused puzzle. |
| `act.playdough-squish-and-shape` | Playdough squish, roll and cut | f | 36m–60m | gentle | — | Calm table play; medium mess. |
| `act.scissor-snipping` | Snip paper strips with child scissors | f | 36m–60m | gentle | — | Focused fine-motor work; medium mess. |
| `act.wash-fruit-and-veg` | Wash the fruit and veg | f | 36m–60m | gentle | — | Quiet water job at the sink; medium mess. |
| `act.tear-and-spread-helper` | Kitchen helper: tear and spread | f | 36m–60m | gentle | — | Food-prep job at the table; medium mess. |
| `act.plant-and-water-seeds` | Plant seeds and water them | f | 36m–60m | lively | — | Quiet but very messy (soil and water); very messy records must be lively. |
| `act.smell-flower-blow-candle` | Smell the flower, blow the candle | f | 36m–60m | settling | — | Slow breathing game. |
| `act.calm-corner-together` | Make a calm-down corner together | f | 36m–60m | settling | — | Quiet, low-mess calm corner with slow breaths. |
| `act.held-slow-dance` | Slow dance with your baby in your arms | mix | 4m–12m | gentle | — | Slow sway with the baby held upright; music (moderate noise) rules out settling. No spit-up rule: held upright, no bouncing. |

## Recipes (29)

Counts (shared space): settling 2, gentle 19, lively 8, variable 0.

| Recipe | Title | Younger role (stimulation) | Older role (stimulation) | Shared | Mixed-age notes |
|---|---|---|---|---|---|
| `mix.tummy-time-book-helper` | Tummy time with a toddler book helper | 3m–8m `act.tummy-time-reach-and-play` (gentle; HSE ×2 + spit-up) | 24m–36m `act.who-what-where-book-chat` (settling) | gentle | Quiet floor session. The baby's tummy-time feed rules (avoid) and spit-up advisory apply to the baby only; the toddler's book role is settling, so a toddler's nap doesn't count against it. |
| `mix.tummy-time-picture-show` | Tummy time picture show by a preschooler | 3m–8m `act.tummy-time-reach-and-play` (gentle; HSE ×2 + spit-up) | 36m–60m `act.what-happens-next-book` (settling) | gentle | As above: the baby's feed rules make it unsuitable just before or after the baby's feed, never because of the preschooler. |
| `mix.newborn-sway-toddler-dance` | Sway with the newborn, dance with your toddler | 1w–4m `act.sway-and-hum` (settling) | 15m–30m `act.freeze-dance-toddler` (lively) | lively | Loud music and dancing fill the room. The baby's own role is settling, but the shared lively space puts it "better earlier" before the baby's nap too. |
| `mix.slow-dance-follow-the-leader` | Slow dance parade: baby in arms, toddler leads | 4m–12m `act.held-slow-dance` (gentle) | 24m–36m `act.follow-the-leader-parade` (lively) | lively | The toddler's loud parade sets the shared space; the held baby gets the lively nap preferences. |
| `mix.newborn-stroll-toddler-walks` | Stroller stroll with a walking toddler | 1w–4m `act.stroller-stroll-point-and-name` (gentle) | 18m–30m `act.toddler-led-walk` (lively) | gentle | The baby rides on a calm path; the toddler's own walking role stays lively for the toddler. |
| `mix.shaded-walk-nature-find` | Shaded stroller walk with a toddler nature hunt | 4m–6m `act.shaded-stroller-walk` (gentle) | 24m–36m `act.nature-find-walk` (lively) | gentle | Calm shaded walk for the baby; the toddler's walking hunt stays lively for the toddler. |
| `mix.stroller-walk-toddler-hunt` | Stroller walk with a toddler treasure hunt | 6m–18m `act.narrated-stroller-walk` (gentle) | 24m–36m `act.nature-find-walk` (lively) | gentle | Calm stroller ride for the baby; the toddler's walking hunt stays lively for the toddler. |
| `mix.newborn-story-big-kid-reader` | Sofa story: newborn listens, big kid tells | 1w–4m `act.read-aloud-anything` (settling) | 36m–60m `act.what-happens-next-book` (settling) | settling | Quiet sofa story; both roles settling, so it can fit before either child's nap. |
| `mix.baby-book-big-kid-story` | Two books: baby's board book, big kid's story | 6m–12m `act.point-and-name-books` (settling) | 36m–60m `act.what-happens-next-book` (settling) | settling | Quiet two-book session; both roles settling. |
| `mix.action-song-circle` | Action songs for a baby and a toddler | 4m–8m `act.body-part-action-song` (gentle) | 15m–30m `act.toddler-action-songs` (gentle) | gentle | Seated songs (moderate noise); the steps stop before anyone gets wound up. |
| `mix.diaper-change-helper` | Diaper change with a toddler helper | 1w–4m `act.diaper-change-chat` (gentle) | 15m–30m `act.sock-basket-helper` (gentle) | gentle | Everyday routine with a fetching job. |
| `mix.two-toddlers-freeze-dance` | Freeze dance for two toddlers | 12m–30m `act.freeze-dance-toddler` (lively) | 12m–30m `act.freeze-dance-toddler` (lively) | lively | Loud music and dancing for both. |
| `mix.big-kid-leads-toddler-copies` | Big kid leads the moves, toddler copies | 12m–30m `act.freeze-dance-toddler` (lively) | 36m–60m `act.copycat-moves` (lively) | lively | Loud copycat moves to music for both. |
| `mix.opposites-parade` | Opposites parade for a toddler and a big kid | 24m–36m `act.follow-the-leader-parade` (lively) | 36m–60m `act.big-small-opposites-game` (lively) | lively | Marching with loud and fast parts for both. |
| `mix.seated-snack-for-two` | Seated snack for two | 12m–60m `act.sit-down-snack-together` (gentle) | 12m–60m `act.sit-down-snack-together` (gentle) | gentle | Seated snack. No meal-timing rule: no source reviewed supports one. |
| `mix.playground-stroller-spotting` | Playground: big kid climbs low, baby in the stroller | 6m–18m `act.narrated-stroller-walk` (gentle) | 36m–60m `act.preschool-playground` (lively) | lively | Playground noise and bustle reach the baby in the stroller, so the baby gets the lively nap preferences too. |
| `mix.mat-and-table-side-by-side` | Baby on the mat, toddler at the table | 4m–7m `act.toe-catch-back-play` (gentle) | 15m–30m `act.chunky-puzzle-or-sorter` (gentle) | gentle | Quiet side-by-side play. |
| `mix.tummy-time-and-pretend-kitchen` | Tummy time while the toddler cooks for you | 3m–8m `act.tummy-time-reach-and-play` (gentle; HSE ×2 + spit-up) | 24m–48m `act.pretend-kitchen-cook` (gentle) | gentle | The baby's tummy-time feed rules apply to the baby only; the toddler's pretend cooking is unaffected by the baby's feed. |
| `mix.sofa-cuddle-sock-sort` | Baby in your arms, toddler sorts socks | 1w–4m `act.coo-and-copy-chat` (gentle) | 15m–30m `act.sock-basket-helper` (gentle) | gentle | Quiet cuddle chat, but the toddler's sock game keeps it engaging. |
| `mix.newborn-mat-teddy-meal` | Newborn on the mat, toddler feeds the teddy | 1w–4m `act.play-gym-mat-gazing` (gentle) | 15m–30m `act.feed-the-teddy` (gentle) | gentle | Quiet side-by-side play. |
| `mix.newborn-mat-sock-match` | Newborn on the mat, big kid matches socks | 1w–4m `act.play-gym-mat-gazing` (gentle) | 36m–60m `act.sock-match-and-sort` (gentle) | gentle | Quiet side-by-side play and a sorting job. |
| `mix.play-yard-and-color-sort` | Baby in the play yard, toddler sorts colors | 6m–12m `act.play-yard-in-view` (gentle) | 24m–36m `act.color-sort-bowls` (gentle) | gentle | Quiet side-by-side play. |
| `mix.treasure-basket-and-sock-match` | Treasure basket for baby, socks for the big kid | 6m–12m `act.treasure-basket` (gentle) | 36m–60m `act.sock-match-and-sort` (gentle) | gentle | Quiet exploring beside a sorting job. |
| `mix.blanket-and-red-light` | Baby on a blanket, big kid plays red light | 6m–12m `act.grass-blanket-explore` (gentle) | 36m–60m `act.red-light-green-light` (lively) | lively | The preschooler's loud running game shares the yard, so the baby on the blanket gets the lively nap preferences too. |
| `mix.blanket-and-bubbles` | Baby on a blanket, toddler chases bubbles | 6m–12m `act.grass-blanket-explore` (gentle) | 12m–30m `act.bubble-pop-outside` (lively) | lively | Bubble chasing shares the space; exciting for both. |
| `mix.two-toddlers-blocks-and-puzzle` | Two toddlers: one stacks, one puzzles | 12m–30m `act.stack-and-topple` (gentle) | 15m–30m `act.chunky-puzzle-or-sorter` (gentle) | gentle | Seated blocks and a puzzle in separate spots. |
| `mix.toddler-blocks-big-kid-socks` | Toddler stacks blocks, big kid matches socks | 12m–30m `act.stack-and-topple` (gentle) | 36m–60m `act.sock-match-and-sort` (gentle) | gentle | Seated blocks beside a sorting job. |
| `mix.toddler-kitchen-big-kid-memory` | Toddler cooks, big kid plays memory match | 24m–48m `act.pretend-kitchen-cook` (gentle) | 36m–60m `act.memory-match-cards` (gentle) | gentle | Pretend play beside a quiet card game. |
| `mix.twin-quiet-table` | Quiet table for two: drawing and a jigsaw | 36m–60m `act.draw-and-tell` (gentle) | 36m–60m `act.jigsaw-at-the-table` (gentle) | gentle | Quiet table, but both roles are focused creative work. |

### Mixed-age implications

- **Tummy-time recipes** (`mix.tummy-time-book-helper`, `mix.tummy-time-picture-show`,
  `mix.tummy-time-and-pretend-kitchen`): left out of automatic suggestions, and
  flagged if placed, just before or after the **baby's** milk feed (HSE rules), with
  the spit-up advisory for the baby too. A toddler's or preschooler's meal or nap
  never counts against them through the baby's rules.
- **Lively shared spaces with a baby** (`mix.newborn-sway-toddler-dance`,
  `mix.slow-dance-follow-the-leader`, `mix.playground-stroller-spotting`,
  `mix.blanket-and-red-light`, `mix.blanket-and-bubbles`): the baby's own role is
  calmer, but the shared space is loud or exciting, so "Better earlier" applies before
  the baby's nap and "Ease in after waking" after it.
- **Walks with a walking toddler** (`mix.newborn-stroll-toddler-walks`,
  `mix.shaded-walk-nature-find`, `mix.stroller-walk-toddler-hunt`): the shared path is
  calm for the riding baby; the toddler's own walking role stays `lively` for the
  toddler.
- **Settling recipes** (`mix.newborn-story-big-kid-reader`, `mix.baby-book-big-kid-story`)
  can show "Good for winding down" before either child's nap.
- **Seated snack for two** has no meal-timing rule; food activities are never
  auto-added by the planner anyway.

## Starter plan with a routine block

`plan.baby-nap-toddler-alongside` (4 months + 28 months, one adult): side-by-side
mat-and-table play, a short break, an example **nap block for the baby** (`at` 15,
45 minutes), the toddler's colour sorting then pretend cooking **alongside** the nap,
then action songs together. Its summary says the times are an example to edit and
that Trunk never sets nap times or lengths; there is no feed block and no wake
window. Checked with `analyzePlan`: no structure issues or conflicts, the alongside
activities are busy-nearby compatible (the nap's settling time is unknown, so the
adult counts as busy), the songs after the nap get "Gentle start after waking", and
the toddler has 5 unplanned minutes at the end of the nap (reported as a gap with
the adult busy). Validated by the content validator.

### Existing starters reordered (follow-up)

Breaks are not routine blocks, so the evaluator cannot see a break labelled as a
feed or nap. Both starters were reordered so they would still be fine if those
breaks became real blocks (checked by replacing each feed- or nap-labelled break with
a routine block at the same time and running `analyzePlan`: no avoid, caution or
conflict). Labels stay responsive ("if your baby is ready", "or a cuddle"); no feed
time is prescribed and no routine block was added.

- `plan.gentle-newborn-hour` (rev 2): chat, then floor tummy time, cuddle and rest,
  bold pictures, a neutral "Diaper, cuddle or nap: whatever your baby needs" break,
  the slow sway, then "Feed or sleep if your baby is ready". Tummy time ends about
  33 minutes before the only feed-labelled break.
- `plan.rainy-afternoon-4m-28m` (rev 2): tummy-time book session first, then the
  slow dance parade, side-by-side play, the "Baby feed or cuddle" break, action songs,
  and "Rest, or a nap for the baby". Tummy time ends about 32 minutes before the feed
  break; the lively parade ends about 35 minutes before the nap break, outside the
  30-minute editorial window, and gentle songs come just before it. Summary updated to
  the new order.

## New settling activities (follow-up)

The first pass left 4 months to under 3 years with one settling option per slider
stop or none (12–14 months). Three new, distinct records were added to
`content/core.json`. None widens an existing age range, none is a renamed book or
song record, all are quiet with no mess, and none promises sleep.

| Activity | Ages | Idea | Evidence (adapted) | Safety |
|---|---|---|---|---|
| `act.story-of-our-day` | 4m–36m | Held close, tell the child the simple story of their day in a quiet voice; no book. Babies listen; toddlers point or fill in. | `clm.core.who-reading-storytelling` (WHO: storytelling with a caregiver), `clm.c.narrate-everyday` (talk about everyday things, build on sounds), `clm.core.hse-nap-calm-routine` (a story in a calming voice) | Only while the adult is wide awake; a child who dozes off goes on their back in their own sleep space (`clm.core.stay-awake-holding`, `clm.core.sleep-on-back`). |
| `act.window-watch-in-arms` | 4m–18m | Held at a closed window, watch something slow (leaves, rain, clouds) and name it softly with long pauses. | `clm.b.talk-while-doing-tasks` (talk about what the baby is looking at), `clm.c.name-on-walks` (name what they look at) | Hold the child yourself, never on a sill or furniture by the window; keep clear of blind and curtain cords (`clm.c.stairs-windows`, `clm.c.cords-away`); sleep-on-back note. |
| `act.whisper-bye-bye-to-toys` | 12m–36m | A slow, whispered goodbye round to a few familiar toys and things, ending in a cuddle, with their comforter if they have one. | `clm.core.hse-nap-calm-routine`, `clm.core.nhs-bedtime-wind-down` (bedtime-scoped), `clm.core.hse-comforter-after-12m` (new claim) | Comforters and soft toys are for over-1s (HSE); for babies, soft toys and loose blankets stay away from the face and out of the sleep space (`clm.a.keep-face-clear`). |

Why each is settling and not gentle: the noise is quiet, there is no mess, the pace
is slow, the content is familiar (the child's own day, the same view, the same
toys), and the adult keeps it low-key. The goodbye round is described as a familiar
way to slow down, not a sleep method. No existing record's `noise` value was
changed.

## Unresolved

Records deliberately marked `variable` (never treated as calm, never cleared;
the evaluator reports them as unassessed):

- `act.library-story-time` (Library story time): depends on the session (quiet
  stories or lively rhymes with actions) and on the trip there. The record already
  suggests a session that misses nap time.
- `act.calm-show-while-you-cook` (One calm show while you cook): depends on the
  show. The AAP's screen-free hour is about bedtime, not naps, so it does not settle
  the question.
- `act.watch-one-together-and-talk` (Watch one together and talk): depends on the
  episode and the talk and play afterward.

No recipe is `variable`.

Judgment calls that are classified but worth a second look:

- `act.bucket-swing` is `lively` despite slow pushes, because it is motion play at a
  playground.
- `act.safe-space-explore` is `gentle` (self-paced) but carries the spit-up advisory
  (whole-body crawling).
- `act.pot-and-spoon-band` and `act.splash-and-pour` carry the spit-up advisory on
  the "overstimulation" reading of the AAP page, although the baby is seated.
- `act.texture-touch-tour` and `act.chunky-puzzle-or-sorter` are `gentle`, not
  `settling` (exploring new textures; problem-solving).
- Walking outings (`act.toddler-led-walk`, `act.nature-find-walk`,
  `act.nature-hunt-and-count`) are `lively`; stroller walks where the baby rides are
  `gentle`.

## Coverage gaps (settling options at each slider stop)

From `reports/coverage.md` (threshold: 2 settling activities per stop).

- **First pass:** 4–11 months had 1, 12–14 months had none, and 15 months to 2 years
  11 months had 1.
- **After the follow-up:** every stop from 4 months to under 3 years has at least 3
  (4–14 months: 3; 15–17 months: 4; 18 months to 2 years 11 months: 3). Under 4
  months has 4–5 and 3 years and over has 4. No settling gap remains at the current
  threshold.

The gaps were closed with new records, not by widening ages or softening
classifications.

## Open questions

1. **Meal blocks for babies 6–12 months.** The AAP page says "after meals", meaning
   milk feeds. The advisory is keyed to milk feeds, so a plan's `meal` block for a
   9-month-old does not trigger it. A meal twin would be defensible but would
   duplicate the finding when "Just fed" emits both events. Lead/evaluator call.
2. **Upright holding.** The AAP's "hold your baby upright for at least 20 minutes"
   is not encoded; Trunk has no way to represent it without prescribing a routine.
3. **Rule revisions.** Three nap policy rules moved to `rev: 2` for wording and
   claims. If shared plans or caches compare rule revisions, the lead should confirm
   that is expected.
4. **Where the new settling records live.** They sit in `content/core.json` because
   they span several age bands; the lead may move them to a band file (ids stay).

Resolved in the follow-up: the massage step now uses its source's framing; the two
older starters were reordered; `src.hse.tummy-time` keeps its URL with a note that
HSE also serves it on `www2.hse.ie`.

## Lead addendum (2026-10-30, after independent review)

- **Meal blocks and tummy time (review m5).** HSE says "feed". For babies under 12 months, Trunk now also keeps tummy time away from parent-placed meal and snack blocks (`tim.core.tummy-after-meal-under-12m`, `tim.core.tummy-before-meal-under-12m`). These are editorial rules citing `clm.core.hse-not-around-feeds` as the informing claim; the reasons say the wider reading and the minutes are Trunk's conventions.
- **Starter `plan.baby-nap-toddler-alongside`.** The example nap now carries an example settling time (10 minutes), so the toddler's alongside play starts once the adult is free; its summary calls the nap's time, length, and settling time placeholders.
- **`act.supported-sit-lap-play`.** Step changed from "on their back or tummy" to "on their back" (rev bumped): the record has no feed rules, so it shouldn't prompt tummy time that could land right after a feed (review m6).
- **Claim wording (review n1).** `clm.core.hse-not-around-feeds` and `clm.core.aap-spit-up-limit-active-play` reworded further from the sources' sentences.
