import type { Activity, MixedAgeRecipe } from '../content/schema.ts';
import { activityClaims, recipeClaims, useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import { formatAge, type EnteredAge } from '../lib/age.ts';
import { activityFitsAge } from '../lib/eligibility.ts';
import { toDays } from '../lib/age.ts';
import { isBusyNearbyCompatible } from '../lib/supervision.ts';
import { ABILITY_LABEL, activityAges, adultText, attentionNote, durationText, EFFORT_LABEL, EVIDENCE_LABEL, recipeAges } from '../lib/labels.ts';
import { ClaimBlock, EvidenceDetails } from './Evidence.tsx';
import { activityHref, childName } from './IdeaCards.tsx';
import { TummyTimeGuide } from './TummyTimeGuide.tsx';
import { recipeAssignment } from '../lib/eligibility.ts';

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="quiet-button back" onClick={onBack}>
      ← Back
    </button>
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
        A show can buy you a few minutes. It isn’t the same as playing together, and you still need to keep watch. Watching with your child and talking about it afterward adds back some of the connection.
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

export function ActivityDetail({
  c,
  a,
  childAge,
  onBack,
  onAdd,
}: {
  c: IndexedCatalog;
  a: Activity;
  childAge?: EnteredAge;
  onBack: () => void;
  onAdd?: () => void;
}) {
  const attention = attentionNote(a.supervision);
  const fits = childAge ? activityFitsAge(a, toDays(childAge)) : true;
  return (
    <article className="page detail">
      <BackLink onBack={onBack} />
      <h1>{a.title}</h1>
      <p className="lede">{a.summary}</p>
      {a.retired && <p className="banner">This activity has been retired from Trunk: {a.retired.reason}</p>}
      {childAge && !fits && !a.retired && (
        <p className="banner">This one is meant for {activityAges(a)}, not {formatAge(childAge)}.</p>
      )}
      <dl className="meta-grid">
        <div>
          <dt>Time (estimate)</dt>
          <dd>{durationText(a.duration)}</dd>
        </div>
        <div>
          <dt>Setup / tidy</dt>
          <dd>
            {a.setupMinutes} min / {a.cleanupMinutes} min
          </dd>
        </div>
        <div>
          <dt>You</dt>
          <dd>
            {adultText(a.supervision)}
            {attention ? ` · ${attention}` : ''}
          </dd>
        </div>
        <div>
          <dt>Your energy</dt>
          <dd>{EFFORT_LABEL[a.effort]}</dd>
        </div>
      </dl>

      <section aria-labelledby="setup-h">
        <h2 id="setup-h">Setup</h2>
        <p style={{ margin: 0 }}>
          {a.materials.items.length ? a.materials.items.join(' · ') : 'Nothing needed.'}
          <br />
          <span className="subtle">{a.supervision.space}</span>
        </p>
      </section>

      <section aria-labelledby="steps-h">
        <h2 id="steps-h">Steps</h2>
        <ol className="steps">
          {a.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="stop-h">
        <h2 id="stop-h">Stop or switch when</h2>
        <ul className="bullets">
          {a.stopCues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="safety-box" aria-labelledby="safety-h">
        <h2 id="safety-h">Safety</h2>
        <ul>
          {a.safety.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
        </ul>
      </section>

      {onAdd && (
        <div className="button-row" style={{ marginTop: 14 }}>
          <button type="button" onClick={onAdd}>
            Add to my plan
          </button>
        </div>
      )}

      <section aria-labelledby="adapt-h">
        <h2 id="adapt-h">Adjust it</h2>
        <ul className="bullets">
          {a.adaptations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      {a.why && (
        <section aria-labelledby="why-h">
          <h2 id="why-h">Why it can help</h2>
          <p>{a.why.text}</p>
        </section>
      )}

      {a.tummyTime && <TummyTimeGuide c={c} position={a.tummyTime.position} flatSurface={a.tummyTime.flatSurface} />}
      {a.kind === 'media' && <MediaNote c={c} a={a} childAge={childAge} />}

      <section aria-labelledby="ready-h">
        <h2 id="ready-h">Who it’s for</h2>
        <p style={{ marginBottom: 4 }}>
          {activityAges(a)}
          {a.readiness.abilities.length ? `, once your child ${a.readiness.abilities.map((x) => ABILITY_LABEL[x]).join(' and ')}` : ''}.
        </p>
        {a.readiness.notes.map((n) => (
          <p key={n} className="subtle" style={{ marginBottom: 4 }}>
            {n}
          </p>
        ))}
        <p className="tiny">
          {EVIDENCE_LABEL[a.evidence.type].short}. Age is a starting point, not a deadline or a guarantee.
        </p>
      </section>

      <EvidenceDetails claims={() => activityClaims(c, a)} c={c} evidenceType={a.evidence.type} checked={a.checked} />
    </article>
  );
}

export function RecipeDetail({
  c,
  r,
  ages,
  onBack,
  onAdd,
}: {
  c: IndexedCatalog;
  r: MixedAgeRecipe;
  ages: EnteredAge[];
  onBack: () => void;
  onAdd?: () => void;
}) {
  const youngerAct = c.activityById.get(r.younger.activity);
  const olderAct = c.activityById.get(r.older.activity);
  const assignment =
    ages.length === 2
      ? recipeAssignment(r, { days: toDays(ages[0]), notYet: [] }, { days: toDays(ages[1]), notYet: [] })
      : null;
  const youngerName = assignment === null ? 'Younger child' : `${childName(assignment)} (${formatAge(ages[assignment])})`;
  const olderName = assignment === null ? 'Older child' : `${childName(assignment === 0 ? 1 : 0)} (${formatAge(ages[assignment === 0 ? 1 : 0])})`;
  const tummy = youngerAct?.tummyTime;
  return (
    <article className="page detail">
      <BackLink onBack={onBack} />
      <span className="tag blue">{r.mode === 'together' ? 'Together' : 'Side by side'}</span>
      <h1 style={{ marginTop: 6 }}>{r.title}</h1>
      <p className="lede">{r.summary}</p>
      {r.retired && <p className="banner">This pairing has been retired from Trunk: {r.retired.reason}</p>}
      {ages.length === 2 && assignment === null && <p className="banner">This pairing is meant for {recipeAges(r)}.</p>}
      <dl className="meta-grid">
        <div>
          <dt>Time (estimate)</dt>
          <dd>{durationText(r.duration)}</dd>
        </div>
        <div>
          <dt>Setup / tidy</dt>
          <dd>
            {r.setupMinutes} min / {r.cleanupMinutes} min (once)
          </dd>
        </div>
        <div>
          <dt>Adults</dt>
          <dd>{r.adult.minAdults === 1 ? 'One adult' : 'Two adults'}</dd>
        </div>
      </dl>

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
            <h3>You</h3>
            <p>{r.adult.does}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="setup-h">
        <h2 id="setup-h">Setup and space</h2>
        <p style={{ margin: 0 }}>
          {r.sharedSetup}
          <br />
          <span className="subtle">{r.space}</span>
        </p>
      </section>

      <section aria-labelledby="steps-h">
        <h2 id="steps-h">Steps</h2>
        <ol className="steps">
          {r.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="stop-h">
        <h2 id="stop-h">Stop or switch when</h2>
        <ul className="bullets">
          {r.stopCues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="safety-box" aria-labelledby="safety-h">
        <h2 id="safety-h">Safety</h2>
        <ul>
          {r.safety.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
          <li>An older child is a playmate, never the one in charge of the baby.</li>
        </ul>
      </section>

      {onAdd && (
        <div className="button-row" style={{ marginTop: 14 }}>
          <button type="button" onClick={onAdd}>
            Add to my plan
          </button>
        </div>
      )}

      {tummy && <TummyTimeGuide c={c} position={tummy.position} flatSurface={tummy.flatSurface} />}

      <section aria-labelledby="ready-h">
        <h2 id="ready-h">Who it’s for</h2>
        <p>{recipeAges(r)}.</p>
        <p className="tiny">A curated pairing: Trunk only suggests two-child activities that were checked for one adult’s supervision.</p>
      </section>

      <EvidenceDetails claims={() => recipeClaims(c, r)} c={c} checked={r.checked} />
    </article>
  );
}
