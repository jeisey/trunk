# UI review: integrated refinement

Independent agent review of the UI only. This is not a clinician's approval. I wrote none of the code reviewed here.

- **Reviewed:** branch `claude/admiring-ptolemy-60r1t0`. I walked the flows on builds of `f110da6` plus the working tree, then rebuilt at `dc0c0b6` and re-ran the label and menu checks. The UI files (`src/components`, `src/export`, `src/styles.css`, and `src/App.tsx` apart from a storage-status tweak) did not change between those builds.
- **Out of scope:** `src/lib/{planner,sequence,storage}.ts`. Where an observed result comes from one of those files, this document says so.
- **How:** production build served under `/trunk/` by `e2e/serve.mjs`, driven by Playwright Chromium:
  - 390×844 with touch emulation, plus 320×640, 360, 375, 414, 768×1024 and 1280×800.
  - Clock fixed at 09:50 UTC so times are repeatable.
- **Artifacts:** scratch scripts are in `/tmp/claude-0/-home-user-trunk/7ea7985d-3db8-5064-9e3a-ea60d5466971/scratchpad/ui/`. Screenshots are in `…/scratchpad/ui/shots/` and exported PNGs in `…/scratchpad/ui/png/`. In the findings below, `shots/` and `png/` mean those folders.
- **Existing checks:** `npx vitest run` passed 252/252. `npx playwright test` passed 36/36. Several findings below fall in gaps those suites don't cover.

## Summary

The refinement mostly delivers the brief:

- **Find:** the first load is compact, and the first activity card is readable at 390×844.
- **Right now:** "Just fed" and "Nap soon" are independent, per-child and momentary. I could not find them in storage, the draft, a share link or a plan file.
- **Planner:** the routine-block planner has a blank-plan path, a keyboard-operable Add block menu, and nap, feed, meal, snack and custom-entry forms with no preset lengths. Unknown nap availability leaves time unplanned.
- **Saved:** the list uses the linked-title plus More-menu pattern.
- **Caveats:** generic clinical caveats appear only on About.
- **Exports:** images use the real logo and keep the URL, page numbers and "Estimated times".
- **Bundle:** initial JS is about 190.6 KB gzip. Evidence, the planner and image export load on demand.

The serious problems are in narrow-phone layout, keyboard focus, and a few places where the UI applies its own rules or labels instead of the shared ones:

1. **Blocker:** on phones 375 px wide or narrower, the row "⋯" menu (Set a time, Swap, Keep, Duplicate, Remove) opens mostly off the left edge of the screen.
2. **Major:** a one-child plan made for **Child 2** is labelled **Child 1** in the plan rows, the share preview and the image. The same screen says "Planned for: Child 2…".
3. **Major:** the shared-link preview drops every activity's safety line. The editor and the images keep them.
4. **Major:** focus falls to `<body>` after about ten common actions, including Escape on the share and image dialogs. The Undo toast disappears after 8 s and is about 20 Tab presses away.
5. **Major:** an entry given a set time inside a nap is listed out of chronological order. Its conflict appears only on the nap row, and the offered repair creates a new conflict.
6. **Major:** "Add to plan" from a detail page uses its own rule to place an activity alongside a nap. It will place one into time whose adult availability is unknown, then shows a success toast.
7. **Major:** the Timing section on detail pages lists every rule: 6 orange rows on tummy time and 8 on a pairing, including meal rules for a 4-month-old. This pushes Steps below the fold.
8. **Major:** the "Baby naps, toddler plays nearby" starter pre-fills a 45-min nap and a 10-min settling time, and labels them "Your estimate".
9. **Major:** on the Plan screen, keyboard focus can land fully under the fixed bottom nav.

## Findings

### Blocker

#### B1. Row "⋯" menus open off-screen on 375/360/320 px phones

**Where**
- `src/components/MoreMenu.tsx`
- `src/styles.css:1817-1831`: `.menu { position:absolute; right:0; min-width:12rem }`
- `src/styles.css:1626-1632`: `.seg-tools { flex-wrap: wrap }`

