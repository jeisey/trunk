import { useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import type { TummyPosition } from '../content/schema.ts';
import { TUMMY_POSITION_LABEL } from '../lib/labels.ts';
import { ClaimBlock } from './Evidence.tsx';

const TARGET_CLAIMS = [
  'clm.core.aap-tummy-amount',
  'clm.core.who-30-prone',
  'clm.core.hse-30-then-60-flat',
  'clm.core.cw-60-by-4-months',
  'clm.core.sickkids-50-60-floor',
];

/** Public guidance on amounts, kept separate: different organizations, populations, and positions. */
function GuidanceList({ c }: { c: IndexedCatalog }) {
  const ready = useEvidence(c);
  const claims = ready ? TARGET_CLAIMS.map((id) => c.claimById.get(id)).filter((x) => x !== undefined) : [];
  return (
    <details className="more">
      <summary>What different public guidance says about amounts</summary>
      <p className="tiny">Listed separately on purpose: they come from different organizations, countries, and populations, and Trunk doesn’t blend them into one rule.</p>
      {!ready && <p role="status">Loading sources…</p>}
      {claims.map((claim) => (
        <ClaimBlock key={claim.id} claim={claim} c={c} />
      ))}
    </details>
  );
}

/**
 * Tummy time on an activity: which kind of position this is (floor/flat surface
 * versus held or supported), with the sourced amounts behind a disclosure. Held
 * or supported time is never credited to a flat-surface target. On About: the
 * same distinction plus the general note about individual clinician targets.
 */
export function TummyTimeGuide({ c, position, flatSurface, variant = 'activity' }: { c: IndexedCatalog; position?: TummyPosition; flatSurface?: boolean; variant?: 'activity' | 'about' }) {
  if (variant === 'about') {
    return (
      <section aria-labelledby="tummy-guide">
        <h2 id="tummy-guide">Tummy time</h2>
        <p>
          Trunk separates floor tummy time on a firm, flat surface from held or supported positions (on your chest, across your lap, carried, or propped). Held and supported time is useful, but Trunk never counts it toward a flat-surface amount, and a plan’s tummy-time total keeps the two apart.
        </p>
        <p>If a clinician has given your baby an individual target, such as which positions count and how much, follow it. It applies to your baby; Trunk doesn’t generalize it to other babies or override it.</p>
        <GuidanceList c={c} />
      </section>
    );
  }
  return (
    <section className="note-box" aria-labelledby="tummy-guide">
      <h2 id="tummy-guide">Tummy time position</h2>
      {position && (
        <p>
          <strong>{TUMMY_POSITION_LABEL[position]}.</strong>{' '}
          {flatSurface ? 'Floor tummy time.' : 'Held or supported tummy time: useful, but not on a flat surface, so Trunk never counts it toward a flat-surface amount.'}
        </p>
      )}
      <GuidanceList c={c} />
    </section>
  );
}
