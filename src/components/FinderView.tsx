import { useMemo } from 'react';
import type { Ability, Goal } from '../content/schema.ts';
import { GOALS } from '../content/vocab.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { toDays, formatAge } from '../lib/age.ts';
import { activityFitsAge } from '../lib/eligibility.ts';
import { findIdeas, RELAX_LABEL, relaxFilter, type Filters } from '../lib/filters.ts';
import { recipeAssignment } from '../lib/eligibility.ts';
import { GOAL_LABEL } from '../lib/labels.ts';
import { AgeControl, type ChildState } from './AgeControl.tsx';
import { ActivityCard, RecipeCard, childName } from './IdeaCards.tsx';
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

export function FinderView(props: {
  catalog: IndexedCatalog;
  kids: ChildState[];
  filters: Filters;
  seed: number;
  onKids: (kids: ChildState[]) => void;
  onFilters: (filters: Filters) => void;
  onShuffle: () => void;
  onPlan: (minutes: number) => void;
}) {
  const { catalog: c, kids, filters: f } = props;
  const inputs = kids.map((k) => ({ days: toDays(k.age), notYet: k.notYet }));
  const result = useMemo(() => findIdeas(c, inputs, f, props.seed), [c, JSON.stringify(inputs), f, props.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const two = kids.length === 2;
  const set = (patch: Partial<Filters>) => props.onFilters({ ...f, ...patch });
  const count = result.kind === 'recipes' ? result.recipes.length : result.activities.length;

  const who =
    two && f.focus === 'both'
      ? `ages ${formatAge(kids[0].age)} and ${formatAge(kids[1].age)}`
      : `age ${formatAge(kids[two && f.focus !== 'both' ? f.focus : 0].age)}`;
  const heading = `${count} ${count === 1 ? 'idea' : 'ideas'} for ${who}`;

  const toggleGoal = (g: Goal) => set({ goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] });

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
            onRemove={two ? () => { props.onKids(kids.filter((_, j) => j !== i)); set({ focus: 'both' }); } : undefined}
            onAddSibling={two ? undefined : () => props.onKids([...kids, { age: { value: 24, unit: 'm' }, notYet: [] }])}
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
          {f.energy === 'busy' && (
            <p className="tiny" style={{ margin: 0 }}>
              “Busy nearby” shows only ideas you can supervise from the same room while doing something else, like cooking. You still need to keep watching.
            </p>
          )}
          <details className="more">
            <summary>More filters</summary>
            <div className="controls" style={{ marginTop: 4 }}>
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
        </div>
      </section>

      <section aria-labelledby="results-heading">
        <div className="plan-cta">
          <button type="button" className="primary" onClick={() => props.onPlan(90)}>
            Plan the next 90 minutes
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
        </p>
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
              <RecipeCard key={r.id} r={r} younger={recipeAssignment(r, inputs[0], inputs[1]) ?? 0} ages={kids.map((k) => k.age)} />
            ))}
          </ul>
        ) : (
          <ul className="idea-list">
            {result.activities.map((a) => (
              <ActivityCard key={a.id} a={a} />
            ))}
          </ul>
        )}
        <p className="tiny" style={{ marginTop: 14 }}>
          Ideas are source-informed, not individually reviewed by a clinician. Age is a starting point; follow your child’s cues, and ask their clinician about prematurity or medical needs.
        </p>
      </section>
    </div>
  );
}