**Repro**
1. Use two children, 4 and 28 months.
2. Make a plan with a nap and toddler play alongside: Any → Make a plan → Start a blank plan → Nap for Child 1 at 10:00, 1 hr → set "Free after settling about 10 min" → Fill around these blocks.
3. At a 375×667 viewport, tap "⋯" on any entry in the alongside track.

**What happens**
The `.seg-tools` row wraps, so "⋯" lands at the start of a new line. The menu is anchored to the right edge of that button, so it extends left past the viewport edge:
- 8 of 12 row menus are off-screen at 375 px (menu `left = -90 px`).
- 10 of 12 at 360 px.
- 12 of 12 at 320 px. Main-sequence rows sit at `left = -119 px`.
- 0 of 12 at 390 and 414 px.

The labels are unreadable and can't be scrolled into view. Set a time, Swap, Keep when filling, Duplicate and Remove are effectively unusable by touch on common phones.

**Screenshots**
- `shots/menu-375-row-offscreen.png`
- `shots/menu-320-100-row.png`

**Fix**
Pick the menu's side from the button's position, or clamp it to the viewport. For example, measure `getBoundingClientRect()` when the menu opens, then set `left: 0; right: auto` when the button sits in the left half. Also stop the tools row from wrapping "⋯" on its own line (`flex-wrap: nowrap` with a narrower resize group), or show the menu as a bottom sheet below about 400 px. Add a Playwright check at 320, 360 and 375 that every open `[role=menu]` stays within `0…innerWidth`.

### Major

#### M1. A one-child plan for Child 2 is labelled Child 1 on screen, in shares and in images

**Where**
- `src/App.tsx:242`: `labels: indexes.map(i => childLabel(i…))` uses the index on Find.
- `src/components/planDisplay.ts:76` and `:91`: `entryRoles` falls back to `'Child 1'` in one-child plans.
- `src/components/ShareDialog.tsx:117`
- `src/export/render.ts:246`
- `src/components/SharedView.tsx:20`

The last three number children by their index in the plan.

**Repro**
1. Set Child 1 to 28 months and Child 2 to 4 months.
2. Set "Who's this for?" to Child 2, then toggle Child 2 "Nap soon".
3. Tap "Plan the next 30 minutes".

**What happens**
- The Plan screen shows "Planned for: Child 2 nap soon", but every row reads "Child 1: …".
- The share preview says "Child 1: about 4 months".
- The image header says "Child 1: about 4 months".
- Find had just said "Ideas for Child 2 only".

**Screenshots**
- `shots/crop-focus-child2.png`
- `png/focus-child2-1.png`

**Fix**
A one-child plan has only one child, so use one label everywhere. Either use no number ("Your child", or the age, e.g. "4 mo"), or keep the original index in memory and use it for the moment line too. The cheapest consistent fix is to derive `planMoment.labels` from the plan's own indexes (`'Child 1'` in one-child plans), or to drop the number when `plan.kids.length === 1`.

#### M2. The shared-link preview omits safety instructions

**Where**
`src/components/PlanPreview.tsx:16-55`. This file renders roles, cues, `timeIssue` and conflicts, but not `activity.safety[0]` or `recipe.safety[0]`.

**Repro**
1. Share any plan.
2. Open the link in a fresh browser.

**What happens**
"Support the baby in your lap… no bouncing or lifting games" and every other per-entry safety line is missing. The editor shows them (`PlanEditor.tsx:611`) and so does the image export (`render.ts:269-274`). The recipient, who may be the person actually carrying out the plan, sees the least safety information.

**Screenshot**
`shots/shared-fresh.png`

**Fix**
Render the same safety line as the editor, using the same "two lines for serious hazards" rule as `render.ts`, ideally from one shared helper in `planDisplay.ts`.

#### M3. Keyboard focus is dropped to `<body>` after common actions

**Where**
Focus lands on `<body>` after each of these (each measured):

