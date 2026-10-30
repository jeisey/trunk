import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { catalog as c, contentVersion, loadEvidence } from './content/catalog.ts';
import { assetUrl, BRAND_ASSETS } from './brand.ts';
import { toDays } from './lib/age.ts';
import { readDraft, writeDraft } from './lib/draft.ts';
import { recipeAssignment } from './lib/eligibility.ts';
import { activityEligible, type Filters } from './lib/filters.ts';
import { analyzePlan, childLabel } from './lib/layout.ts';
import type { PlannerResult } from './lib/planner.ts';
import { newId, newPlanId, youngerFor, type Plan, type PlanSegment } from './lib/plan.ts';
import { addEntry, makePlan } from './lib/planEdit.ts';
import { defaultPlanTitle } from './lib/planTitle.ts';
import { reconcileSegments } from './lib/reconcile.ts';
import { PlanStore, STORE_KEY, type StoreStatus } from './lib/storage.ts';
import { cleanText, LIMITS } from './lib/text.ts';
import { formatClock, nextStart, parseHHMM } from './lib/time.ts';
import { hasMoment, momentTiming, NO_MOMENT, type ChildTiming, type MomentContext } from './lib/timing.ts';
import { loadPrefs, savePrefs, type Prefs } from './state.ts';
import { AboutView } from './components/AboutView.tsx';
import { ActivityDetail, RecipeDetail } from './components/Details.tsx';
import { FinderView } from './components/FinderView.tsx';
import { kidsToPlanKids, settingsFromFilters } from './components/planKids.ts';
import { momentText, planTitle } from './components/planDisplay.ts';
import { SavedView } from './components/SavedView.tsx';
import { Toast, type ToastState } from './components/Toast.tsx';

const ExportDialog = lazy(() => import('./export/ExportDialog.tsx'));
// The planning engine, editor, and share code load on demand (prefetched when the browser is idle),
// so the first Find screen stays small.
const loadPlanner = () => import('./lib/planner.ts');
const loadShare = () => import('./lib/share.ts');
const PlannerView = lazy(() => import('./components/PlannerView.tsx').then((m) => ({ default: m.PlannerView })));
const SharedView = lazy(() => import('./components/SharedView.tsx').then((m) => ({ default: m.SharedView })));
const ShareDialog = lazy(() => import('./components/ShareDialog.tsx').then((m) => ({ default: m.ShareDialog })));

/** The plan that was open in this tab before a reload, if it is still valid (v1 drafts are migrated). */
const restoredDraft = readDraft();

type Route =
  | { name: 'find' }
  | { name: 'plan' }
  | { name: 'saved' }
  | { name: 'about' }
  | { name: 'activity'; id: string }
  | { name: 'recipe'; id: string }
  | { name: 'shared'; payload: string };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h.startsWith('/s/')) return { name: 'shared', payload: h.slice(3) };
  if (h.startsWith('/a/')) return { name: 'activity', id: decodeURIComponent(h.slice(3)) };
  if (h.startsWith('/r/')) return { name: 'recipe', id: decodeURIComponent(h.slice(3)) };
  if (h === '/plan') return { name: 'plan' };
  if (h === '/saved') return { name: 'saved' };
  if (h === '/about') return { name: 'about' };
  return { name: 'find' };
}

