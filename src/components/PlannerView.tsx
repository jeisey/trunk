import { useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import type { StarterPlan } from '../content/schema.ts';
import { formatAge, parseAgeString } from '../lib/age.ts';
import { kidsToPlanKids, settingsFromFilters } from './planKids.ts';
import { ENERGY_LABEL, mediaAllowed, RELAX_LABEL, relaxFilter, type Filters } from '../lib/filters.ts';
import type { PlannerResult } from '../lib/planner.ts';
import type { Plan, PlanKid, PlanSettings } from '../lib/plan.ts';
import { layoutPlan } from '../lib/layout.ts';
import { makePlan } from '../lib/planEdit.ts';
import { starterToSegments } from '../lib/planner.ts';
import { LIMITS } from '../lib/text.ts';
import { nextStart } from '../lib/time.ts';
import type { ChildTiming } from '../lib/timing.ts';
import type { ChildState } from './AgeControl.tsx';
import { PlanEditor } from './PlanEditor.tsx';
import { defaultPlanTitle } from '../lib/planTitle.ts';
import { Segmented } from './Segmented.tsx';

function starterFits(sp: StarterPlan, kids: PlanKid[], c: IndexedCatalog, energy: Filters['energy'], place: Filters['place']): boolean {
  if (sp.ages.length !== kids.length) return false;
  // Plans with a screen option only appear in the contexts where screens are offered at all.
  const hasMedia = sp.segments.some((s) => s.kind === 'activity' && c.activityById.get(s.ref)?.kind === 'media');
  if (hasMedia && !mediaAllowed(energy)) return false;
  // "Inside" hides starter plans that include outdoor-only entries.
  if (place === 'indoors') {
    const outdoorOnly = sp.segments.some((s) =>
      s.kind === 'activity' ? !c.activityById.get(s.ref)?.places.includes('indoors') : s.kind === 'recipe' ? !c.recipeById.get(s.ref)?.places.includes('indoors') : false,
    );
    if (outdoorOnly) return false;
  }
  return starterToSegments(sp, kids, c).dropped.length === 0;
}

const BASE_WINDOWS = [10, 20, 30, 60, 90, 120, 180];

function windowLabel(m: number): string {
  if (m % 60 === 0) return `${m / 60} hr`;
  if (m > 60) return `${Math.floor(m / 60)} hr ${m % 60}`;
  return `${m} min`;
}

export function windowOptions(current: number) {
  const values = BASE_WINDOWS.includes(current) ? BASE_WINDOWS : [...BASE_WINDOWS, current].sort((a, b) => a - b);
  return values.map((value) => ({ value, label: windowLabel(value) }));
}

export function PlannerView(props: {
  c: IndexedCatalog;
  kids: ChildState[];
  filters: Filters;
  plan: Plan | null;
  dirty: boolean;
  lastResult: PlannerResult | null;
  window: number;
  start: string;
  seed: number;
  /** "Planned for: Child 1 just fed" while the momentary context still applies (React state only). */
  momentLine: string | null;
  extra?: ChildTiming[];
  onWindow: (minutes: number) => void;
  onStart: (start: string) => void;
  onFilters: (f: Filters) => void;
  onGenerate: () => void;
  onBlank: () => void;
  onFillAround: () => void;
  onPlan: (plan: Plan, note?: string) => void;
  onSave: () => void;
  onShare: () => void;
  onExport: () => void;
  onClear: () => void;
  announce: (text: string) => void;
}) {
  const { c, plan, filters: f } = props;
  const allKids = kidsToPlanKids(props.kids);
  const planKids = allKids.length === 2 && f.focus !== 'both' ? [allKids[f.focus]] : allKids;
  const [confirmReplace, setConfirmReplace] = useState(false);
  const starters = c.starterPlans.filter((sp) => starterFits(sp, planKids, c, f.energy, f.place));
  const blocked = props.lastResult?.blocked;
  const shownKids = plan ? plan.kids : planKids;
  const keeps = plan ? plan.segments.some((s) => s.kind === 'routine' || s.kind === 'custom' || s.locked) : false;

  const useStarter = (sp: StarterPlan) => {
    const settings = settingsFromFilters(f);
    const { segments, dropped, changed } = starterToSegments(sp, planKids, c, settings);
    const next = makeStarterPlan(planKids, settings, props.start, segments, sp.title, c);
    const notes = [dropped.length ? `${dropped.length} item(s) didn’t fit these ages and were left out.` : '', changed.length ? `${changed.length} item(s) moved back into the main plan.` : ''].filter(Boolean);
    props.onPlan(next, notes.length ? notes.join(' ') : undefined);
    props.onWindow(next.window);
  };

  const fill = () => {
    if (plan && plan.segments.length > 0 && props.dirty && !keeps && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    if (plan) props.onFillAround();
    else props.onGenerate();
  };

  const settingsControls = (
    <>
      <Segmented
        legend="You right now"
        value={f.energy}
        options={[
          { value: 'busy', label: 'Busy nearby' },
          { value: 'low', label: 'Low energy' },
          { value: 'some', label: 'Some energy' },
          { value: 'plenty', label: 'Ready to play' },
        ]}
        onChange={(energy) => props.onFilters({ ...f, energy })}
      />
      <Segmented
        legend="Where"
        value={f.place}
        options={[
          { value: 'any', label: 'Anywhere' },
          { value: 'indoors', label: 'Inside' },
          { value: 'outdoors', label: 'Outside' },
        ]}
        onChange={(place) => props.onFilters({ ...f, place })}
      />
      {props.kids.length === 2 && !plan && (
        <Segmented
          legend="Who’s this for?"
          value={f.focus}
          options={[
            { value: 'both', label: 'Both' },
            { value: 0, label: 'Child 1' },
            { value: 1, label: 'Child 2' },
          ]}
          onChange={(focus) => props.onFilters({ ...f, focus })}
        />
      )}
      {props.kids.length === 2 && f.focus !== 'both' && !plan && (
        <p className="banner info">
          Planning for {f.focus === 0 ? 'Child 1' : 'Child 2'} only. Make sure {f.focus === 0 ? 'Child 2' : 'Child 1'} is asleep, safely contained in view, or with another adult.
        </p>
      )}
      {shownKids.length === 2 && (
        <>
          <Segmented
            legend="How?"
            value={f.mode}
            options={[
              { value: 'either', label: 'Mix' },
              { value: 'together', label: 'Together' },
              { value: 'parallel', label: 'Side by side' },
            ]}
            onChange={(mode) => props.onFilters({ ...f, mode })}
          />
          <Segmented
            legend="Adults here"
            value={f.adults}
            options={[
              { value: 1, label: 'Just me' },
              { value: 2, label: 'Two adults' },
            ]}
            onChange={(adults) => props.onFilters({ ...f, adults })}
          />
        </>
      )}
    </>
  );

  const settingsSummary = [ENERGY_LABEL[f.energy], f.place === 'any' ? 'Anywhere' : f.place === 'indoors' ? 'Inside' : 'Outside', ...(shownKids.length === 2 ? [f.adults === 1 ? 'Just me' : 'Two adults'] : [])].join(' · ');

  return (
    <div className="page planner">
      <h1>Plan</h1>
      <p className="subtle for-line">For {shownKids.map((k) => formatAge(k.age)).join(' and ')}</p>
      {plan && props.momentLine && (
        <p className="moment-line">
          <strong>Planned for:</strong> {props.momentLine}
        </p>
      )}
      <div className="panel plan-setup">
        <div className="inline-fields start-row">
          <label>
            Start
            <input type="time" value={props.start} onChange={(e) => e.target.value && props.onStart(e.target.value)} />
          </label>
          <button type="button" className="quiet-button" onClick={() => props.onStart(nextStart())}>
            Now
          </button>
        </div>
        <Segmented legend="How long" value={props.window} options={windowOptions(props.window)} onChange={props.onWindow} />
        {plan ? (
          <details className="more">
            <summary>
              <span className="summary-text">
                <span>Settings</span>
                <span className="filter-summary">{settingsSummary}</span>
              </span>
            </summary>
            <div className="controls">{settingsControls}</div>
          </details>
        ) : (
          settingsControls
        )}
        {!plan && (
          <div className="create-row">
            <button type="button" className="primary" onClick={fill}>
              Fill the next {props.window} minutes
            </button>
            <button type="button" onClick={props.onBlank}>
              Start a blank plan
            </button>
          </div>
        )}
      </div>

      {blocked && (
        <div className="empty" role="status">
          <p>{blocked.reason}</p>
          {props.kids.length === 2 && f.focus === 'both' && !plan && (
            <div className="relax-list">
              <button type="button" onClick={() => props.onFilters({ ...f, focus: 0 })}>
                Plan for Child 1 only
              </button>
              <button type="button" onClick={() => props.onFilters({ ...f, focus: 1 })}>
                Plan for Child 2 only
              </button>
            </div>
          )}
          {blocked.relax.length > 0 && (
            <div className="relax-list">
              {blocked.relax.map((r) => (
                <button key={r.filter} type="button" onClick={() => props.onFilters(relaxFilter(f, r.filter))}>
                  {RELAX_LABEL[r.filter]}
                </button>
              ))}
            </div>
          )}
          <p className="tiny">Age, readiness, and supervision limits stay in place.</p>
        </div>
      )}

      {plan ? (
        <section className="plan-body" aria-labelledby="plan-name-label">
          <label className="field plan-name" id="plan-name-label">
            <span>Plan name</span>
            <input
              type="text"
              maxLength={LIMITS.title}
              value={plan.title}
              placeholder={defaultPlanTitle(plan)}
              onChange={(e) => props.onPlan({ ...plan, title: e.target.value.slice(0, LIMITS.title), updatedAt: new Date().toISOString() })}
            />
          </label>
          {props.lastResult?.notes.map((n) => (
            <p key={n} className="tiny planner-note">
              {n}
            </p>
          ))}
          <PlanEditor
            plan={plan}
            c={c}
            extra={props.extra}
            seed={props.seed}
            onChange={(p) => props.onPlan(p)}
            announce={props.announce}
            footer={
              <button type="button" onClick={fill}>
                {keeps ? 'Fill around these blocks' : plan.segments.length ? 'Refill this plan' : `Fill the next ${plan.window} minutes`}
              </button>
            }
          />
          {confirmReplace && (
            <div className="banner" role="alert">
              <p>Replace everything in this unsaved plan?</p>
              <div className="button-row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setConfirmReplace(false);
                    props.onFillAround();
                  }}
                >
                  Replace it
                </button>
                <button type="button" onClick={() => setConfirmReplace(false)}>
                  Keep editing
                </button>
              </div>
            </div>
          )}
          <label className="field notes">
            <span>Private notes (not shared unless you choose)</span>
            <textarea maxLength={LIMITS.notes} value={plan.notes} onChange={(e) => props.onPlan({ ...plan, notes: e.target.value.slice(0, LIMITS.notes), updatedAt: new Date().toISOString() })} />
          </label>
          <div className="plan-actions">
            <button type="button" className="primary" onClick={props.onSave}>
              Save
            </button>
            <button type="button" onClick={props.onShare}>
              Share link
            </button>
            <button type="button" onClick={props.onExport}>
              Save as image
            </button>
            <button type="button" onClick={props.onClear}>
              Close plan
            </button>
          </div>
        </section>
      ) : (
        starters.length > 0 && (
          <section className="starters" aria-labelledby="starters-h">
            <h2 id="starters-h">Or start from an example</h2>
            <ul className="idea-list">
              {starters.map((sp) => (
                <li key={sp.id} className="idea starter">
                  <p className="idea-title">{sp.title}</p>
                  <p className="tiny">
                    {sp.circumstance} · written for {sp.ages.map((a) => formatAge(parseAgeString(a)!)).join(' and ')}
                  </p>
                  <p className="idea-summary">{sp.summary}</p>
                  <button type="button" onClick={() => useStarter(sp)}>
                    Use and edit this plan
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

/** A starter becomes an ordinary plan; its window covers everything it holds (in 15-minute steps). */
function makeStarterPlan(kids: PlanKid[], settings: PlanSettings, start: string, segments: Plan['segments'], title: string, c: IndexedCatalog): Plan {
  const end = layoutPlan({ kids, segments }, c).reduce((m, it) => Math.max(m, it.end), 0);
  const window = Math.max(30, Math.min(720, Math.ceil(end / 15) * 15));
  return makePlan(kids, settings, start, window, segments, title);
}