| Action | Code |
|---|---|
| Start a blank plan | `App.tsx:246`; the button unmounts |
| Fill the next N minutes (planner) | `PlannerView.tsx:203` |
| Applying any conflict repair | `PlanEditor.tsx:418-426` |
| Extend to N min | `PlanEditor.tsx:740-748` |
| Close plan | `App.tsx:546` (`onClear`) |
| Reset on Find | `FinderView.tsx:241-252`; the button unmounts |
| Remove child | `AgeControl.tsx:181` |
| Undo in the toast | `Toast.tsx` |
| **Escape** on the share and image dialogs | `ShareDialog.tsx:85`, `ExportDialog.tsx:52`; `onCancel={onClose}` unmounts the `<dialog>` before the browser restores focus |

The Close *button* on the share dialog does return focus to "Share link". Escape does not.

**Repro**
Tab to any of the controls above and press Enter or Escape, then check `document.activeElement`.

**Fix**
- After each of these actions, move focus to a stable target: the plan's H1, the "+ Add block" button, the repaired row's title (`focusSoon` already exists), the next child card, or the More button.
- For dialogs, drop `onCancel={onClose}` and let the native `close` event fire, or store the opener and refocus it in `onClose`.

#### M4. The Undo toast is effectively unreachable by keyboard

**Where**
- `src/components/Toast.tsx:12`: 8 s fixed timer.
- The toast is placed after `<nav>` in the DOM.

**Repro**
1. Saved → More → Delete, using the keyboard.
2. Tab toward Undo.

**What happens**
Undo is 20 Tab presses away and the timer does not pause on focus or hover. Delete has no confirmation, so Undo is the only recovery. That makes this a WCAG 2.2.1 problem for a destructive action.

**Screenshot**
`shots/saved-deleted-toast.png`

**Fix**
- Pause the timer while the toast has focus or hover, and lengthen it for actions.
- Better, show an inline "Deleted '…' · Undo" row in place of the deleted list item, where focus already is.

#### M5. A set time inside a nap breaks the chronological list and puts the conflict in the wrong place

**Where**
`planRows` in `src/components/planDisplay.ts:163-187` orders by group. The overlap conflict comes from `layout.ts` (context): it is attached only to the earlier entry.

**Repro**
1. Using the B1 plan, open "⋯" on "Baby on the mat, toddler at the table".
2. Choose Set a time and enter 10:30.

**What happens**
- **Order:** the pairing is listed after the whole nap track, so a 10:30 row appears below the 10:57 entry.
- **Conflict placement:** the pairing's own row shows no conflict. The only signal is on the Nap row, several screens up: "Runs 30 min into Baby on the mat… at its set time".
- **Missed conflict:** Child 2 is now double-booked (Book chat 10:23–10:34 and the pairing at 10:30), and nothing flags it.
- **Cascading repair:** the one repair, "Move … 30 min later", moves the pairing to 11:00, onto the milk feed. That raises a new conflict.

**Screenshots and output**
- `shots/crop-settime-bottom.png`
- the output of `…/ui/conflicts.mjs` and `…/ui/repair2.mjs`

**Fix**
- Show the conflict on both entries (`other`).
- Sort main rows by start time even when that splits a track.
- Check main-sequence entries against along entries for the same child.
- Offer only repairs that `analyzePlan` confirms leave no new conflict: simulate the repair first, or offer "Move after the nap and feed".

#### M6. "Add to plan" from a detail page uses its own feasibility rule

**Where**
`src/App.tsx:337-339`:
```ts
const host = analysis.gaps.find((g) => g.who === who && g.host !== undefined && g.adult !== 'undivided' && g.end - g.start >= item.duration.min)?.host;
```
This accepts gaps where the adult is `'unknown'` or `'busy'`.

**Repro**
1. Use two children, 28 and 4 months, with Find set to Child 1.
2. Open a plan where Child 2 has a nap with "Not sure yet".
3. Open "Kick and chase a big ball" and tap Add to plan.

**What happens**
- The toast says "Added … for Child 1 alongside the other child's routine".
- The row immediately shows "Trunk doesn't know when you'll be free during Child 2's nap…".
- This contradicts the brief's "unknown availability leaves time unplanned". It is also the one place where the UI applies its own rule instead of the shared analysis. Elsewhere it uses `analyzePlan` and `optionsForSlot`.

