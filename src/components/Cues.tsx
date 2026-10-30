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

const EVENT_PHRASE: Record<RoutineEvent, string> = { 'milk-feed': 'a feed', meal: 'eating', nap: 'a nap' };
const FIT_RANK: Record<TimingRule['fit'], number> = { avoid: 0, later: 1, preferred: 2, neutral: 3 };

type Labelled = { label?: string; rule: TimingRule };

function RuleItem({ c, item, now }: { c: IndexedCatalog; item: Labelled; now?: boolean }) {
  const r = item.rule;
  return (
    <details className={`cue cue-${FIT_TONE[r.fit]}`}>
      <summary>
        {item.label ? `${item.label}: ` : ''}
        {r.cue}
        {now ? <span className="now-tag">Applies now</span> : null}
      </summary>
      <RuleBody rule={r} c={c} />
    </details>
  );
}

/**
 * Timing on a detail page, kept short:
 * - rules that apply right now (from "Just fed" / "Nap soon"), one line each;
 * - one concise line for the most important remaining rule ("Best not right
 *   before or after a feed"), with its reasons on demand;
 * - everything else in one "Timing notes (n)" disclosure.
 * Callers pass only rules that fit the shown child's age. When no single child
 * is known, every rule stays inside the disclosure.
 */
export function TimingSection({ c, groups, now, knownChild }: { c: IndexedCatalog; groups: { label?: string; rules: TimingRule[] }[]; now?: ReadonlySet<string>; knownChild: boolean }) {
  const all: Labelled[] = groups.flatMap((g) => g.rules.filter((r) => r.fit !== 'neutral').map((rule) => ({ label: g.label, rule })));
  if (!all.length) return null;
  const nowItems = knownChild ? all.filter((x) => now?.has(x.rule.id)) : [];
  const rest = all.filter((x) => !nowItems.includes(x));
  let headline: { text: string; items: Labelled[] } | null = null;
  if (knownChild) {
    const ranked = rest.filter((x) => !x.rule.condition).sort((a, b) => FIT_RANK[a.rule.fit] - FIT_RANK[b.rule.fit]);
    const top = ranked[0];
    if (top) {
      const same = rest.filter((x) => x.label === top.label && !x.rule.condition && x.rule.event === top.rule.event && x.rule.fit === top.rule.fit);
      const both = top.rule.fit !== 'preferred' && same.some((x) => x.rule.when === 'before') && same.some((x) => x.rule.when === 'after');
      const text = both ? `Best not right before or after ${EVENT_PHRASE[top.rule.event]}` : top.rule.cue;
      headline = { text: `${top.label ? `${top.label}: ` : ''}${text}`, items: both ? same : [top] };
    }
  }
  const notes = rest.filter((x) => !headline?.items.includes(x));
  return (
    <section aria-labelledby="timing-h" className="timing">
      <h2 id="timing-h">Timing</h2>
      <ul className="cue-list">
        {nowItems.map((x) => (
          <li key={`now-${x.label ?? ''}${x.rule.id}`}>
            <RuleItem c={c} item={x} now />
          </li>
        ))}
        {headline && (
          <li>
            <details className={`cue cue-${FIT_TONE[headline.items[0].rule.fit]}`}>
              <summary>{headline.text}</summary>
              {headline.items.map((x) => (
                <RuleBody key={x.rule.id} rule={x.rule} c={c} />
              ))}
            </details>
          </li>
        )}
      </ul>
      {notes.length > 0 && (
        <details className="more timing-notes">
          <summary>{knownChild ? `Timing notes (${notes.length})` : `Timing notes (${notes.length}), by age`}</summary>
          <ul className="cue-list">
            {notes.map((x) => (
              <li key={`${x.label ?? ''}${x.rule.id}`}>
                <RuleItem c={c} item={x} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
