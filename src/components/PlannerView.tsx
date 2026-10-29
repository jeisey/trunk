import { useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import type { StarterPlan } from '../content/schema.ts';
import { formatAge, parseAgeString, normalizeEnteredAge } from '../lib/age.ts';
import { mediaAllowed, RELAX_LABEL, relaxFilter, type Filters } from '../lib/filters.ts';
import type { PlannerResult } from '../lib/planner.ts';
import { BREAK_LABEL, newId, newPlanId, PLAN_VERSION, type Plan, type PlanKid, type PlanSegment, type PlanSettings } from '../lib/plan.ts';
import { reconcileSegments } from '../lib/reconcile.ts';
import { cleanText, LIMITS } from '../lib/text.ts';
import { nextStart } from '../lib/time.ts';
import type { ChildState } from './AgeControl.tsx';
import { PlanEditor } from './PlanEditor.tsx';
import { Segmented } from './Segmented.tsx';

export function kidsToPlanKids(kids: ChildState[]): PlanKid[] {
  return kids.map((k) => {
    const age = normalizeEnteredAge(k.age);
    return { age: { value: age.value, unit: age.unit === 'w' ? 'w' : 'm' }, notYet: [...k.notYet] };
  });
}

export function settingsFromFilters(f: Filters): PlanSettings {
  return { energy: f.energy, place: f.place, mode: f.mode, adults: f.adults };
}

export function makePlan(kids: PlanKid[], settings: PlanSettings, start: string, window: number, segments: PlanSegment[], title = ''): Plan {
  const stamp = new Date().toISOString();
  return {
    v: PLAN_VERSION,
    id: newPlanId(),
    title,
    kids,
    start,
    window,
    settings,
    segments,
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function starterFits(sp: StarterPlan, kids: PlanKid[], c: IndexedCatalog, energy: Filters['energy']): boolean {
  if (sp.ages.length !== kids.length) return false;
  // Plans with a screen option only appear in the contexts where screens are offered at all.
  const hasMedia = sp.segments.some((s) => s.kind === 'activity' && c.activityById.get(s.ref)?.kind === 'media');
  if (hasMedia && !mediaAllowed(energy)) return false;
  const segs = starterSegments(sp);
  const settings: PlanSettings = { energy: 'plenty', place: 'any', mode: 'either', adults: 1 };
  return reconcileSegments(kids, settings, segs, c).dropped.length === 0;
}

function starterSegments(sp: StarterPlan): PlanSegment[] {
  return sp.segments.map((s) =>
    s.kind === 'break'
      ? { id: newId('b'), kind: 'break', minutes: s.minutes, label: s.label ? cleanText(s.label, LIMITS.custom) : BREAK_LABEL }
      : { id: newId(s.kind === 'recipe' ? 'r' : 'a'), kind: s.kind, ref: s.ref, minutes: s.minutes },
  );
}

const WINDOW_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '90 min' },
  { value: 120, label: '2 hr' },
  { value: 180, label: '3 hr' },
];

export function PlannerView(props: {
  c: IndexedCatalog;
  kids: ChildState[];
  filters: Filters;
  plan: Plan | null;
  dirty: boolean;
  lastResult: PlannerResult | null;
  window: number;
  start: string;
  onWindow: (minutes: number) => void;
  onStart: (start: string) => void;
  onFilters: (f: Filters) => void;
  onGenerate: () => void;
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
  const starters = c.starterPlans.filter((sp) => starterFits(sp, planKids, c, f.energy));
  const blocked = props.lastResult?.blocked;

  const generate = () => {
    if (plan && props.dirty && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    props.onGenerate();
  };

  const useStarter = (sp: StarterPlan) => {
    const settings = settingsFromFilters(f);
    const { segments, dropped } = reconcileSegments(planKids, settings, starterSegments(sp), c);
    const window = segments.reduce((sum, s) => sum + s.minutes, 0) + 30;
    const next = makePlan(planKids, settings, props.start, Math.max(30, Math.min(720, Math.ceil(window / 15) * 15)), segments, sp.title);
    props.onPlan(next, dropped.length ? `${dropped.length} item(s) didn’t fit these ages and were left out.` : undefined);
  };

  return (
    <div className="page">
      <h1>Plan a window</h1>
      <p className="subtle">
        For {planKids.map((k) => formatAge(k.age)).join(' and ')}. A plan is a set of possibilities, not a schedule—follow your {planKids.length > 1 ? 'children’s' : 'child’s'} cues.
      </p>
      <div className="panel plan-inputs">
        <div className="inline-fields">
          <label>
            Start
            <input type="time" value={props.start} onChange={(e) => e.target.value && props.onStart(e.target.value)} />
          </label>
          <button type="button" className="quiet-button" onClick={() => props.onStart(nextStart())}>
            Now
          </button>
        </div>
        <Segmented legend="How long" value={props.window} options={WINDOW_OPTIONS} onChange={props.onWindow} />
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
        {props.kids.length === 2 && (
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
        {props.kids.length === 2 && f.focus !== 'both' && (
          <p className="banner info" style={{ margin: 0 }}>
            Planning for {f.focus === 0 ? 'Child 1' : 'Child 2'} only. Make sure {f.focus === 0 ? 'Child 2' : 'Child 1'} is asleep, safely contained in view, or with another adult.
          </p>
        )}
        {planKids.length === 2 && (
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
        <button type="button" className="primary wide" onClick={generate}>
          {plan ? 'Make a new plan' : `Fill the next ${props.window} minutes`}
        </button>
        {confirmReplace && (
          <div className="banner" role="alert">
            <p style={{ marginBottom: 8 }}>Replace your current, unsaved plan?</p>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => { setConfirmReplace(false); props.onGenerate(); }}>
                Replace it
              </button>
              <button type="button" onClick={() => setConfirmReplace(false)}>
                Keep editing
              </button>
            </div>
          </div>
        )}
      </div>

      {blocked && (
        <div className="empty" role="status" style={{ marginTop: 12 }}>
          <p>{blocked.reason}</p>
          {props.kids.length === 2 && f.focus === 'both' && (
            <div className="relax-list" style={{ marginBottom: 8 }}>
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
          <p className="tiny" style={{ marginTop: 8 }}>
            Age, readiness, and supervision limits stay in place.
          </p>
        </div>
      )}

      {plan ? (
        <section style={{ marginTop: 16 }} aria-labelledby="plan-h">
          <label style={{ display: 'grid', gap: 2, fontWeight: 650, fontSize: '0.85rem', color: 'var(--muted)' }}>
            Plan name
            <input
              id="plan-h"
              type="text"
              maxLength={LIMITS.title}
              value={plan.title}
              placeholder="Untitled plan"
              onChange={(e) => props.onPlan({ ...plan, title: e.target.value.slice(0, LIMITS.title), updatedAt: new Date().toISOString() })}
            />
          </label>
          {props.lastResult?.notes.map((n) => (
            <p key={n} className="tiny" style={{ margin: '8px 0 0' }}>
              {n}
            </p>
          ))}
          <PlanEditor plan={plan} c={c} onChange={(p) => props.onPlan(p)} announce={props.announce} />
          <label style={{ display: 'grid', gap: 2, marginTop: 14, fontWeight: 650, fontSize: '0.85rem', color: 'var(--muted)' }}>
            Private notes (not shared unless you choose)
            <textarea
              maxLength={LIMITS.notes}
              value={plan.notes}
              onChange={(e) => props.onPlan({ ...plan, notes: e.target.value.slice(0, LIMITS.notes), updatedAt: new Date().toISOString() })}
            />
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
          <p className="tiny">
            Times are estimates. This plan isn’t a feeding, sleep, or wake schedule; stop or change it whenever your {props.kids.length > 1 ? 'children need' : 'child needs'}.
          </p>
        </section>
      ) : (
        starters.length > 0 && (
          <section style={{ marginTop: 18 }} aria-labelledby="starters-h">
            <h2 id="starters-h">Or start from an example</h2>
            <ul className="idea-list">
              {starters.map((sp) => (
                <li key={sp.id} className="idea" style={{ padding: '12px 14px' }}>
                  <p className="idea-title">{sp.title}</p>
                  <p className="tiny" style={{ marginBottom: 4 }}>
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