**Fix**
Pick the host with the same check the editor's "+ Add for Child N" uses (`optionsForSlot(c, plan, { host })`, or a layout-level "fits alongside" helper). Otherwise add the activity to the main sequence.

#### M7. Detail-page Timing lists every rule, not only relevant ones

**Where**
- `src/components/Cues.tsx:75-99` (`TimingRules`)
- `src/components/Details.tsx:87-88` (`rulesForAge`)

**What happens**
- On "Tummy time reach and play" for a 4-month-old, there are 6 rows, 5 of them orange caution boxes: "Not right after a feed", "Not right before a feed", "Spits up?…", "Not right after eating", "Not right before eating".
- At 390 px, Steps starts at y = 768, behind the sticky Add button.
- On the tummy-time pairing there are 8 rows, and Steps starts at y = 1556.
- The two meal rules are shown for a baby who can't have meal blocks: meals are limited to children 6 months and older.

The brief asks for "only relevant concise cues", "no badge per property" and Steps at point of use.

**Screenshots**
- `shots/detail-tummy-4m.png`
- `shots/recipe-768.png`

**Fix**
- Show at most one line, for example "Best not right before or after a feed · Why?", plus any rules that apply now (from the moment toggles).
- Put the rest in a single "Timing notes (5)" disclosure.
- Hide meal rules when the child is under 6 months.

#### M8. The starter plan pre-fills a nap length and settling time labelled "Your estimate"

**Where**
- Catalog starter `plan.baby-nap-toddler-alongside`: `{"routine":"nap","minutes":45,"at":15,"settle":10}`
- Rendered through `PlannerView.tsx` `useStarter`
- The tag at `PlanEditor.tsx:580`

**Repro**
1. Use two children, 4 and 28 months.
2. Planner (Any) → "Baby naps, toddler plays nearby" → Use and edit this plan.

**What happens**
- The plan contains a 45-min Nap tagged "Your estimate", with "Free after settling about 10 min" already chosen.
- The "placeholders" note was only on the starter card, which is now gone.
- This conflicts with "no prescribed nap length" and with "unknown availability leaves time unplanned" (the settling time is preset).

**Fix**
- When a starter is used, mark its routine rows "Example time, change to yours" until edited.
- Default `settle` to unknown, so the toddler's time stays unplanned until the parent says otherwise.
- Or drop routine blocks from starters and prompt "Add your baby's nap".

#### M9. Keyboard focus can be hidden under the fixed bottom nav (WCAG 2.4.11)

**Where**
`src/styles.css`. There is no `scroll-padding-bottom`, and `.bottom-nav` is fixed at 64 px.

**Repro**
Tab through the Plan screen at 390×844.

**What happens**
10 of 116 focus stops sit fully under the nav. For example, "Kick and chase a big ball" is at y = 820–844 with the nav top at 779, and "+ Add for Child 2" at 766–810.

**Fix**
`html { scroll-padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px); }`, plus a matching `scroll-padding-top` for safety.

### Minor

**m1. At 200% text, menus overflow the page horizontally.**
- `styles.css:1825-1826`: `min-width: 12rem` is 384 px, which beats `max-width: calc(100vw - 32px)`.
- Opening "+ Add block" makes the page 400 px wide at both 390 and 320 (`innerWidth` grows to 400).
- Row menus go further off-screen (`left = -289`).
- **Fix:** use `min-width: min(12rem, calc(100vw - 2*var(--gutter)))` together with the B1 fix.

**m2. After "Plan the next N minutes" with an unsaved plan open, the Minutes control shows N but the plan keeps its old window.**
- `App.tsx:281-286`.
- Measured: the control shows 10 while the summary reads "1 hr 30 min planned of 1 hr 30 min" and the title "90 min".
- **Fix:** don't call `setWindowMinutes` in the dirty branch.

