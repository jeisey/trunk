# Independent integration review

Date: 2026-10-29 · Commit reviewed: `4c0d9b0` (branch `claude/admiring-ptolemy-60r1t0`, PR #1) · Reviewer: independent integration pass (no code or content edited)

Content and safety research is out of scope. It was covered by [`content-review.md`](content-review.md). This review looks at the product as a whole: code paths, data flow, and whether the app behaves the way its UI and docs say it does.

## Scope and method

- **Read:** README, TASKS, decisions; `src/lib/*` (age, eligibility, supervision, filters, planner, plan, reconcile, storage, share, text, time, timeRules); `src/App.tsx`, `src/state.ts`, the planner, editor, share, shared, saved and detail components, `src/export/render.ts` (privacy paths), `src/styles.css` (nav and focus rules); `.github/workflows/ci.yml`, `playwright.config.ts`, `vite.config.ts`, `e2e/serve.mjs`.
- **Ran:**
  - `npx vitest run`: 106/106 pass, which matches the README.
  - A Node script against the generated catalog and the real `src/lib` modules:
    - **Planner sweep (6,912 runs):** 8 ages from 3 weeks to 50 months × 3 places × 4 energy levels × 24 start times (each at :30, so the sweep crosses midnight) × windows of 30, 90 and 180 minutes. For each run it checked wall-clock total ≤ window, no sun or night violations, no food added automatically, and every length within the activity's bounds.
    - **Starter plans:** window against wall-clock time, bounds, and time issues at 11:00 and 21:00.
    - **Two-adult records:** a scan for anything needing two adults.
    - **Swap:** the first pick across 30 seeds.
  - Playwright (Chromium, desktop and Pixel 7 emulation) against the production build served at `http://localhost:4174/trunk/`:
    - start time after the page has been open for hours (clock emulation)
    - two tabs saving plans
    - renaming the open plan from Saved
    - the dirty flag after opening a saved plan
    - share link payloads: decoded and compared with the dialog preview, with each opt-in combination and with a query string
    - opening and saving a shared link
    - damaged, older, newer, oversized and unknown-codec links
    - "Add to my plan" with two children
    - tapping Save while a text field has focus
    - a console-error sweep of all routes
  - No console errors or page errors appeared during any probe.

## Findings

Severity: **Blocker**: unsafe, or the release shouldn't ship. **Major**: wrong behaviour on a common path, a safety rule that can be bypassed, or data loss. **Minor**: edge cases, misleading copy, polish.

**Totals:** 0 Blocker · 4 Major · 13 Minor.

| # | Sev | Finding | Where | Repro | Suggested fix |
|---|---|---|---|---|---|
| M1 | Major | **Saving in one tab silently deletes plans saved in another tab.** `PlanStore` keeps the list it loaded at startup and writes that whole list on every save, delete or undo. It never re-reads storage and doesn't listen for `storage` events. This breaks the promise that a save "never overwrites an existing plan". The likely real-world path: a parent opens a shared link from a messaging app (a new tab), taps "Save to my plans", then later saves or deletes something in the original tab, and the shared plan is gone. | `src/lib/storage.ts:136-189` (`write`, `save`, `remove`, `restore`); `src/App.tsx:56,71-75` (loaded once) | Two tabs, same profile. In tab B, plan → name "From tab B" → Save. Storage now holds `['From tab B']`. In tab A, plan → name "From tab A" → Save. Storage now holds `['From tab A']`; B's plan is gone. (Reproduced.) | Re-read and merge (by `id`) from `localStorage` inside `save`/`remove`/`restore` before writing, and apply the 10-plan limit to the merged list. Also listen for `window` `storage` events on `STORE_KEY` to refresh `saved` (and the Saved view). Add a two-page Playwright test. |
| M2 | Major | **"Plan the next 90 minutes" and "Fill the next N minutes" plan from the time the page loaded, not from now.** `start` is set once with `nextStart()` when the app mounts. The planner's midday-sun rule for babies under 6 months, the night rule, and the editor's warnings all use that stale start. Mobile tabs stay alive for hours or days, so a plan made at 11:05 can be laid out as 8:00–9:30 and pass the sun check with no warning. | `src/App.tsx:63,130-144,146-155`; `src/components/PlannerView.tsx:192`; `src/components/FinderView.tsx:180-181` | Clock at 08:00, 4-month-old, Where = Outside. Load the app and fast-forward 3 h 05 min (now 11:05). Tap "Plan the next 90 minutes". Start = 08:00 and the first entry is "Shaded stroller or carrier walk 8:00–8:27" with no warning. Tapping "Now" shows 9 sun warnings. (Reproduced.) | Track whether the parent set the start time. If they didn't, refresh `start` with `nextStart()` whenever a plan is generated from the Finder, from "Fill the next…", or from "Make a new plan". Show a "Start: 8:00 AM (earlier than now)" hint when the start is in the past. Add a clock-emulated e2e test. |
| M3 | Major | **Save, Share link and other buttons ignore a tap while a text field has focus.** A CSS rule hides the fixed bottom nav whenever an input or textarea has focus. Tapping a button in the bottom ~64 px of the viewport blurs the field, the nav reappears under the pointer, and mousedown and mouseup land on different elements, so `click` never reaches the button. The natural flow is to type a plan name or notes and then tap Save. The tap does nothing and no toast appears; a parent who then closes the tab loses the plan. | `src/styles.css:237-240` | Make a plan, type in "Private notes", scroll so Save sits at the bottom of the viewport, tap Save. Nothing is stored and no toast appears. Reproduced with a desktop mouse click and with Pixel 7 touch emulation. The same thing happened in the earlier probe with "Share link" after adding a custom entry and notes: the dialog never opened. Keyboard Enter works. | Don't toggle the nav's layout or hit area on `:focus`. Either hide it only when the on-screen keyboard is actually open (`visualViewport` height shrinks), or delay re-showing it (for example `visibility` with a ~300 ms transition delay and `pointer-events:none` while hidden). Also pad the page bottom so actions never sit under the nav. Add an e2e test: focus the textarea, then click Save at the viewport bottom. |
| M4 | Major | **Planner controls don't affect the open plan, yet the UI tells the parent to use them.** "You right now", "Where", "How?" and "Adults here" (and "Who's this for?") update only the Finder preferences. The open plan's `settings` never change. "+ Activity", Swap and the time-of-day warnings all use `plan.settings`. When nothing fits, the "+ Activity" empty state says "Try changing energy or place above", which does nothing. The subtitle "For {ages}" also follows the new focus while the plan stays for the original child or children. | `src/App.tsx:317-320`; `src/components/PlanEditor.tsx:187,227,337,109,113`; `src/components/PlannerView.tsx:116-118,130-190` | Make a plan with Where = Anywhere, switch Where to Inside, tap Swap repeatedly: outdoor-capable ideas and outings still come up. Switch "Who's this for?" to Child 1: the subtitle says "For 9 months" while the plan still shows paired recipes for both children. (Confirmed in code.) | While a plan is open, either apply energy, place and mode to `draft.settings` (re-running reconcile, which keeps the age, adult and pairing checks) or move these controls under a "For a new plan" heading. Disable "Who's this for?" while a plan is open, or keep the subtitle tied to `plan.kids`. Reword the empty state to match. |
| m1 | Minor | Renaming the open plan from Saved throws away its unsaved edits without a prompt. `onRename` builds `updated` from the stored copy and replaces the draft with it. Deleting the open plan leaves a draft that reads as "clean", so Close plan and Make a new plan discard it without asking. | `src/App.tsx:210-225,233-239` | Open a saved plan, remove an entry (10 → 9), go to Saved, rename it, go back to Plan: 10 entries, and the edit is lost. (Reproduced.) | When the renamed plan is the open draft, apply the new title to the draft (`{...draft, title}`) and save that, or ask first. When the deleted plan is the open draft, clear `savedSnapshot` so the draft counts as unsaved. |
| m2 | Minor | The recipe detail shows "Add to my plan" when "Who's this for?" is set to one child. The tap creates a one-child base (asking first if the open plan is unsaved), reconcile drops the recipe, and the toast says it "doesn't fit this plan's ages" even though it fits both children. | `src/App.tsx:291-295` vs `125-128,183-203` | Two children (9 months and 4 years), focus Child 1, open `#/r/mix.treasure-basket-and-sock-match`, tap Add. Toast: "…doesn't fit this plan's ages." (Reproduced.) | Show onAdd for recipes only when `focus === 'both'`. Otherwise show "Switch to Both to add this pairing". |
| m3 | Minor | The activity detail checks age against Child 1 only when two children are set to "Both". This shows a false "not meant for…" banner on the older child's activities. The visibility check for "Add to my plan" ignores `notYet`. Adding then fails with the "ages" message although readiness is the actual reason. When an open plan has the same ages, its older `notYet` is used instead of the current one. | `src/App.tsx:252,275,282,190`; `src/components/Details.tsx:66-75` | 9 months + 4 years, focus Both, open `#/a/act.sock-match-and-sort`: "This one is meant for 3 years to under 5 years, not 9 months." (Reproduced.) | With two children and focus Both, show the banner only if neither child fits. Pass the focused child's `notYet` into the visibility check. Compare `notYet` as well as ages before reusing the draft as the base. |
| m4 | Minor | Swap ignores the planner's own rules. It can automatically pick a snack (decision 27: food is never added automatically), a second outing, or an outdoor idea inside the sun or night window (the warning does then appear). | `src/components/PlanEditor.tsx:183-198`; `src/lib/planner.ts:233-239` | Across 30 Swap seeds, the first pick included `act.sit-down-snack-together` for 18, 30 and 48 months, plus several outings. (Node probe.) | In `alternativesFor` for Swap, exclude `food`, skip outings and media already in the plan, and rank picks without a `timeIssue` at the slot's start first. "+ Activity" can keep offering snacks, because the parent chooses them there. |
| m5 | Minor | Starter plans and opened plans don't update "How long". `useStarter` sets the draft's window (e.g. 105) but not `windowMinutes`, so the control still shows "90 min" while the summary says "of 1 hr 45 min". Windows outside 30/60/90/120/180 leave no option selected. The starter list ignores Where: the park starter appears with "Inside" selected. The starter window is `sum(minutes)+30` and ignores setup and cleanup. All six starters fit today, but nothing guarantees it. | `src/components/PlannerView.tsx:43-51,105-111,129` | Choose "Inside", 30-month-old, no plan open: "Park, snack, playdough" is offered. Use it and the "How long" control doesn't match the plan's window. | Call `onWindow(window)` from `useStarter`. Compute the window from `totalWallMinutes`. Add a "Custom" option or label when the window isn't in the list. Filter starters by `place`. |
| m6 | Minor | Share links copy the current page's query string. `shareUrl` strips only the hash, so `?fbclid=…` or `?utm_…` from the link that brought the parent in is passed on to every recipient. | `src/components/ShareDialog.tsx:35`; `src/lib/share.ts:171-173` | Open `/trunk/?utm_source=x#/`, make a plan, Share: the link is `…/trunk/?utm_source=x#/s/1z.…`. (Reproduced.) | Build the link from `location.origin + location.pathname`, or `VITE_SITE_URL` when it's set. |
| m7 | Minor | The share preview is close to the payload but not complete, and the README says more than the payload delivers. The link also carries energy, place, mode, adults and each custom entry's "for" child, none of which the preview lists. The README says links "default to … approximate ages", but the payload holds the exact entered value (e.g. `[3,"w"]`); only the UI adds "about". Title, notes and custom text are correctly left out by default. (Decoded payloads checked with each opt-in combination.) | `src/components/ShareDialog.tsx:98-121`; `src/lib/share.ts:66-89`; README "Save and share" | Decode any default link: `{"s":"09:30","w":90,"k":[[6,"m"]],"o":[2,0,0,1],"g":[…]}`. | Add a line such as "Settings: some energy · anywhere · one adult" to the preview. Either change the README to "the ages you entered (weeks under 3 months, otherwise months)" or round ages when encoding. |
| m8 | Minor | "Two adults" has no effect. No activity or recipe has `minAdults > 1` (scan of the generated catalog), so with the current content eligibility is the same for one or two adults. The control appears in the Finder and Planner, and the share preview says "planned for two adults". | `src/components/FinderView.tsx:166-171`; `src/components/PlannerView.tsx:180-188`; `src/components/SharedView.tsx:183` | Scan: `minAdults2 acts [] / recipes []`. | Hide the control until content needs it, or explain that it only changes the wording of the two-child empty state. |
| m9 | Minor | A one-child plan made for Child 2 calls the child "Child 1" in the timeline, break and custom tracks, and in exported images. | `src/components/PlanEditor.tsx:46,86,92`; `src/export/render.ts:121` | Two children, focus Child 2, make a plan: every track says "Child 1". | Use "Your child" in one-child plans, or store which child the plan is for. |
| m10 | Minor | Unsaved drafts live only in memory. A reload, a browser discarding the tab, or tab close loses them without warning. The in-app prompts don't cover these cases. | `src/App.tsx:59-60` | Make a plan and reload: it's gone. | Keep the draft in `sessionStorage` (wrapped in try/catch) and/or add a `beforeunload` prompt when `dirty`. |
| m11 | Minor | Any later toast replaces the Undo toast, so deleting two plans in a row loses the first Undo. Undo also lasts only 8 s. | `src/App.tsx:107,215-224` | Delete plan A, then plan B: only B can be undone. | Queue toasts, or keep the Undo toast until a newer undo replaces it. |
| m12 | Minor | CI and deploy: workflow-level `cancel-in-progress: true` can cancel a Pages deployment that's already running when two pushes reach `main` close together. GitHub's Pages starter uses a `pages` group with `cancel-in-progress: false`. The deploy job also rebuilds from source rather than shipping the `dist/` that the browser journeys tested. Low risk, because only `VITE_SITE_URL` differs. Action versions, permissions and step order are otherwise correct: the catalog is generated in `typecheck` before vitest and `vite build`, e2e runs after the build with Chromium installed, and the deploy job has `pages: write` and `id-token: write`. | `.github/workflows/ci.yml:13-16,63-75` | Push to `main` twice within a minute. | Give the deploy job its own `concurrency: { group: pages, cancel-in-progress: false }`. Optionally build once with `VITE_SITE_URL` from `configure-pages` in the test job and upload that artifact. |
| m13 | Minor | Storage edge cases. A store with more than 10 valid plans (possible after M1-style races or manual edits) is reported as "couldn't be read" and the extra plans are dropped on the next write. The backup is written only if none exists yet, so a second corruption isn't backed up. | `src/lib/storage.ts:115,126` | — | Keep the extra plans in read-only form with a clear message. Version the backup key or append to it. |

## What looked solid

- **No path pairs two children outside a curated recipe.** Every way a segment gets into a plan uses either a recipe-only pool or `reconcileSegments`, which drops single-child activities from two-child plans and re-checks age, readiness, adults and retirement:
  - the planner
  - Swap
  - "+ Activity"
  - starter plans
  - "Add to my plan"
  - share-link import and plan-file import
  - reopening a saved plan

  The m2 probe confirmed that a recipe can't be added to a one-child plan. Custom entries are the parent's own words and are labelled that way.
- **Planner arithmetic and time rules.** All 6,912 sweep runs passed:
  - The wall-clock total never exceeded the window; setup and cleanup count once and parallel tracks count once.
  - No outdoor segment for a baby under 6 months overlapped 10:00–16:00.
  - No outdoor-only segment fell between 20:00 and 06:00, including plans that cross midnight.
  - No food was added automatically, and every length stayed within the activity's bounds.

  All six starter plans fit inside their windows and bounds. The editor warns when a plan runs past the window, and resize clamps to the bounds.
- **Share codec.** By default the payload has no title, notes or custom text, and turning them on works as labelled. The link keeps the `/trunk/` base path. Newer, older, damaged, oversized and unknown-codec links each get a specific message, with no crash and no console error. Imports get a fresh id, and "Save to my plans" adds a plan rather than replacing one. Plan-file import goes through the same checks.
- **Dirty tracking.** Opening a saved plan unchanged doesn't count as unsaved. Replace, close and open all prompt correctly in the normal flows.
- **Build and deploy.** `base: './'` plus hash routing works under `/trunk/`. Exported images use `VITE_SITE_URL` from `configure-pages`. The 106 unit tests pass, and CI ordering is correct.

## Residual risks

- M3 was reproduced with a desktop mouse and with Chromium touch emulation. How it behaves with a real on-screen keyboard on iOS and Android hasn't been tested, and the same applies to Safari and WebKit generally (including `CompressionStream` on older Safari: a `z` link opened there shows a "can't open" message).
- Multi-tab behaviour (M1) also affects preferences (`trunk.prefs`), but that only means losing filter state.
- The sweep covered single-child plans. Two-child planner runs were checked by code review (recipes only, same timing code) rather than a full sweep.
- Real share sheets, clipboard permission prompts and image downloads weren't exercised, matching the README's caveats.
- Content correctness (supervision metadata, hazards, sources) relies on the separate content review. This review assumed the catalog data is correct.

## Resolution (lead, 2026-10-29)

All four Majors were fixed with regression tests in `e2e/integration.spec.ts` (two tabs, clock-emulated start time, tap-while-typing, planner settings). After the changes: 107 unit tests and 19 browser tests pass.

| ID | Resolution |
|---|---|
| M1 | `PlanStore` re-reads and merges stored plans before every save, delete, and restore (the 10-plan limit applies to the merged list); the app listens for `storage` events to refresh the Saved list. Unit and two-tab e2e tests. |
| M2 | Generating a plan starts from now unless the parent set the start time themselves; "Plan the next 90 minutes" always starts now. Clock-emulated e2e test (page loaded 08:00, plan made 11:05 → starts 11:05, no midday outdoor time for a 4-month-old). |
| M3 | The focus-based nav hiding was removed; the nav is hidden only while an on-screen keyboard is open (`visualViewport`), so it never moves under a tap. E2E test taps Save and Share link while the notes field has focus. |
| M4 | Energy, place, mode, and adults now update the open plan's settings (entries are re-checked; anything that no longer fits is removed with a notice), so "+ Activity", Swap, and time warnings follow them. The subtitle follows the plan's own children; a note says "Who's this for?" applies to the next plan. |
| m1 | Renaming the open plan from Saved keeps its unsaved edits; deleting it marks it unsaved (undo restores the saved state). |
| m2 | Pairing pages offer "Add to my plan" only when "Both" is selected. |
| m3 | With two children on "Both", single-child pages don't assume Child 1's age (no false banner, no add button); the add check uses the child's readiness. |
| m4 | Swap and "+ Activity" never offer food, and Swap won't add a second outing. Time-window issues are flagged on the segment. |
| m5 | Starter plans set "How long"; "Inside" hides starter plans with outdoor-only entries. |
| m6 | Share links use origin + path only (no query string). |
| m7 | The share preview lists energy, place, and adults, and says ages are the whole weeks/months entered; README wording corrected. |
| m8 | Not changed: "Two adults" currently only unlocks content that needs two adults (none yet). Listed as a limitation. |
| m9 | Not changed: a single-child plan labels its child "Child 1" (generic labels by design). |
| m10 | The open plan is kept in this tab's `sessionStorage` and restored after a reload or tab discard. |
| m11 | Not changed: a later toast replaces an Undo toast. Listed as a limitation. |
| m12 | Workflow concurrency cancels superseded PR runs only; pushes to `main` queue, so a Pages deploy is never cut off. The deploy job still rebuilds the same commit (to embed the Pages URL); the PR run tests that commit. |
| m13 | Not changed (edge cases after the M1 merge make >10 stored plans unlikely). |
