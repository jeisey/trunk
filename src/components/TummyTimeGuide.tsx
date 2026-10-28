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

/**
 * Tummy-time amounts differ by source, population, age, and which positions
 * count. This keeps them separate and never merges them into one rule.
 */
export function TummyTimeGuide({ c, position, flatSurface }: { c: IndexedCatalog; position?: TummyPosition; flatSurface?: boolean }) {
  const ready = useEvidence(c);
  const claims = ready ? TARGET_CLAIMS.map((id) => c.claimById.get(id)).filter((x) => x !== undefined) : [];
  return (
    <section className="note-box" aria-labelledby="tummy-guide">
      <h2 id="tummy-guide">Tummy time: position and targets</h2>
      {position && (
        <p>
          <strong>This position:</strong> {TUMMY_POSITION_LABEL[position]}.{' '}
          {flatSurface
            ? 'This is floor tummy time on a firm, flat surface.'
            : 'It is useful tummy time, but it is not on a flat surface. Trunk does not count it toward a flat-surface target.'}
        </p>
      )}
      <p>
        <strong>If your baby’s clinicians gave you a target, follow it.</strong> Some care teams set a daily amount and say which positions count. For example, one family reports that their CHOP neonatal team asked for 60 minutes a day on a flat surface for their 4-month-old, not counting held or elevated positions. That is individualized guidance for that baby, not a public CHOP standard, and not a rule for every baby.
      </p>
      <details className="more">
        <summary>What different public guidance says</summary>
        <p className="tiny">
          These come from different organizations, countries, and populations. They are listed separately on purpose; Trunk doesn’t blend them into one rule.
        </p>
        {!ready && <p role="status">Loading sources…</p>}
        {claims.map((claim) => (
          <ClaimBlock key={claim.id} claim={claim} c={c} />
        ))}
      </details>
    </section>
  );
}