**m3. The same entry shows duplicate repair buttons.**
- The meal during a feed shows two conflicts, each offering "Move it after milk feed" and "Remove it".
- An along-overrun shows both "Shorten X by 2 min" and "Shorten it by 2 min".
- See `shots/routines-added.png`.
- **Fix:** de-duplicate repairs per entry, and merge messages when they share a cause.

**m4. The empty alongside list gives misleading advice.**
- `PlanEditor.tsx:714` says "…You could set your settling time on the nap…" even when the settling time is set and the track is simply full.
- **Fix:** choose the message by reason (adult state unknown vs. no room).

**m5. Shared plans get a generic title.**
- Without the sender's title, the recipient's plan is named "Shared plan" (`share.ts:353`, `ShareDialog.tsx:114`). Several saved shares all read "Shared plan", much like "Untitled plan".
- **Fix:** use `defaultPlanTitle(plan)`. It is derived only from data that is already shared, so it costs no privacy.

**m6. Duplicates are indistinguishable.**
- Duplicating repeatedly gives several identical "Copy of X" rows (`App.tsx` `onDuplicate`).
- See `shots/saved-full.png`.
- **Fix:** number them ("Copy 2 of X") or append the start time.

**m7. The pairing detail Safety list repeats itself.**
- `Details.tsx:307` adds the AAP sun line even when the pairing's own safety already covers sun. The activity version at `:150` checks `hazards`; this one doesn't.
- `Details.tsx:306` always adds "An older child is a playmate…" even when the content already says "The toddler is a playmate only…".
- Content `safety[3]` on `mix.tummy-time-book-helper`, `mix.tummy-time-picture-show` and `mix.tummy-time-and-pretend-kitchen` reads "This is floor tummy time on a firm, flat surface, the position flat-surface targets count. Follow any target your baby's clinician gave you." It isn't a safety instruction, its grammar is broken, and it puts the clinician-target note on a core screen. The brief keeps that note on About.

**m8. "Add to plan" disappears without explanation.**
- With two children and "Who's this for? Both", single-child activity pages show no Add button and say nothing (`App.tsx:448-456`).
- **Fix:** add a line such as "To add this, choose Child 1 or Child 2 on Find", or offer one button per child.

**m9. About contradicts the Plan screen.**
- About says the toggles are "never saved, shared, or added to a plan". The Plan screen then shows "Planned for: Child 1 just fed…", and the toggles did shape the plan.
- **Fix:** reword, for example "They shape the plan you make right then, but are never saved with it, shared, or restored."

**m10. Live regions are noisy.**
- `.plan-summary` is `aria-live` (`PlanEditor.tsx:801`) on top of the explicit `announce()`, so every edit is spoken twice.
- `.preview-box` is `aria-live` (`ShareDialog.tsx:111`), so each checkbox reads the whole preview.
- The age text is `aria-live` (`AgeControl.tsx:133`) on top of the slider's `aria-valuetext`.
- **Fix:** keep one announcer per action.

**m11. Routine blocks can't change child or type after they're added.**
- More only offers Change time, Duplicate and Remove.
- **Fix:** add "Change who/what" to More, or open the routine form pre-filled.

**m12. Share dialog layout at 320 px.**
- The "Plan name: '…'" checkbox sits alone on its line with the label wrapped below.
- Copy link is below a long preview.
- See `shots/share-320.png`.

**m13. Settings changes remove entries automatically.**
- `App.tsx:517-526` reconciles the open plan and removes entries with only a count toast, instead of keeping them with `analyzePlan`'s eligibility conflict (Swap / Remove).
- The current catalog has no two-adult content, so I could not trigger it. It is still the "silent-ish removal" path the brief rules out.

### Notes

