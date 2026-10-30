import type { Ability, Activity, MixedAgeRecipe } from '../content/schema.ts';
import { activityClaims, recipeClaims, useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import { ageStringToDays, formatAge, monthsToDays, type EnteredAge } from '../lib/age.ts';
import { activityFitsAge, recipeAssignment } from '../lib/eligibility.ts';
import { toDays } from '../lib/age.ts';
import { isBusyNearbyCompatible } from '../lib/supervision.ts';
import { ABILITY_LABEL, activityAges, adultText, attentionNote, durationText, recipeAges } from '../lib/labels.ts';
import { findingsFor, rulesFor, spanOf, type ChildTiming } from '../lib/timing.ts';
import { ClaimBlock, EvidenceDetails } from './Evidence.tsx';
import { activityHref, childName } from './IdeaCards.tsx';
import { TimingSection } from './Cues.tsx';
import { TummyTimeGuide } from './TummyTimeGuide.tsx';

const SUN_UNDER_6M = 'If you do this outside: AAP (2026) says keep babies under 6 months out of direct and indirect sun, in full shade, and not outside 10 a.m.–4 p.m.';

const ENERGY_SHORT: Record<Activity['effort'], string> = { low: 'Low', medium: 'Some', high: 'Active' };

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="quiet-button back" onClick={onBack}>
      ← Back
    </button>
  );
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="inline-facts">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StickyAdd({ onAdd, hint, label = 'Add to plan' }: { onAdd?: () => void; hint?: string; label?: string }) {
  if (!onAdd) return hint ? <p className="add-hint">{hint}</p> : null;
  return (
    <div className="sticky-add">
      <button type="button" className="primary" onClick={onAdd}>
        {label}
      </button>
    </div>
  );
}

function MediaNote({ c, a, childAge }: { c: IndexedCatalog; a: Activity; childAge?: EnteredAge }) {
  const days = childAge ? toDays(childAge) : null;
  const alternative =
    days === null
      ? undefined
      : c.activities.find((x) => !x.retired && x.kind !== 'media' && x.id !== a.id && activityFitsAge(x, days) && isBusyNearbyCompatible(x));
  const ready = useEvidence(c);
  const claims = ready ? ['clm.core.aap-coview-quality', 'clm.core.who-screen-under-5'].map((id) => c.claimById.get(id)).filter((x) => x !== undefined) : [];
  return (
    <section className="note-box" aria-labelledby="media-note">
      <h2 id="media-note">About this screen option</h2>
      <p>
        A show can buy you a few minutes. It isn’t the same as playing together, and you still need to keep watch. When you can, current guidance encourages watching with your child and talking about it afterward.
      </p>
      {alternative && (
        <p>
          <strong>No-screen alternative:</strong> <a href={activityHref(alternative.id)}>{alternative.title}</a>
        </p>
      )}
      <details className="more">
        <summary>What the guidance says</summary>
        {claims.map((claim) => (
          <ClaimBlock key={claim.id} claim={claim} c={c} />
        ))}
      </details>
    </section>
  );
}

/** Rules that apply right now, from the finder's momentary "Just fed" / "Nap soon" (never stored). */
function appliesNow(c: IndexedCatalog, a: Activity, now: ChildTiming | undefined): Set<string> {
  if (!now) return new Set();
  const span = spanOf(0, a.setupMinutes, a.duration.default, a.cleanupMinutes);
  return new Set(findingsFor(rulesFor(c, a.timing.stimulation, a.timing.rules), span, now).map((f) => f.ruleId));
}

/** Rules relevant to a child of this age (age-limited rules outside it are left out). */
function rulesForAge(c: IndexedCatalog, a: Activity, days: number | null) {
  return rulesFor(c, a.timing.stimulation, a.timing.rules).filter(
    (r) =>
      days === null ||
      ((!r.ageMin || !r.ageMax || (days >= ageStringToDays(r.ageMin) && days < ageStringToDays(r.ageMax))) &&
        // Meal and snack blocks are only for children already eating solids (6 months and older).
        !(r.event === 'meal' && days < monthsToDays(6))),
  );
}

