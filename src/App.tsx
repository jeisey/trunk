import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { catalog as c, contentVersion, loadEvidence } from './content/catalog.ts';
import { toDays } from './lib/age.ts';
import { recipeAssignment } from './lib/eligibility.ts';
import { activityEligible, type Filters } from './lib/filters.ts';
import { planWindow, type PlannerResult } from './lib/planner.ts';
import { newId, newPlanId, youngerFor, type Plan, type PlanSegment } from './lib/plan.ts';
import { reconcileSegments } from './lib/reconcile.ts';
import { importPlanFile, ShareError } from './lib/share.ts';
import { PlanStore, type StoreStatus } from './lib/storage.ts';
import { cleanText, LIMITS } from './lib/text.ts';
import { nextStart } from './lib/time.ts';
import { loadPrefs, savePrefs, type Prefs } from './state.ts';
import { AboutView } from './components/AboutView.tsx';
import { ActivityDetail, RecipeDetail } from './components/Details.tsx';
import { FinderView } from './components/FinderView.tsx';
import { Mascot } from './components/Mascot.tsx';
import { kidsToPlanKids, makePlan, PlannerView, settingsFromFilters } from './components/PlannerView.tsx';
import { SavedView } from './components/SavedView.tsx';
import { ShareDialog } from './components/ShareDialog.tsx';
import { SharedView } from './components/SharedView.tsx';
import { Toast, type ToastState } from './components/Toast.tsx';