- **n1. Bundle:** initial JS is 175.69 + 14.88 = **190.6 KB gzip**. That is under 200 KB, but `reports/performance.md` still says 183.7 KB, so the headroom is about 9 KB. ExportDialog, ShareDialog, SharedView and share load on demand. Evidence, the planner and PlannerView are prefetched at idle. I confirmed in the network log that nothing from export loads before "Save as image".
- **n2. Image pagination:** a 2-hour, two-child plan produces 7 feed images. Each entry block with roles and safety text is about 600 px tall, so page 1 holds one entry and about 300 px of empty space (`png/two-Feed-1.png` to `-7.png`). Text never shrinks, as intended. A compact option without role lines would help sharing.
- **n3. Contrast:** the sky active-tab indicator is 2.55:1 against white. It is the main visual cue for the current tab, besides a subtle text-colour shift. Forest text on sky-soft is 10.5:1, safety is 7.4:1 and danger is 6.4:1, all fine.
- **n4. 320×640 first load:** neither the CTA nor any activity is visible above the nav. The brief only requires this at 390.
- **n5. Saved state:** the Plan screen never shows whether the plan is saved. The toast says "Saved in this browser." while the list says "Saved on this device".
- **n6. Tummy-time copy:** on flat-surface items the tummy note reads "On a firm, flat floor surface. Floor tummy time.", which repeats itself.
- **n7. AgeControl keys (by inspection):** cards use `key={i}`. After removing Child 1, the remaining card can inherit Child 1's open "Type an age" or Readiness state.
- **n8. RecipeDetail readiness (by inspection):** `Details.tsx:220` assigns roles while ignoring readiness, but `App`'s `fits` (`App.tsx:465`) uses it. The Add button can therefore vanish with no banner.
- **n9. Planner output (out of scope):** the planner produces very short fills, such as "3 min + 2 setup/tidy" pairings and seven entries in a 50-min nap track. That is a UI-visible result of `planner.ts`, which is not in scope.

## Verified sound

**First load and layout**
- At 390×844 the first card's title, tag, summary, time and "Need" are visible above the nav, and all controls are at least 44 px. See `shots/first-390.png`.
- No horizontal scroll at 320, 390, 768 or 1280, and none at 200% text on Find, Plan, detail, Saved or About (with menus closed).
- No console errors in any flow.
- Inputs are 16 px or larger.
- Dialogs fit 320×640 and scroll internally.

**Age controls**
- The slider has weekly stops up to 12 weeks. The −/+ steppers, the typed-age path, and "+ Second child" and Remove all work.
- Child 1 and Child 2 labels are correct in both age orders (4 and 28 months, and reversed) across Find cards, pairing detail, editor rows and tracks, share preview, shared view and images, for two-child plans.

**Momentary context (Just fed / Nap soon)**
- The toggles are independent, per child, use `aria-pressed`, and have optional precision selects.
- The toggled control does not move.
- They appear nowhere in `localStorage`, the `sessionStorage` draft, the decoded share payload, or the downloaded plan JSON.
- Reset and reload both clear them. "Planned for:" disappears after reload or a change of start time.

**Plan from Find**
- 10, 20, 30 and 60 each produce that window. The summary checks out, e.g. "9:50 AM to 10:00 AM · 10 min planned of 10 min".
- Any → "Make a plan" opens the planner with 90 selected and generates nothing.

**Add block menu and routine forms**
- The menu follows the menu-button pattern: Enter or ArrowDown opens on the first item, ArrowUp on the last; arrows wrap; Home and End work; Escape returns to the button.
- The Nap, Milk feed, Meal and Snack forms preselect no length and say "your estimate".
- "Not sure yet" is the default settling choice, with a hint.
- A time before the plan starts is refused inline, and focus goes back to the time field.
- Meal and Snack are offered only for a child aged 6 months or older, with an explanation.

**Planner behaviour**
- Fill around keeps routines and custom entries. With unknown availability it leaves the other child's time unplanned and says how to plan it. Once a settling time is set, it plans the toddler alongside.
- Overlaps and overruns inside a track show local repairs, and the repairs work.
- Keep when filling and Stop keeping are announced, with focus kept on the More button.
- Up and down arrows keep focus, and give an explanation when both entries have set times.
- Extend to N min updates the window control and the default title.
- Changing the start shifts every entry and routine, and announces the new range.

