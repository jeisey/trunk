import type { IndexedCatalog } from '../content/catalog.ts';
import { useEvidence } from '../content/catalog.ts';
import type { RoutineEvent, TimingRule } from '../content/schema.ts';
import type { TimingCue, TimingFinding } from '../lib/timing.ts';
import { ClaimBlock } from './Evidence.tsx';

const EVENT_WORD: Record<RoutineEvent, string> = {
  'milk-feed': 'a milk feed',
  meal: 'a meal or snack',
  nap: 'a nap',
};

type RuleLike = Pick<TimingRule, 'event' | 'when' | 'basis' | 'reason'> & { claims: readonly string[]; window: { minutes: number; basis: 'source' | 'editorial' }; condition?: string };

function fromFinding(f: TimingFinding): RuleLike {
  return { event: f.event, when: f.when, basis: f.basis, reason: f.reason, claims: f.claims, window: { minutes: f.windowMinutes, basis: f.windowBasis }, condition: f.advisory ? 'advisory' : undefined };
}

/** "Within 30 min after a milk feed · Trunk’s planning convention for the minutes" */
function windowText(r: RuleLike): string {
  const span = `${r.window.minutes} min ${r.when === 'after' ? 'after' : 'before'} ${EVENT_WORD[r.event]}`;
  const guidance = r.basis === 'source' ? 'The advice comes from a source' : 'This is Trunk’s planning preference';
  const minutes = r.window.basis === 'source' ? 'the source gives the minutes' : 'the minutes are Trunk’s convention';
  return `Applies within ${span}. ${guidance}; ${minutes}.`;
}

function RuleBody({ rule, c }: { rule: RuleLike; c: IndexedCatalog }) {
  const ready = useEvidence(c);
  const claims = ready ? rule.claims.map((id) => c.claimById.get(id)).filter((x) => x !== undefined) : [];
  return (
    <div className="cue-body">
      <p>{rule.reason}</p>
      <p className="tiny">{windowText(rule)}</p>
      {rule.condition && <p className="tiny">Advice for some children only. Trunk never uses it to leave an idea out.</p>}
      {rule.claims.length > 0 && !ready && <p role="status" className="tiny">Loading sources…</p>}
      {claims.map((claim) => (
        <ClaimBlock key={claim.id} claim={claim} c={c} />
      ))}
    </div>
  );
}

/** One concise timing cue on a card (no disclosure: cards are links). */
export function CueLine({ cue, prefix }: { cue: TimingCue | null; prefix?: string }) {
  if (!cue) return null;
  return (
    <p className={`cue-line cue-${cue.tone}`}>
      {prefix ? `${prefix}: ` : ''}
      {cue.text}
    </p>
  );
}

/** A cue with its reason and sources behind a disclosure (plan rows, detail pages). */
export function CueDetails({ cue, c, prefix }: { cue: TimingCue | null; c: IndexedCatalog; prefix?: string }) {
  if (!cue) return null;
  return (
    <details className={`cue cue-${cue.tone}`}>
      <summary>
        {prefix ? `${prefix}: ` : ''}
        {cue.text}
      </summary>
      <RuleBody rule={fromFinding(cue.finding)} c={c} />
    </details>
  );
}

const FIT_TONE: Record<TimingRule['fit'], 'good' | 'caution' | 'neutral'> = { preferred: 'good', neutral: 'neutral', later: 'caution', avoid: 'caution' };

/**
 * The timing rules an activity carries (its own plus the policy rules for its
 * stimulation profile), each with its reason and sources on demand. `now` marks
 * rules that apply at this moment (from the finder's "Just fed" / "Nap soon").
 */
export function TimingRules({ c, groups, now }: { c: IndexedCatalog; groups: { label?: string; rules: TimingRule[] }[]; now?: ReadonlySet<string> }) {
  const visible = groups.map((g) => ({ ...g, rules: g.rules.filter((r) => r.fit !== 'neutral') })).filter((g) => g.rules.length);
  if (!visible.length) return null;
  return (
    <section aria-labelledby="timing-h">
      <h2 id="timing-h">Timing</h2>
      <ul className="cue-list">
        {visible.flatMap((g) =>
          g.rules.map((r) => (
            <li key={`${g.label ?? ''}${r.id}`}>
              <details className={`cue cue-${FIT_TONE[r.fit]}`}>
                <summary>
                  {g.label ? `${g.label}: ` : ''}
                  {r.cue}
                  {now?.has(r.id) ? <span className="now-tag">Applies now</span> : null}
                </summary>
                <RuleBody rule={r} c={c} />
              </details>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