const NAV = [
  { href: '#/', label: 'Find', route: 'find', icon: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z' },
  { href: '#/plan', label: 'Plan', route: 'plan', icon: 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 7h14v10H5V9zm2 2v2h4v-2H7zm0 4v2h7v-2H7z' },
  { href: '#/saved', label: 'Saved', route: 'saved', icon: 'M6 2a2 2 0 0 0-2 2v18l8-4 8 4V4a2 2 0 0 0-2-2H6zm0 2h12v14.8l-6-3-6 3V4z' },
] as const;

/** Momentary context a plan was made with: kept in React state only, for the plan it was made for. */
interface PlanMoment {
  planId: string;
  moments: MomentContext[];
  labels: string[];
}

const LOGO_SRCSET = `${assetUrl(BRAND_ASSETS.logo168)} 1x, ${assetUrl(BRAND_ASSETS.logo336)} 2x, ${assetUrl(BRAND_ASSETS.logo504)} 3x`;

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [seed, setSeed] = useState(0);
  const store = useMemo(() => new PlanStore(), []);
  const [saved, setSaved] = useState<Plan[]>([]);
  const [storeStatus, setStoreStatus] = useState<{ status: StoreStatus; message?: string }>({ status: 'ok' });
  const [draft, setDraft] = useState<Plan | null>(() => restoredDraft?.plan ?? null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => restoredDraft?.snapshot ?? null);
  /** A freshly generated plan nobody has touched yet can be replaced without asking. */
  const [pristine, setPristine] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PlannerResult | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(() => restoredDraft?.plan.window ?? 90);
  const [start, setStart] = useState(() => restoredDraft?.plan.start ?? nextStart());
  /** "Just fed" / "Nap soon" on Find: memory only, never stored, shared, or restored. */
  const [moments, setMoments] = useState<MomentContext[]>([]);
  const [planMoment, setPlanMoment] = useState<PlanMoment | null>(null);
  /** True once the parent sets a start time themselves; otherwise new plans start now. */
  const startTouched = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** The control that opened a dialog: focus goes back to it when the dialog closes (Close or Escape). */
  const opener = useRef<HTMLElement | null>(null);
  const rememberOpener = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const returnFocus = () =>
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if ((!a || a === document.body) && opener.current?.isConnected) opener.current.focus();
    });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const findScroll = useRef(0);
  const navigatedInApp = useRef(false);

  useEffect(() => {
    const r = store.load();
    setSaved(r.plans);
    setStoreStatus({ status: r.status, message: r.message });
  }, [store]);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Keep the open plan through a reload or a discarded tab (this tab only).
  useEffect(() => {
    writeDraft(draft, savedSnapshot);
  }, [draft, savedSnapshot]);

  // Saved plans changed in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY || e.key === null) {
        setSaved([...store.refresh()]);
        // An older Trunk in another tab may have rewritten the store; the store merges and says so.
        setStoreStatus({ status: store.getStatus(), message: store.getMessage() });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store]);

  // Hide the bottom nav only while an on-screen keyboard is open, so it never
  // covers the keyboard and never jumps under a tap on Save or Share.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => document.body.classList.toggle('keyboard-open', vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', update);
    update();
    return () => vv.removeEventListener('resize', update);
  }, []);

  // Prefetch claims and sources once the first screen is up.
  useEffect(() => {
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500));
    idle(() => {
      void loadEvidence();
      void loadPlanner();
      void import('./components/PlannerView.tsx');
    });
  }, []);

  useEffect(() => {
    const onHash = () => {
      navigatedInApp.current = true;
      setRoute((prev) => {
        if (prev.name === 'find') findScroll.current = window.scrollY;
        return parseRoute(window.location.hash);
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useLayoutEffect(() => {
    if (route.name === 'find') window.scrollTo(0, findScroll.current);
    else window.scrollTo(0, 0);
    if (!navigatedInApp.current) return;
    // Move focus to the new page's heading; a page that loads on demand gets it when it arrives.
    let tries = 0;
    let frame = 0;
    const focusHeading = () => {
      const h1 = document.querySelector('main h1');
      if (h1 instanceof HTMLElement) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      } else if (tries++ < 60) frame = requestAnimationFrame(focusHeading);
    };
    focusHeading();
    return () => cancelAnimationFrame(frame);
  }, [route]);

  const notify = useCallback((text: string, action?: ToastState['action']) => setToast({ id: Date.now(), text, action }), []);
  const announce = useCallback((text: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);
  const go = (hash: string) => {
    window.location.hash = hash;
  };
  const back = () => {
    if (navigatedInApp.current && window.history.length > 1) window.history.back();
    else go('#/');
  };

  const setKids = (kids: Prefs['kids']) => setPrefs((p) => ({ ...p, kids }));
  const setFilters = (filters: Filters) => setPrefs((p) => ({ ...p, filters }));
  const draftJson = draft ? JSON.stringify(draft) : null;
  const dirty = draft !== null && draftJson !== savedSnapshot && draftJson !== pristine;

  /** Which of the parent's children a new plan is for (both, or the one chosen). */
  const planChildIndexes = (): number[] => (prefs.kids.length === 2 && prefs.filters.focus !== 'both' ? [prefs.filters.focus] : prefs.kids.map((_, i) => i));
  const planChildren = () => {
    const kids = kidsToPlanKids(prefs.kids);
    return planChildIndexes().map((i) => kids[i]);
  };

  /** Momentary context aligned to a plan's children; null when there is none. */
  const momentsFor = (indexes: number[], from: MomentContext[]): PlanMoment['moments'] | null => {
    const list = indexes.map((i) => from[i] ?? NO_MOMENT);
    return list.some((m) => hasMoment(m)) ? list : null;
  };

  // Extra timing context for the open plan (axis 0 = the plan's start = when it was made).
  const extra: ChildTiming[] | undefined = useMemo(() => {
    if (!draft || !planMoment || planMoment.planId !== draft.id) return undefined;
    return draft.kids.map((k, i) => momentTiming(toDays(k.age), planMoment.moments[i]));
  }, [draft, planMoment]);
  const momentLine = draft && planMoment && planMoment.planId === draft.id ? momentText(planMoment.moments, planMoment.labels) : null;

  const adopt = (plan: Plan, opts: { snapshot?: string | null; pristine?: boolean } = {}) => {
    setDraft(plan);
    setSavedSnapshot(opts.snapshot ?? null);
    setPristine(opts.pristine ? JSON.stringify(plan) : null);
  };

  const generate = async (minutes = windowMinutes, fromNow = false, withMoments: MomentContext[] | null = null) => {
    const { planWindow } = await loadPlanner();
    const indexes = planChildIndexes();
    const planKids = planChildren();
    const settings = settingsFromFilters(prefs.filters);
    const s = seed + 1;
    setSeed(s);
    // "The next N minutes" means from now, unless the parent chose a start time.
    const begin = fromNow || !startTouched.current ? nextStart() : start;
    if (begin !== start) setStart(begin);
    if (fromNow) startTouched.current = false;
    const moment = withMoments ? momentsFor(indexes, withMoments) : null;
    const result = planWindow(c, { kids: planKids, settings, window: minutes, seed: s, start: begin, moment: moment ?? undefined });
    setLastResult(result);
    if (result.blocked) {
      announce(result.blocked.reason);
      return;
    }
    const plan = makePlan(planKids, settings, begin, minutes, result.segments);
    const titled = { ...plan, title: defaultPlanTitle(plan) };
    adopt(titled, { pristine: true });
    setPlanMoment(moment ? { planId: titled.id, moments: moment, labels: indexes.map((i) => childLabel(i === 1 ? 1 : 0)) } : null);
    announce(`Made a ${minutes}-minute plan with ${result.segments.length} entries.`);
  };

  const startBlank = () => {
    const planKids = planChildren();
    const begin = startTouched.current ? start : nextStart();
    if (begin !== start) setStart(begin);
    const plan = makePlan(planKids, settingsFromFilters(prefs.filters), begin, windowMinutes, []);
    adopt({ ...plan, title: defaultPlanTitle(plan) }, { pristine: true });
    setPlanMoment(null);
    setLastResult(null);
    announce('Started a blank plan. Add a block to begin.');
  };

  const fillPlan = async () => {
    if (!draft) return generate();
    const { fillAround } = await loadPlanner();
    const s = seed + 1;
    setSeed(s);
    const moment = planMoment && planMoment.planId === draft.id ? planMoment.moments : undefined;
    const { plan, result } = fillAround(c, draft, { seed: s, moment });
    setLastResult(result);
    if (result.blocked) {
      announce(result.blocked.reason);
      return;
    }
    setDraft(plan);
    const added = plan.segments.length - draft.segments.filter((x) => plan.segments.some((y) => y.id === x.id)).length;
    announce(`Filled around your blocks: ${Math.max(0, added)} ${added === 1 ? 'entry' : 'entries'} added.`);
  };

  const planFromFinder = (minutes: number | null) => {
    if (minutes === null) {
      // "Any": open the planner with its duration showing; nothing is generated until asked.
      if (!draft) setWindowMinutes(90);
      go('#/plan');
      return;
    }
    if (draft && dirty) {
      // The open plan keeps its own length; the Minutes control keeps showing it.
      go('#/plan');
      notify('You have an unsaved plan open. Save or close it to make a new one.');
      return;
    }
    setWindowMinutes(minutes);
    void generate(minutes, true, moments).then(() => go('#/plan'));
  };

  const savePlan = (plan: Plan) => {
    const r = store.save({ ...plan, title: cleanText(plan.title, LIMITS.title), notes: cleanText(plan.notes, LIMITS.notes, { multiline: true }) });
    if (r.ok) {
      setSaved(r.plans);
      setStoreStatus({ status: store.getStatus(), message: store.getMessage() });
      if (draft && plan.id === draft.id) setSavedSnapshot(JSON.stringify(plan));
      notify(r.action === 'created' ? 'Saved on this device.' : 'Changes saved on this device.');
      return true;
    }
    notify(r.message);
    return false;
  };

  const openPlan = (plan: Plan, fromStore: boolean) => {
    if (dirty && draft && draft.id !== plan.id && !window.confirm('Replace the plan you’re editing? It isn’t saved.')) return;
    const { segments, dropped, changed } = reconcileSegments(plan.kids, plan.settings, plan.segments, c);
    const next = { ...plan, segments };
    // A plan that comes back unchanged stays "saved"; anything the checks changed shows as unsaved.
    const unchanged = JSON.stringify(next) === JSON.stringify(plan);
    adopt(next, { snapshot: fromStore && unchanged ? JSON.stringify(next) : fromStore ? JSON.stringify(plan) : null });
    setPlanMoment(null);
    setLastResult(null);
    setWindowMinutes(plan.window);
    setStart(plan.start);
    startTouched.current = true;
    go('#/plan');
    const notes = [
      dropped.length ? `${dropped.length} item(s) no longer fit and were left out.` : '',
      changed.length ? `${changed.length} item(s) were moved back into the main plan.` : '',
    ].filter(Boolean);
    if (notes.length) notify(notes.join(' '));
  };

  const addToPlan = async (kind: 'activity' | 'recipe', ref: string) => {
    const planKids = planChildren();
    const item = kind === 'activity' ? c.activityById.get(ref) : c.recipeById.get(ref);
    if (!item) return;
    // A one-child idea joins an open two-child plan for the matching child. It goes alongside
    // the other child's routine only where the planner's own check offers it there
    // (optionsForSlot); otherwise it joins the main sequence, and the plan shows any conflict.
    const focus = prefs.filters.focus;
    const allKids = kidsToPlanKids(prefs.kids);
    const sameAges = (a: Plan['kids'], b: Plan['kids']) => JSON.stringify(a.map((k) => k.age)) === JSON.stringify(b.map((k) => k.age));
    if (kind === 'activity' && draft && draft.kids.length === 2 && prefs.kids.length === 2 && focus !== 'both' && sameAges(draft.kids, allKids)) {
      const { optionsForSlot } = await loadPlanner();
      const who = focus === 0 ? 'c1' : 'c2';
      const other = who === 'c1' ? 'c2' : 'c1';
      let host: number | undefined;
      let minutes = item.duration.default;
      for (const e of analyzePlan(draft, c).entries) {
        const h = e.item.segment;
        if (e.item.host !== null || h.kind !== 'routine' || h.who !== other) continue;
        const fit = optionsForSlot(c, draft, { host: e.item.index }).find((o) => o.id === ref);
        if (fit) {
          host = e.item.index;
          minutes = fit.minutes;
          break;
        }
      }
      const seg: PlanSegment = { id: newId('a'), kind: 'activity', ref, minutes, who };
      const next = addEntry(draft, seg, host === undefined ? {} : { host });
      setDraft(next);
      setLastResult(null);
      go('#/plan');
      const added = analyzePlan(next, c).entries.find((e) => e.item.segment.id === seg.id);
      const hostName = host !== undefined ? draft.segments[host].routine : undefined;
      notify(
        added?.conflicts.some((cf) => cf.severity === 'conflict')
          ? `Added ${item.title} for ${childLabel(who)}. It needs a look: see the note on it in the plan.`
          : `Added ${item.title} for ${childLabel(who)}${hostName ? ` alongside ${childLabel(other)}’s ${hostName === 'milk-feed' ? 'milk feed' : hostName}` : ''}.`,
      );
      return;
    }
    let base = draft;
    if (!base || base.kids.length !== planKids.length || !sameAges(base.kids, planKids)) {
      if (base && dirty && !window.confirm('Start a new plan for these ages? Your current plan isn’t saved.')) return;
      const fresh = makePlan(planKids, settingsFromFilters(prefs.filters), startTouched.current ? start : nextStart(), windowMinutes, []);
      base = { ...fresh, title: defaultPlanTitle(fresh) };
      setSavedSnapshot(null);
      setPristine(null);
      setPlanMoment(null);
    }
    const seg: PlanSegment = { id: newId(kind === 'recipe' ? 'r' : 'a'), kind, ref, minutes: item.duration.default };
    if (kind === 'recipe') seg.younger = youngerFor(ref, base, c);
    const { segments, dropped } = reconcileSegments(base.kids, base.settings, [...base.segments, seg], c);
    if (dropped.length) {
      notify(`${item.title} doesn’t fit this plan’s ages.`);
      return;
    }
    setDraft({ ...base, segments, updatedAt: new Date().toISOString() });
    setLastResult(null);
    go('#/plan');
    notify(`Added ${item.title}.`);
  };

  /** Delete a saved plan. Returns an undo for the inline "Deleted … · Undo" row, or null. */
  const onDelete = (plan: Plan): (() => boolean) | null => {
    const r = store.remove(plan.id);
    if (!r.ok) {
      notify(r.message);
      return null;
    }
    setSaved(r.plans);
    const { removed, index } = r;
    if (draft?.id === plan.id) setSavedSnapshot(null);
    if (!removed) return null;
    return () => {
      const back = store.restore(removed, index ?? 0);
      if (!back.ok) {
        notify(back.message);
        return false;
      }
      setSaved(back.plans);
      if (draft?.id === removed.id) setSavedSnapshot(JSON.stringify(removed));
      return true;
    };
  };

  const onDuplicate = (plan: Plan) => {
    const stamp = new Date().toISOString();
    // "Copy of X", then "Copy 2 of X", "Copy 3 of X", so copies can be told apart.
    const base = planTitle(plan).replace(/^Copy(?: \d+)? of /, '');
    const taken = new Set(saved.map((p) => planTitle(p)));
    let title = `Copy of ${base}`;
    for (let n = 2; taken.has(title.slice(0, LIMITS.title)) && n < 100; n++) title = `Copy ${n} of ${base}`;
    const copy = { ...plan, id: newPlanId(), title: title.slice(0, LIMITS.title), createdAt: stamp, updatedAt: stamp };
    savePlan(copy);
  };

  const onRename = (plan: Plan, title: string) => {
    const updated = { ...plan, title: cleanText(title, LIMITS.title), updatedAt: new Date().toISOString() };
    if (savePlan(updated) && draft?.id === plan.id) {
      // Keep any unsaved edits in the open plan; only the name changes.
      setDraft((d) => (d ? { ...d, title: updated.title, updatedAt: updated.updatedAt } : d));
      setSavedSnapshot(JSON.stringify(updated));
    }
  };

  const onImportFile = async (text: string) => {
    const { importPlanFile, ShareError } = await loadShare();
    try {
      const result = importPlanFile(text, c);
      openPlan(result.plan, false);
      if (result.dropped.length) notify(`${result.dropped.length} item(s) didn’t pass today’s checks and were left out.`);
    } catch (e) {
      notify(e instanceof ShareError ? e.message : 'That file couldn’t be opened.');
    }
  };

  /** Keep a generated default title in step with the plan it describes; a parent's own title is never touched. */
  const retitle = (before: Plan, after: Plan): Plan => (before.title === defaultPlanTitle(before) ? { ...after, title: defaultPlanTitle(after) } : after);

  const kidsAges = prefs.kids.map((k) => k.age);
  // With two children on "Both", single-child pages don't assume either child's age.
  const detailIndex = prefs.kids.length === 2 ? (prefs.filters.focus === 'both' ? null : prefs.filters.focus) : 0;
  const detailChild = detailIndex === null ? null : prefs.kids[detailIndex];
  const nowFor = (i: number): ChildTiming | undefined => (hasMoment(moments[i]) ? momentTiming(toDays(prefs.kids[i].age), moments[i]) : undefined);

  let view: React.ReactNode;
  switch (route.name) {
    case 'find':
      view = (
        <FinderView
          catalog={c}
          kids={prefs.kids}
          filters={prefs.filters}
          seed={seed}
          moments={moments}
          onKids={setKids}
          onFilters={setFilters}
          onMoments={setMoments}
          onShuffle={() => {
            setSeed((s) => s + 1);
            announce('Shuffled.');
          }}
          onPlan={planFromFinder}
        />
      );
      break;
    case 'activity': {
      const a = c.activityById.get(route.id);
      const childInput = detailChild ? { days: toDays(detailChild.age), notYet: detailChild.notYet } : null;
      view = a ? (
        <ActivityDetail
          c={c}
          a={a}
          childAge={detailChild?.age}
          now={detailIndex === null ? undefined : nowFor(detailIndex)}
          onBack={back}
          onAdd={childInput && !a.retired && activityEligible(a, childInput, prefs.filters.adults) ? () => void addToPlan('activity', a.id) : undefined}
          addHint={prefs.kids.length === 2 && prefs.filters.focus === 'both' ? 'To add this to a plan, choose Child 1 or Child 2 under “Who’s this for?” on Find.' : undefined}
        />
      ) : (
        <NotFound />
      );
      break;
    }
    case 'recipe': {
      const r = c.recipeById.get(route.id);
      const fits =
        r && prefs.kids.length === 2
          ? recipeAssignment(r, { days: toDays(kidsAges[0]), notYet: prefs.kids[0].notYet }, { days: toDays(kidsAges[1]), notYet: prefs.kids[1].notYet }) !== null
          : false;
      view = r ? (
        <RecipeDetail
          c={c}
          r={r}
          kids={prefs.kids}
          now={prefs.kids.map((_, i) => nowFor(i))}
          onBack={back}
          onAdd={fits && !r.retired && prefs.filters.focus === 'both' ? () => void addToPlan('recipe', r.id) : undefined}
        />
      ) : (
        <NotFound />
      );
      break;
    }
    case 'plan':
      view = (
        <PlannerView
          c={c}
          kids={prefs.kids}
          filters={prefs.filters}
          plan={draft}
          dirty={dirty}
          saveState={!draft ? null : savedSnapshot !== null && draftJson === savedSnapshot ? 'saved' : savedSnapshot !== null ? 'changed' : 'new'}
          lastResult={lastResult}
          window={windowMinutes}
          start={start}
          seed={seed}
          momentLine={momentLine}
          extra={extra}
          onWindow={(minutes) => {
            setWindowMinutes(minutes);
            setDraft((d) => (d ? retitle(d, { ...d, window: minutes, updatedAt: new Date().toISOString() }) : d));
          }}
          onStart={(value) => {
            setStart(value);
            startTouched.current = value !== nextStart();
            if (draft && draft.start !== value) {
              // Offsets are relative to the start, so every entry and routine moves with it.
              setDraft(retitle(draft, { ...draft, start: value, updatedAt: new Date().toISOString() }));
              // "Just fed" was about the moment the plan was made; it no longer lines up.
              setPlanMoment(null);
              const end = parseHHMM(value) + Math.max(draft.window, analyzePlan(draft, c).end);
              announce(`Plan moved: now ${formatClock(parseHHMM(value))} to ${formatClock(end)}. Naps and feeds moved with it.`);
            }
          }}
          onFilters={(next) => {
            setFilters(next);
            if (lastResult?.blocked) setLastResult(null);
            // Energy, place, mode, and adults also apply to the open plan (its swaps, additions,
            // and checks). Nothing is removed: an entry that no longer fits keeps its place and
            // shows the analysis's conflict with Swap / Remove. "Who's this for?" only affects
            // the next plan.
            if (draft) {
              const settings = settingsFromFilters(next);
              if (JSON.stringify(settings) !== JSON.stringify(draft.settings)) setDraft({ ...draft, settings, updatedAt: new Date().toISOString() });
            }
          }}
          onGenerate={() => void generate()}
          onBlank={startBlank}
          onFillAround={() => void fillPlan()}
          onPlan={(p, note) => {
            if (!draft || draft.id !== p.id) {
              adopt(p, { pristine: true });
              setPlanMoment(null);
              setLastResult(null);
            } else if (p.window !== draft.window) {
              // "Extend to N min" from the editor: the window control follows the plan.
              setWindowMinutes(p.window);
              setDraft(retitle(draft, p));
            } else setDraft(p);
            if (note) notify(note);
          }}
          onSave={() => draft && savePlan(draft)}
          onShare={() => {
            rememberOpener();
            setSharing(true);
          }}
          onExport={() => {
            rememberOpener();
            setExporting(true);
          }}
          onClear={() => {
            if (dirty && !window.confirm('Close this plan? It isn’t saved.')) return;
            setDraft(null);
            setSavedSnapshot(null);
            setPristine(null);
            setPlanMoment(null);
            setLastResult(null);
            announce('Plan closed.');
          }}
          announce={announce}
        />
      );
      break;
    case 'saved':
      view = (
        <SavedView
          c={c}
          plans={saved}
          status={storeStatus.status}
          statusMessage={storeStatus.message}
          onOpen={(p) => openPlan(p, true)}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onImportFile={onImportFile}
        />
      );
      break;
    case 'about':
      view = <AboutView c={c} version={contentVersion} />;
      break;
    case 'shared':
      view = (
        <SharedView
          payload={route.payload}
          c={c}
          onSave={(plan) => {
            if (savePlan({ ...plan, id: newPlanId() })) go('#/saved');
          }}
          onOpen={(plan) => openPlan(plan, false)}
        />
      );
      break;
  }

  const activeNav = route.name === 'activity' || route.name === 'recipe' || route.name === 'shared' || route.name === 'about' ? null : route.name;

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <a className="brand" href="#/">
          <img className="logo" src={assetUrl(BRAND_ASSETS.logo168)} srcSet={LOGO_SRCSET} width={156} height={52} alt="Trunk" decoding="async" fetchPriority="high" />
        </a>
        <a className="header-link" href="#/about" aria-current={route.name === 'about' ? 'page' : undefined}>
          About
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<p role="status" className="page loading">Loading…</p>}>{view}</Suspense>
      </main>
      <nav className="bottom-nav" aria-label="Main">
        <ul>
          {NAV.map((n) => (
            <li key={n.route}>
              <a href={n.href} aria-current={activeNav === n.route ? 'page' : undefined}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d={n.icon} fill="currentColor" />
                </svg>
                {n.label}
                {n.route === 'plan' && draft ? <span className="visually-hidden"> (plan open)</span> : null}
                {n.route === 'saved' && saved.length ? <span className="visually-hidden"> ({saved.length} saved)</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <Toast toast={toast} onDone={() => setToast(null)} />
      {sharing && draft && (
        <Suspense fallback={null}>
        <ShareDialog
          plan={draft}
          c={c}
          onClose={() => {
            setSharing(false);
            returnFocus();
          }}
          onExport={() => {
            setSharing(false);
            setExporting(true);
          }}
        />
        </Suspense>
      )}
      {exporting && draft && (
        <Suspense
          fallback={
            <p role="status" className="toast">
              Preparing images…
            </p>
          }
        >
          <ExportDialog
            plan={draft}
            c={c}
            onClose={() => {
              setExporting(false);
              returnFocus();
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Not found</h1>
      <p>That activity isn’t in Trunk. It may have been renamed or retired.</p>
      <a className="button" href="#/">
        Find something to do
      </a>
    </div>
  );
}