const ExportDialog = lazy(() => import('./export/ExportDialog.tsx'));

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

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [seed, setSeed] = useState(0);
  const store = useMemo(() => new PlanStore(), []);
  const [saved, setSaved] = useState<Plan[]>([]);
  const [storeStatus, setStoreStatus] = useState<{ status: StoreStatus; message?: string }>({ status: 'ok' });
  const [draft, setDraft] = useState<Plan | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PlannerResult | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(90);
  const [start, setStart] = useState(() => nextStart());
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  // Prefetch claims and sources once the first screen is up.
  useEffect(() => {
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500));
    idle(() => void loadEvidence());
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
    const h1 = document.querySelector('main h1');
    if (navigatedInApp.current && h1 instanceof HTMLElement) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
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
  const dirty = draft !== null && JSON.stringify(draft) !== savedSnapshot;

  /** Children the plan is for: both, or one when the parent chose a single child. */
  const planChildren = () => {
    const kids = kidsToPlanKids(prefs.kids);
    return kids.length === 2 && prefs.filters.focus !== 'both' ? [kids[prefs.filters.focus]] : kids;
  };

  const generate = (minutes = windowMinutes) => {
    const planKids = planChildren();
    const settings = settingsFromFilters(prefs.filters);
    const s = seed + 1;
    setSeed(s);
    const result = planWindow(c, { kids: planKids, settings, window: minutes, seed: s });
    setLastResult(result);
    if (result.blocked) {
      announce(result.blocked.reason);
      return;
    }
    setDraft(makePlan(planKids, settings, start, minutes, result.segments));
    setSavedSnapshot(null);
    announce(`Made a ${minutes}-minute plan with ${result.segments.length} entries.`);
  };

  const planFromFinder = (minutes: number) => {
    setWindowMinutes(minutes);
    if (draft && dirty) {
      go('#/plan');
      notify('You have an unsaved plan open. Tap “Make a new plan” to replace it.');
      return;
    }
    generate(minutes);
    go('#/plan');
  };

  const savePlan = (plan: Plan) => {
    const r = store.save({ ...plan, title: cleanText(plan.title, LIMITS.title), notes: cleanText(plan.notes, LIMITS.notes, { multiline: true }) });
    if (r.ok) {
      setSaved(r.plans);
      setStoreStatus({ status: store.getStatus() });
      if (draft && plan.id === draft.id) setSavedSnapshot(JSON.stringify(plan));
      notify(r.action === 'created' ? 'Saved in this browser.' : 'Changes saved.');
      return true;
    }
    notify(r.message);
    return false;
  };

  const openPlan = (plan: Plan, fromStore: boolean) => {
    if (dirty && draft && draft.id !== plan.id && !window.confirm('Replace the plan you’re editing? It isn’t saved.')) return;
    const { segments, dropped } = reconcileSegments(plan.kids, plan.settings, plan.segments, c);
    const next = { ...plan, segments };
    setDraft(next);
    setSavedSnapshot(fromStore ? JSON.stringify(plan) : null);
    setLastResult(null);
    setWindowMinutes(plan.window);
    setStart(plan.start);
    go('#/plan');
    if (dropped.length) notify(`${dropped.length} item(s) no longer fit and were left out.`);
  };

  const addToPlan = (kind: 'activity' | 'recipe', ref: string) => {
    const planKids = planChildren();
    if (kind === 'activity' && planKids.length === 2) {
      notify('With two children, plans use the paired ideas. Choose “Both” and a together or side-by-side idea.');
      return;
    }
    let base = draft;
    if (!base || base.kids.length !== planKids.length || JSON.stringify(base.kids.map((k) => k.age)) !== JSON.stringify(planKids.map((k) => k.age))) {
      if (base && dirty && !window.confirm('Start a new plan for these ages? Your current plan isn’t saved.')) return;
      base = makePlan(planKids, settingsFromFilters(prefs.filters), start, windowMinutes, []);
      setSavedSnapshot(null);
    }
    const item = kind === 'activity' ? c.activityById.get(ref) : c.recipeById.get(ref);
    if (!item) return;
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

  const onDelete = (plan: Plan) => {
    const r = store.remove(plan.id);
    if (!r.ok) return notify(r.message);
    setSaved(r.plans);
    const { removed, index } = r;
    notify(`Deleted “${plan.title || 'Untitled plan'}”.`, removed
      ? {
          label: 'Undo',
          run: () => {
            const back = store.restore(removed, index ?? 0);
            if (back.ok) setSaved(back.plans);
            else notify(back.message);
          },
        }
      : undefined);
  };

  const onDuplicate = (plan: Plan) => {
    const stamp = new Date().toISOString();
    const copy = { ...plan, id: newPlanId(), title: `Copy of ${plan.title || 'plan'}`.slice(0, LIMITS.title), createdAt: stamp, updatedAt: stamp };
    savePlan(copy);
  };

  const onRename = (plan: Plan, title: string) => {
    const updated = { ...plan, title: cleanText(title, LIMITS.title), updatedAt: new Date().toISOString() };
    if (savePlan(updated) && draft?.id === plan.id) {
      setDraft(updated);
      setSavedSnapshot(JSON.stringify(updated));
    }
  };

  const onImportFile = (text: string) => {
    try {
      const result = importPlanFile(text, c);
      openPlan(result.plan, false);
      if (result.dropped.length) notify(`${result.dropped.length} item(s) didn’t pass today’s checks and were left out.`);
    } catch (e) {
      notify(e instanceof ShareError ? e.message : 'That file couldn’t be opened.');
    }
  };

  const kidsAges = prefs.kids.map((k) => k.age);
  const detailAge = prefs.kids.length === 2 && prefs.filters.focus !== 'both' ? prefs.kids[prefs.filters.focus].age : prefs.kids[0].age;

  let view: React.ReactNode;
  switch (route.name) {
    case 'find':
      view = (
        <FinderView
          catalog={c}
          kids={prefs.kids}
          filters={prefs.filters}
          seed={seed}
          onKids={setKids}
          onFilters={setFilters}
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
      const childInput = { days: toDays(detailAge), notYet: [] };
      view = a ? (
        <ActivityDetail
          c={c}
          a={a}
          childAge={detailAge}
          onBack={back}
          onAdd={!a.retired && activityEligible(a, childInput, prefs.filters.adults) && !(prefs.kids.length === 2 && prefs.filters.focus === 'both') ? () => addToPlan('activity', a.id) : undefined}
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
      view = r ? <RecipeDetail c={c} r={r} ages={kidsAges} onBack={back} onAdd={fits && !r.retired ? () => addToPlan('recipe', r.id) : undefined} /> : <NotFound />;
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
          lastResult={lastResult}
          window={windowMinutes}
          start={start}
          onWindow={setWindowMinutes}
          onStart={setStart}
          onFilters={(next) => {
            setFilters(next);
            if (lastResult?.blocked) setLastResult(null);
          }}
          onGenerate={() => generate()}
          onPlan={(p, note) => {
            setDraft(p);
            if (note) notify(note);
          }}
          onSave={() => draft && savePlan(draft)}
          onShare={() => setSharing(true)}
          onExport={() => setExporting(true)}
          onClear={() => {
            if (dirty && !window.confirm('Close this plan? It isn’t saved.')) return;
            setDraft(null);
            setSavedSnapshot(null);
            setLastResult(null);
          }}
          announce={announce}
        />
      );
      break;
    case 'saved':
      view = (
        <SavedView
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
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="app-header">
        <a className="brand" href="#/" aria-label="Trunk home: find something to do">
          <Mascot size={40} />
          <span>
            <span className="brand-name">Trunk</span>
            <br />
            <span className="brand-tagline">A little help for the next hour</span>
          </span>
        </a>
        <a className="header-link" href="#/about" aria-current={route.name === 'about' ? 'page' : undefined}>
          About &amp; sources
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        {view}
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
      {sharing && draft && <ShareDialog plan={draft} c={c} onClose={() => setSharing(false)} onExport={() => { setSharing(false); setExporting(true); }} />}
      {exporting && draft && (
        <Suspense fallback={<p role="status" className="toast">Preparing images…</p>}>
          <ExportDialog plan={draft} c={c} onClose={() => setExporting(false)} />
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
