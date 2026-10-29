import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Ability, Goal } from '../content/schema.ts';
import { GOALS } from '../content/vocab.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { toDays, formatAge } from '../lib/age.ts';
import { activityFitsAge, recipeAssignment } from '../lib/eligibility.ts';
import { DEFAULT_FILTERS, findIdeas, RELAX_LABEL, relaxFilter, type Filters } from '../lib/filters.ts';
import { GOAL_LABEL } from '../lib/labels.ts';
import { hasMoment, NO_MOMENT, type MomentContext } from '../lib/timing.ts';
import { AgeControl, type ChildState } from './AgeControl.tsx';
import { ActivityCard, activityHref, RecipeCard, childName, recipeHref } from './IdeaCards.tsx';
import { Segmented } from './Segmented.tsx';

const TIME_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 0, label: 'Any' },
];

export function relevantAbilities(c: IndexedCatalog, child: ChildState): Ability[] {
  const d = toDays(child.age);
  const set = new Set<Ability>();
  for (const a of c.activities) if (!a.retired && activityFitsAge(a, d)) a.readiness.abilities.forEach((x) => set.add(x));
  for (const x of child.notYet) set.add(x);
  return [...set];
}

/** Short labels for the secondary filters that differ from the defaults. */
export function activeFilterSummary(f: Filters, two: boolean): string[] {
  const out: string[] = [];
  if (f.place !== 'any') out.push(f.place === 'indoors' ? 'Inside' : 'Outside');
  if (f.lowPrep) out.push('Low prep');
  if (two && f.focus === 'both' && f.mode !== 'either') out.push(f.mode === 'together' ? 'Together' : 'Side by side');
  if (f.goals.length === 1) out.push(GOAL_LABEL[f.goals[0]]);
  else if (f.goals.length > 1) out.push(`${f.goals.length} focus areas`);
  if (f.materials !== 'any') out.push(f.materials === 'none' ? 'Nothing needed' : 'Household only');
  if (f.mess !== 'any') out.push('Little mess');
  if (f.quiet) out.push('Quiet');
  if (f.adults === 2) out.push('Two adults');
  return out;
}