export function ActivityDetail({
  c,
  a,
  childAge,
  now,
  onBack,
  onAdd,
  addHint,
}: {
  c: IndexedCatalog;
  a: Activity;
  childAge?: EnteredAge;
  /** The finder's momentary context for this child, if any. */
  now?: ChildTiming;
  onBack: () => void;
  onAdd?: () => void;
  /** Why there's no "Add to plan" here, when that isn't obvious. */
  addHint?: string;
}) {
  const attention = attentionNote(a.supervision);
  const days = childAge ? toDays(childAge) : null;
  const fits = days !== null ? activityFitsAge(a, days) : true;
  const facts: [string, string][] = [['Estimated time', durationText(a.duration)], ['Setup', a.setupMinutes ? `${a.setupMinutes} min` : 'none']];
  if (a.cleanupMinutes) facts.push(['Tidy', `${a.cleanupMinutes} min`]);
  facts.push(['Your energy', ENERGY_SHORT[a.effort]]);
  return (
    <article className="page detail">
      <BackLink onBack={onBack} />
      <h1>{a.title}</h1>
      <p className="lede">{a.summary}</p>
      {a.retired && <p className="banner">This activity has been retired from Trunk: {a.retired.reason}</p>}
      {childAge && !fits && !a.retired && <p className="banner">This one is meant for {activityAges(a)}, not {formatAge(childAge)}.</p>}
      <Facts items={facts} />

      <div className="brief">
        <p>
          <span className="k">You need</span> {a.materials.items.length ? a.materials.items.join(' · ') : 'Nothing'}
        </p>
        <p className="subtle">{a.supervision.space}</p>
        <p className="your-part">
          <span className="k">Your part</span> {adultText(a.supervision)}
          {attention ? `. ${attention}.` : '.'}
        </p>
      </div>

      <TimingSection c={c} groups={[{ rules: rulesForAge(c, a, days) }]} now={appliesNow(c, a, now)} knownChild={days !== null} />

      <section aria-labelledby="steps-h">
        <h2 id="steps-h">Steps</h2>
        <ol className="steps">
          {a.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="safety-box" aria-labelledby="safety-h">
        <h2 id="safety-h">Safety</h2>
        <ul>
          {a.safety.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
          {days !== null && days < monthsToDays(6) && a.places.includes('outdoors') && !a.hazards.includes('sun-weather') && <li>{SUN_UNDER_6M}</li>}
        </ul>
      </section>

      <section aria-labelledby="stop-h">
        <h2 id="stop-h">Stop or switch when</h2>
        <ul className="bullets">
          {a.stopCues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      {a.tummyTime && <TummyTimeGuide c={c} position={a.tummyTime.position} flatSurface={a.tummyTime.flatSurface} />}
      {a.kind === 'media' && <MediaNote c={c} a={a} childAge={childAge} />}

      <StickyAdd onAdd={onAdd} hint={addHint} />

      <div className="disclosures">
        <details className="more">
          <summary>Make it easier or harder</summary>
          <ul className="bullets">
            {a.adaptations.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
        {a.why && (
          <details className="more">
            <summary>Why it can help</summary>
            <p>{a.why.text}</p>
          </details>
        )}
        <details className="more">
          <summary>Who it’s for</summary>
          <p>
            {activityAges(a)}
            {a.readiness.abilities.length ? `, once your child ${a.readiness.abilities.map((x) => ABILITY_LABEL[x]).join(' and ')}` : ''}.
          </p>
          {a.readiness.notes.map((n) => (
            <p key={n} className="subtle">
              {n}
            </p>
          ))}
        </details>
      </div>

      <EvidenceDetails claims={() => activityClaims(c, a)} c={c} evidenceType={a.evidence.type} checked={a.checked} />
    </article>
  );
}

export function RecipeDetail({
  c,
  r,
  kids,
  now,
  onBack,
  onAdd,
}: {
  c: IndexedCatalog;
  r: MixedAgeRecipe;
  /** The parent's children (age and the readiness they marked "not yet"). */
  kids: { age: EnteredAge; notYet: Ability[] }[];
  /** Momentary context per child (index matches `kids`). */
  now?: (ChildTiming | undefined)[];
  onBack: () => void;
  onAdd?: () => void;
}) {
  const ages = kids.map((k) => k.age);
  const youngerAct = c.activityById.get(r.younger.activity);
  const olderAct = c.activityById.get(r.older.activity);
  // The same check the Add button uses: ages and the readiness the parent marked.
  const assignment = kids.length === 2 ? recipeAssignment(r, { days: toDays(ages[0]), notYet: kids[0].notYet }, { days: toDays(ages[1]), notYet: kids[1].notYet }) : null;
  const byAgeOnly = kids.length === 2 ? recipeAssignment(r, { days: toDays(ages[0]), notYet: [] }, { days: toDays(ages[1]), notYet: [] }) : null;
  const olderIdx = assignment === null ? null : assignment === 0 ? 1 : 0;
  const youngerName = assignment === null ? 'Younger child' : `${childName(assignment)} (${formatAge(ages[assignment])})`;
  const olderName = olderIdx === null ? 'Older child' : `${childName(olderIdx)} (${formatAge(ages[olderIdx])})`;
  const youngerShort = assignment === null ? 'Younger child' : childName(assignment);
  const olderShort = olderIdx === null ? 'Older child' : childName(olderIdx);
  const tummy = youngerAct?.tummyTime;
  // The pairing's own sourced safety notes already cover sun when a role carries the sun hazard.
  const sunCovered = [youngerAct, olderAct].some((x) => x?.hazards.includes('sun-weather')) || r.safety.some((x) => /\bsun\b|shade/i.test(x.text));
  const groups = [
    youngerAct && { label: youngerShort, rules: rulesForAge(c, youngerAct, assignment === null ? null : toDays(ages[assignment])) },
    olderAct && { label: olderShort, rules: rulesForAge(c, olderAct, olderIdx === null ? null : toDays(ages[olderIdx])) },
  ].filter((g): g is { label: string; rules: ReturnType<typeof rulesFor> } => Boolean(g));
  const nowIds = new Set<string>();
  if (assignment !== null && olderIdx !== null) {
    if (youngerAct) appliesNow(c, youngerAct, now?.[assignment]).forEach((id) => nowIds.add(id));
    if (olderAct) appliesNow(c, olderAct, now?.[olderIdx]).forEach((id) => nowIds.add(id));
  }
  return (
    <article className="page detail">
      <BackLink onBack={onBack} />
      <h1>{r.title}</h1>
      <p className="lede">{r.summary}</p>
      {r.retired && <p className="banner">This pairing has been retired from Trunk: {r.retired.reason}</p>}
      {kids.length === 2 && assignment === null && byAgeOnly === null && <p className="banner">This pairing is meant for {recipeAges(r)}.</p>}
      {kids.length === 2 && assignment === null && byAgeOnly !== null && <p className="banner">This pairing needs something one of your children isn’t doing yet (you marked it under Readiness on Find).</p>}
      <Facts
        items={[
          ['How', r.mode === 'together' ? 'Together' : 'Side by side'],
          ['Estimated time', durationText(r.duration)],
          ['Setup', r.setupMinutes ? `${r.setupMinutes} min, once` : 'none'],
          ['Adults', r.adult.minAdults === 1 ? 'One' : 'Two'],
        ]}
      />

      <section aria-labelledby="roles-h">
        <h2 id="roles-h">Who does what</h2>
        <div className="role-grid">
          <div className="role">
            <h3>{youngerName}</h3>
            <p>{r.younger.does}</p>
            {r.younger.adapt && <p className="subtle">{r.younger.adapt}</p>}
            {youngerAct && (
              <p className="tiny">
                Based on <a href={activityHref(youngerAct.id)}>{youngerAct.title}</a>
              </p>
            )}
          </div>
          <div className="role">
            <h3>{olderName}</h3>
            <p>{r.older.does}</p>
            {r.older.adapt && <p className="subtle">{r.older.adapt}</p>}
            {olderAct && (
              <p className="tiny">
                Based on <a href={activityHref(olderAct.id)}>{olderAct.title}</a>
              </p>
            )}
          </div>
          <div className="role adult">
            <h3>Your part</h3>
            <p>{r.adult.does}</p>
          </div>
        </div>
      </section>

      <div className="brief">
        <p>
          <span className="k">You need</span> {r.sharedSetup}
        </p>
        <p className="subtle">{r.space}</p>
      </div>

      <TimingSection c={c} groups={groups} now={nowIds} knownChild={assignment !== null} />

      <section aria-labelledby="steps-h">
        <h2 id="steps-h">Steps</h2>
        <ol className="steps">
          {r.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="safety-box" aria-labelledby="safety-h">
        <h2 id="safety-h">Safety</h2>
        <ul>
          {r.safety.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
          {!r.safety.some((x) => /playmate|in charge/i.test(x.text)) && <li>An older child is a playmate, never the one in charge of the baby.</li>}
          {r.places.includes('outdoors') && ageStringToDays(r.younger.ageMin) < monthsToDays(6) && !sunCovered && <li>{SUN_UNDER_6M}</li>}
        </ul>
      </section>

      <section aria-labelledby="stop-h">
        <h2 id="stop-h">Stop or switch when</h2>
        <ul className="bullets">
          {r.stopCues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      {tummy && <TummyTimeGuide c={c} position={tummy.position} flatSurface={tummy.flatSurface} />}

      <StickyAdd onAdd={onAdd} />

      <div className="disclosures">
        <details className="more">
          <summary>Who it’s for</summary>
          <p>{recipeAges(r)}.</p>
        </details>
      </div>

      <EvidenceDetails claims={() => recipeClaims(c, r)} c={c} checked={r.checked} />
    </article>
  );
}
