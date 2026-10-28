import type { Claim, Source } from '../content/schema.ts';
import { useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import { EVIDENCE_LABEL } from '../lib/labels.ts';

const KIND_LABEL: Record<Claim['kind'], string> = {
  recommendation: 'Recommendation',
  description: 'Description',
  safety: 'Safety',
};

export function SourceLine({ s }: { s: Source }) {
  const date = s.updated ? `updated ${s.updated}` : s.published ? `published ${s.published}` : 'date not shown';
  return (
    <li>
      <a href={s.url} target="_blank" rel="noopener noreferrer">
        {s.title}
      </a>{' '}
      <span className="tiny">
        — {s.org} ({s.jurisdiction}; {date}; checked {s.checked})
      </span>
    </li>
  );
}

export function ClaimBlock({ claim, c }: { claim: Claim; c: IndexedCatalog }) {
  return (
    <div className="claim">
      <p>
        <span className="tag">{KIND_LABEL[claim.kind]}</span> {claim.text}
      </p>
      <p className="tiny">
        Scope: {claim.scope}
        {claim.caveat ? ` Caveat: ${claim.caveat}` : ''}
      </p>
      <p className="tiny">Where: {claim.locator}</p>
      <p className="tiny">Source passage, paraphrased: {claim.paraphrase}</p>
      <ul className="bullets tiny">
        {claim.sources.map((id) => {
          const s = c.sourceById.get(id);
          return s ? <SourceLine key={id} s={s} /> : null;
        })}
      </ul>
    </div>
  );
}

export function EvidenceDetails({
  claims: getClaims,
  c,
  evidenceType,
  checked,
}: {
  claims: () => Claim[];
  c: IndexedCatalog;
  evidenceType?: keyof typeof EVIDENCE_LABEL;
  checked: string;
}) {
  const ready = useEvidence(c);
  const claims = ready ? getClaims() : [];
  return (
    <details className="sources">
      <summary>Sources and evidence{ready ? ` (${claims.length})` : ''}</summary>
      {!ready && <p role="status">Loading sources…</p>}
      {evidenceType && (
        <p>
          <strong>{EVIDENCE_LABEL[evidenceType].short}.</strong> {EVIDENCE_LABEL[evidenceType].long}
        </p>
      )}
      <p className="tiny">
        Sources checked {checked}. Times, setup, and effort are Trunk’s estimates, not recommendations. Trunk’s ideas have not been individually reviewed by a clinician.
      </p>
      {claims.map((claim) => (
        <ClaimBlock key={claim.id} claim={claim} c={c} />
      ))}
    </details>
  );
}