function sameFilters(a: Filters, b: Filters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FinderView(props: {
  catalog: IndexedCatalog;
  kids: ChildState[];
  filters: Filters;
  seed: number;
  moments: MomentContext[];
  onKids: (kids: ChildState[]) => void;
  onFilters: (filters: Filters) => void;
  onMoments: (moments: MomentContext[]) => void;
  onShuffle: () => void;
  /** Minutes for a fixed window; null opens the planner without generating. */
  onPlan: (minutes: number | null) => void;
}) {
  const { catalog: c, kids, filters: f, moments } = props;
  const inputs = kids.map((k) => ({ days: toDays(k.age), notYet: k.notYet }));
  const momentKey = JSON.stringify(moments);
  const result = useMemo(
    () => findIdeas(c, inputs, f, props.seed, moments),
    [c, JSON.stringify(inputs), f, props.seed, momentKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const two = kids.length === 2;
  const set = (patch: Partial<Filters>) => props.onFilters({ ...f, ...patch });
  const count = result.kind === 'recipes' ? result.recipes.length : result.activities.length;
  const anyMoment = moments.some((m) => hasMoment(m));
  const summary = activeFilterSummary(f, two);
  // Reset keeps the children's ages and "Who's this for?", and clears everything else, including "right now".
  const resetTo: Filters = { ...DEFAULT_FILTERS, focus: f.focus };
  const canReset = anyMoment || !sameFilters(f, resetTo);

  // Keep the control the parent just used where it was, so the page doesn't jump
  // when cues, set-aside notes, or detail selects appear or disappear.
  const anchor = useRef<{ el: Element; top: number } | null>(null);
  const holdPosition = () => {
    const el = document.activeElement;
    if (el && el !== document.body) anchor.current = { el, top: el.getBoundingClientRect().top };
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || !a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) window.scrollBy(0, delta);
  }, [momentKey, f]);

  const setMoment = (i: number, m: MomentContext) => {
    holdPosition();
    props.onMoments(kids.map((_, j) => (j === i ? m : (moments[j] ?? NO_MOMENT))));
  };

  const who =
    two && f.focus === 'both'
      ? `ages ${formatAge(kids[0].age)} and ${formatAge(kids[1].age)}`
      : `age ${formatAge(kids[two && f.focus !== 'both' ? f.focus : 0].age)}`;
  const heading = `${count} ${count === 1 ? 'idea' : 'ideas'} for ${who}`;
  const toggleGoal = (g: Goal) => set({ goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] });
  const timing = result.timing;
  const setAside = result.setAside;

  return (
    <div className="find-layout">
      <section className="find-controls" aria-label="Your children and what you have">
        <h1 className="visually-hidden">Find something to do</h1>
        {kids.map((k, i) => (
          <AgeControl
            key={i}
            label={childName(i)}
            child={k}
            relevantAbilities={relevantAbilities(c, k)}
            onChange={(next) => props.onKids(kids.map((x, j) => (j === i ? next : x)))}
            onRemove={
              two
                ? () => {
                    props.onKids(kids.filter((_, j) => j !== i));
                    props.onMoments(moments.filter((_, j) => j !== i));
                    set({ focus: 'both' });
                  }
                : undefined
            }
            onAddSibling={two ? undefined : () => props.onKids([...kids, { age: { value: 24, unit: 'm' }, notYet: [] }])}
            moment={moments[i] ?? NO_MOMENT}
            onMoment={(m) => setMoment(i, m)}
          />
        ))}

        <div className="controls quick">
          {two && (
            <Segmented
              legend="Who’s this for?"
              value={f.focus}
              options={[
                { value: 'both', label: 'Both' },
                { value: 0, label: 'Child 1' },
                { value: 1, label: 'Child 2' },
              ]}
              onChange={(focus) => set({ focus })}
            />
          )}
          <Segmented legend="Minutes you have" value={f.minutes ?? 0} options={TIME_OPTIONS} onChange={(m) => set({ minutes: m === 0 ? null : m })} />
          <Segmented
            legend="You right now"
            value={f.energy}
            options={[
              { value: 'busy', label: 'Busy nearby' },
              { value: 'low', label: 'Low energy' },
              { value: 'some', label: 'Some energy' },
              { value: 'plenty', label: 'Ready to play' },
            ]}
            onChange={(energy) => set({ energy })}
          />
          {f.energy === 'busy' && (
            <p className="tiny note">“Busy nearby” shows only ideas you can supervise from the same room while doing something else, like cooking. You still need to keep watching.</p>
          )}
          <div className="filter-bar">
            <details className="more filters">
              <summary>
                <span className="summary-text">
                  <span>More filters</span>
                  {summary.length > 0 && <span className="filter-summary">{summary.join(' · ')}</span>}
                </span>
              </summary>
              <div className="controls">
                <Segmented
                  legend="Where"
                  value={f.place}
                  options={[
                    { value: 'any', label: 'Anywhere' },
                    { value: 'indoors', label: 'Inside' },
                    { value: 'outdoors', label: 'Outside' },
                  ]}
                  onChange={(place) => set({ place })}
                />
                <label className="check" title="2 minutes of setup or less, little mess">
                  <input type="checkbox" checked={f.lowPrep} onChange={(e) => set({ lowPrep: e.target.checked })} />
                  Low prep only <span className="tiny">(≤ 2 min setup)</span>
                </label>
                {two && f.focus === 'both' && (
                  <Segmented
                    legend="How?"
                    value={f.mode}
                    options={[
                      { value: 'either', label: 'Either' },
                      { value: 'together', label: 'Together' },
                      { value: 'parallel', label: 'Side by side' },
                    ]}
                    onChange={(mode) => set({ mode })}
                  />
                )}
                <fieldset className="segmented">
                  <legend>Focus (any of)</legend>
                  <div className="chips">
                    {GOALS.map((g) => (
                      <label key={g} className="chip-toggle">
                        <input type="checkbox" checked={f.goals.includes(g)} onChange={() => toggleGoal(g)} />
                        {GOAL_LABEL[g]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Segmented
                  legend="Materials"
                  value={f.materials}
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'household', label: 'Household only' },
                    { value: 'none', label: 'Nothing needed' },
                  ]}
                  onChange={(materials) => set({ materials })}
                />
                <Segmented
                  legend="Mess"
                  value={f.mess}
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'low', label: 'Little or none' },
                  ]}
                  onChange={(mess) => set({ mess })}
                />
                <label className="check">
                  <input type="checkbox" checked={f.quiet} onChange={(e) => set({ quiet: e.target.checked })} />
                  Quiet only
                </label>
                <Segmented
                  legend="Adults here"
                  value={f.adults}
                  options={[
                    { value: 1, label: 'Just me' },
                    { value: 2, label: 'Two adults' },
                  ]}
                  onChange={(adults) => set({ adults })}
                />
              </div>
            </details>
            {canReset && (
              <button
                type="button"
                className="quiet-button reset"
                onClick={() => {
                  props.onFilters(resetTo);
                  props.onMoments(kids.map(() => NO_MOMENT));
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="results-heading" className="find-results">
        <div className="plan-cta">
          <button type="button" className="primary" onClick={() => props.onPlan(f.minutes)}>
            {f.minutes === null ? 'Make a plan' : `Plan the next ${f.minutes} minutes`}
          </button>
          <button type="button" onClick={props.onShuffle} aria-label="Shuffle the order of ideas">
            Shuffle
          </button>
        </div>
        <div className="results-head">
          <h2 id="results-heading">{heading}</h2>
        </div>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {heading}
          {setAside.length ? `, ${setAside.length} set aside for now` : ''}
        </p>
        {anyMoment && (
          <details className="set-aside">
            <summary>{setAside.length === 0 ? 'Nothing set aside for right now' : `${setAside.length} ${setAside.length === 1 ? 'idea' : 'ideas'} set aside for now`}</summary>
            {setAside.length > 0 && (
              <ul className="bullets">
                {setAside.map((s) => (
                  <li key={s.id}>
                    <a href={s.kind === 'recipe' ? recipeHref(s.id) : activityHref(s.id)}>{s.title}</a>: {s.cue}
                  </li>
                ))}
              </ul>
            )}
            <p className="tiny">Set aside because of what you said about right now, not because of age, readiness, or supervision. Turn “Just fed” or “Nap soon” off to see them again.</p>
          </details>
        )}
        {two && f.focus !== 'both' && (
          <p className="banner info">
            Ideas for {childName(f.focus)} only. Make sure {childName(f.focus === 0 ? 1 : 0)} is asleep, safely contained in view, or with another adult.
          </p>
        )}
        {count === 0 ? (
          <div className="empty">
            {result.eligibleCount === 0 ? (
              <>
                <p>
                  {two && f.focus === 'both'
                    ? 'Trunk doesn’t have a curated activity that safely fits these two ages with this many adults yet. You could pick ideas for one child while the other sleeps or is with another adult.'
                    : 'No activities match this age and readiness yet.'}
                </p>
                {two && f.focus === 'both' && (
                  <div className="relax-list">
                    <button type="button" onClick={() => set({ focus: 0 })}>
                      Ideas for Child 1 only
                    </button>
                    <button type="button" onClick={() => set({ focus: 1 })}>
                      Ideas for Child 2 only
                    </button>
                  </div>
                )}
              </>
            ) : result.relax.length ? (
              <>
                <p>Nothing matches every choice. One change brings ideas back:</p>
                <div className="relax-list">
                  {result.relax.map((r) => (
                    <button key={r.filter} type="button" onClick={() => props.onFilters(relaxFilter(f, r.filter))}>
                      {RELAX_LABEL[r.filter]} ({r.count})
                    </button>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 8 }}>
                  Safety limits—age, readiness, and supervision—are never loosened automatically.
                </p>
              </>
            ) : (
              <p>Nothing matches these choices. Try fewer filters.</p>
            )}
          </div>
        ) : result.kind === 'recipes' ? (
          <ul className="idea-list">
            {result.recipes.map((r) => (
              <RecipeCard key={r.id} r={r} younger={recipeAssignment(r, inputs[0], inputs[1]) ?? 0} ages={kids.map((k) => k.age)} timing={timing.get(r.id)} />
            ))}
          </ul>
        ) : (
          <ul className="idea-list">
            {result.activities.map((a) => (
              <ActivityCard key={a.id} a={a} timing={timing.get(a.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
