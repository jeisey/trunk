import { sourceCount, useEvidence, type IndexedCatalog } from '../content/catalog.ts';
import { MAX_PLANS } from '../lib/storage.ts';
import { SourceLine } from './Evidence.tsx';
import { TummyTimeGuide } from './TummyTimeGuide.tsx';

/**
 * The one place for Trunk's general limitations: clinical-review status, medical
 * and developmental caveats, how timing cues work, the evidence method, and how
 * saving works. Activity, plan, and share screens keep only specific, functional
 * instructions and link here from the header.
 */
export function AboutView({ c, version }: { c: IndexedCatalog; version: string }) {
  const ready = useEvidence(c);
  const live = c.activities.filter((a) => !a.retired);
  const byOrg = new Map<string, typeof c.sources>();
  for (const s of [...c.sources].sort((a, b) => a.org.localeCompare(b.org) || a.title.localeCompare(b.title))) {
    byOrg.set(s.org, [...(byOrg.get(s.org) ?? []), s]);
  }
  return (
    <article className="page detail about">
      <h1>About Trunk</h1>
      <p className="lede">
        Trunk helps parents of children from 1 week old up to their fifth birthday find something realistic to do next, and plan the next hour or two with one or two children.
      </p>
      <p>
        It holds {live.length} activities, {c.recipes.filter((r) => !r.retired).length} curated two-child pairings, and {sourceCount} sources (content version {version}).
      </p>

      <section aria-labelledby="trust-h">
        <h2 id="trust-h">How the ideas are made</h2>
        <ul className="bullets">
          <li>
            Activities are <strong>source-informed</strong>: written in Trunk’s own words from public guidance (mostly US, labelled when another country’s guidance is used). They have <strong>not been individually reviewed by a clinician</strong>.
          </li>
          <li>Each activity’s sources say whether a source describes it directly, whether it is Trunk’s adaptation of source-informed principles, or whether it is simply a practical routine.</li>
          <li>Times, setup, and effort are Trunk’s estimates, not recommendations.</li>
          <li>Developmental value, how much energy you need, and how closely you need to supervise are listed separately. “Easy for you” never means “no supervision”.</li>
          <li>Two-child ideas come only from curated pairings checked for one adult’s supervision. Trunk never assumes two activities fit together just because the ages overlap.</li>
        </ul>
      </section>

      <section aria-labelledby="medical-h">
        <h2 id="medical-h">Age, development, and medical needs</h2>
        <ul className="bullets">
          <li>Age is a starting point, not a deadline or a guarantee. Follow your child’s cues; Trunk doesn’t score, track, or compare children.</li>
          <li>Born early? Many clinicians use corrected age (counted from the due date) for development questions. Ask yours which to use.</li>
          <li>Ask your child’s clinician about prematurity, reflux, medical needs, or development questions. Trunk isn’t medical advice; in an emergency, call your local emergency number.</li>
        </ul>
      </section>

      <section aria-labelledby="timing-h">
        <h2 id="timing-h">How timing cues work</h2>
        <ul className="bullets">
          <li>“Just fed” and “Nap soon” on Find apply only while the page is open. They’re never saved, shared, or added to a plan.</li>
          <li>Naps, feeds, meals, and snacks in a plan are your own estimates. Trunk never suggests how long a nap should be, how often to feed, or when a child should sleep, and a plan is not a feeding, sleep, or wake schedule.</li>
          <li>
            Some cues come from a source, such as advice about tummy time and feeds. The number of minutes behind “right after” or “right before” is often Trunk’s own planning convention; each cue says which when you open it.
          </li>
          <li>A cue is a planning suggestion, not a medical rule. Trunk ranks an idea lower or leaves it out of automatic suggestions; you can still choose it.</li>
          <li>Plan times are estimates. Stop or change a plan whenever your child needs to.</li>
        </ul>
      </section>

      <TummyTimeGuide c={c} variant="about" />

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
          <li>
            Up to {MAX_PLANS} plans are saved in this browser on this device only. Clearing site data or using private browsing can remove them, and they don’t sync between devices. Use a share link, plan file, or image to move a plan elsewhere.
          </li>
          <li>Share links carry the plan inside the link. Anyone with the link can read it; it isn’t encrypted. Plan names, your own entries, and notes are left out unless you choose to include them.</li>
          <li>Images you save are created on your device.</li>
        </ul>
      </section>

      <section aria-labelledby="sources-h">
        <h2 id="sources-h">All sources</h2>
        <p className="tiny">Each source was opened and read on the date shown (a few, where the site blocked downloads, through a summarizing tool; their notes say so). Guidance changes; Trunk’s content is meant to be rechecked every 6–12 months.</p>
        {!ready && <p role="status">Loading sources…</p>}
        {[...byOrg.entries()].map(([org, list]) => (
          <div key={org} className="source-org">
            <h3>{org}</h3>
            <ul className="bullets">
              {list.map((s) => (
                <SourceLine key={s.id} s={s} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="tiny">Trunk is a working name. Content version {version}.</p>
    </article>
  );
}