**Saved list**
- Each plan is a linked title plus one More menu (Rename, Duplicate, Delete). Rename returns focus to More. Delete moves focus to the next title.
- At 10 plans, Duplicate shows `aria-disabled` with a reason, and the meter reads "Saved on this device · 10/10".
- I found no nested interactive controls.

**Sharing**
- By default the link carries no plan name, custom text, notes, readiness or momentary context. Decoded payload: `{"s","w","k","o","g"}` only.
- The preview matches the payload, and the opt-ins update it.
- In a fresh browser the link opens, previews, and "Save to my plans" adds a new plan.
- v1 compatibility is covered by the passing e2e test; I did not repeat it by hand.

**Image export**
- Uses the supplied 504 px logo raster.
- Defaults to the title "Our plan" and "Your own activity".
- No medical footer. "Estimated times", the URL and "n / N" page numbers are present.
- Safety lines are included.

**Caveats and shared analysis**
- Generic caveats ("not individually reviewed", "starting point", "medical advice") appear only in `AboutView.tsx`.
- About has the tummy-time position distinction and the clinician-target note.
- The editor, preview, share dialog, saved list and export all read `analyzePlan` and `planRows`. The exceptions are M6, the solid-food age check in `PlanEditor.tsx:104` and `:371` (it duplicates layout's `routine-age` rule but agrees with it), and the export's own `SERIOUS` hazard list.

## Resolution (lead, 2026-10-30)

All findings were addressed; checks after the fixes: 255 unit tests, 49/49 Playwright (Chromium), initial JS 177.7 + 14.9 KB gzip.

| Finding | Resolution | Test |
|---|---|---|
| B1 menus off-screen | Menus align to their button, clamp to the viewport, open upward near the nav; ↑ ↓ ⋯ never wrap apart. | `e2e/ui-review.spec.ts` (320/360/375, 200% text) |
| M1 one-child labels | One-child plans say "Your child" everywhere (rows, moment line, share preview, shared view, image header). | `e2e/ui-review.spec.ts` |
| M2 shared preview safety | Shared `entrySafety()` used by editor, shared preview, export. | `e2e/ui-review.spec.ts` |
| M3 focus to body | Stable focus targets for every listed action; dialogs close natively and return focus to the opener. | `e2e/ui-review.spec.ts` |
| M4 Undo out of reach | Inline "Deleted '…' · Undo" in place with focus; action toasts pause on hover/focus and last 15 s. | `e2e/ui-review.spec.ts` |
| M5 set time inside a nap | Rows ordered by time (tracks split with "(continued)"); overlap conflicts on both entries; repairs come from `repairsForEntry` (only repairs that leave fewer conflicts and create none); the analysis now also flags a main entry that double-books a child busy alongside another routine. | `tests/layout.test.ts`, `e2e/ui-review.spec.ts` |
| M6 Add to plan own rule | Alongside placement only where `optionsForSlot(…, { host })` offers it; honest toast. | `e2e/ui-review.spec.ts` |
| M7 detail timing list | Rules that apply now + one concise line + "Timing notes (n)"; meal rules hidden under 6 months. | `e2e/ui-review.spec.ts` |
| M8 starter prescribes a nap | Starter removed; a test keeps shipped starters free of routine blocks. | `tests/timing-planner.test.ts` |
| M9 focus under the nav | `scroll-padding-bottom` for nav, safe area, and sticky Add. | `e2e/ui-review.spec.ts` |
| m1–m13 | Fixed as listed in the workstream report (menus at 200% text, minutes control, duplicate repairs, empty-track reasons, default shared title, numbered copies, pairing safety list and content note, Both-mode Add explanation, About wording, single announcer, edit routine blocks, share dialog at 320, settings keep entries with eligibility conflicts — the analysis now also flags pairings that no longer fit). | unit + e2e |
| n3, n5–n8 | Active tab bar + bold label; saved-state line; tummy note wording; stable child keys; recipe readiness banner. | e2e |
| n1, n2, n4, n9 | Bundle re-measured; pagination keeps text legible (compact export option not added); 320×640 first load not required; planner fill granularity improved by the review-driven planner fixes. | |
