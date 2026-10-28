import { sourceCount, useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import { SourceLine } from './Evidence.tsx';
import { TummyTimeGuide } from './TummyTimeGuide.tsx';
import { Mascot } from './Mascot.tsx';

export function AboutView({ c, version }: { c: IndexedCatalog; version: string }) {
  const ready = useEvidence(c);
  const live = c.activities.filter((a) => !a.retired);
  const byOrg = new Map<string, typeof c.sources>();
  for (const s of [...c.sources].sort((a, b) => a.org.localeCompare(b.org) || a.title.localeCompare(b.title))) {
    byOrg.set(s.org, [...(byOrg.get(s.org) ?? []), s]);
  }
  return (
    <article className="page detail">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Mascot size={56} />
        <div>
          <h1 style={{ margin: 0 }}>About Trunk</h1>
          <p className="subtle" style={{ margin: 0 }}>
            A little help for the next hour.
          </p>
        </div>
      </div>

      <section>
        <p>
          Trunk helps parents of children from 1 week to 4 years find something realistic to do next: play, a walk, a calm moment, an everyday routine, or a plan for a stretch of the day with one or two children.
        </p>
        <p>
          It holds {live.length} activities, {c.recipes.filter((r) => !r.retired).length} curated two-child pairings, and {sourceCount} sources (last checked {version}).
        </p>
      </section>

      <section aria-labelledby="trust-h">
        <h2 id="trust-h">How the ideas are made</h2>
        <ul className="bullets">
          <li>
            Activities are <strong>source-informed</strong>: written in Trunk’s own words from public guidance (mostly US, labelled when another country’s guidance is used). They have <strong>not been individually reviewed by a clinician</strong>.
          </li>
          <li>Each activity says whether a source describes it directly, whether it is Trunk’s adaptation of source-informed principles, or whether it is simply a practical routine.</li>
          <li>Times, setup, and effort are estimates. Your child’s cues matter more than any number here.</li>
          <li>Developmental value, how much energy you need, and how closely you need to supervise are listed separately. “Easy for you” never means “no supervision”.</li>
          <li>Two-child ideas come only from curated pairings that were checked for one adult’s supervision. Trunk never assumes two activities fit together just because the ages overlap.</li>
          <li>Age is a starting point, not a deadline. Trunk doesn’t score, track, or compare children. Ask your child’s clinician about prematurity (corrected age), medical needs, or development questions.</li>
        </ul>
      </section>

      <TummyTimeGuide c={c} />

      <section aria-labelledby="screens-h">
        <h2 id="screens-h">Screens</h2>
        <p>
          Trunk only offers a screen option for children 2 and older, and only when you say you’re busy nearby or low on energy. Each screen option includes the guidance it is based on and a no-screen alternative. Watching alone isn’t treated as equal to playing together, and it doesn’t replace supervision.
        </p>
      </section>

      <section aria-labelledby="privacy-h">
        <h2 id="privacy-h">Privacy, saving, and sharing</h2>
        <ul className="bullets">
          <li>No accounts, analytics, trackers, or ads. Nothing you enter is sent to a server.</li>
          <li>Up to 10 plans are saved in this browser only. Clearing site data removes them, and they don’t sync between devices.</li>
          <li>Share links carry the plan inside the link. Anyone with the link can read it; it isn’t encrypted. Names of plans, your own entries, and notes are left out unless you choose to include them.</li>
          <li>Images you save are created on your device.</li>
        </ul>
      </section>

      <section aria-labelledby="sources-h">
        <h2 id="sources-h">All sources</h2>
        <p className="tiny">Each source was opened and read on the date shown. Guidance changes; Trunk’s content is meant to be rechecked every 6–12 months.</p>
        {!ready && <p role="status">Loading sources…</p>}
        {[...byOrg.entries()].map(([org, list]) => (
          <div key={org} style={{ marginBottom: 10 }}>
            <h3>{org}</h3>
            <ul className="bullets">
              {list.map((s) => (
                <SourceLine key={s.id} s={s} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="tiny">
        Trunk is a working name. Content version {version}. Not medical advice: in an emergency, call your local emergency number.
      </p>
    </article>
  );
}
