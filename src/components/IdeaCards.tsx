import type { Activity, MixedAgeRecipe } from '../content/schema.ts';
import { adultText, attentionNote, durationText, materialsLine } from '../lib/labels.ts';
import { formatAgeShort, type EnteredAge } from '../lib/age.ts';
import type { TimingAssessment } from '../lib/timing.ts';
import { CueLine } from './Cues.tsx';

export function activityHref(id: string) {
  return `#/a/${id}`;
}

export function recipeHref(id: string) {
  return `#/r/${id}`;
}

function Tags({ a }: { a: Activity }) {
  const tags: { text: string; sky?: boolean }[] = [];
  if (a.tummyTime) tags.push({ text: a.tummyTime.flatSurface ? 'Tummy time · flat floor' : 'Tummy time · held/supported', sky: true });
  if (a.kind === 'media') tags.push({ text: 'Screen option' });
  if (a.outing) tags.push({ text: 'Outing' });
  if (!tags.length) return null;
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t.text} className={`tag${t.sky ? ' sky' : ''}`}>
          {t.text}
        </span>
      ))}
    </span>
  );
}

export function ActivityCard({ a, timing }: { a: Activity; timing?: TimingAssessment }) {
  const attention = attentionNote(a.supervision);
  return (
    <li className="idea">
      <a className="idea-link" href={activityHref(a.id)}>
        <p className="idea-title">{a.title}</p>
        <Tags a={a} />
        <p className="idea-summary">{a.summary}</p>
        <ul className="facts">
          <li>
            <span className="k">Time</span>
            <span>{durationText(a.duration)} (estimate)</span>
          </li>
          <li>
            <span className="k">Need</span>
            <span>{materialsLine(a)}</span>
          </li>
          <li>
            <span className="k">You</span>
            <span>
              {adultText(a.supervision)}
              {attention ? ` · ${attention}` : ''}
            </span>
          </li>
        </ul>
        <CueLine cue={timing?.cue ?? null} />
        <p className="safety-line">{a.safety[0].text}</p>
      </a>
    </li>
  );
}

export function childName(index: number) {
  return `Child ${index + 1}`;
}

export function RecipeCard({ r, younger, ages, timing }: { r: MixedAgeRecipe; younger: 0 | 1; ages: EnteredAge[]; timing?: TimingAssessment }) {
  const older = younger === 0 ? 1 : 0;
  return (
    <li className="idea">
      <a className="idea-link" href={recipeHref(r.id)}>
        <p className="idea-title">{r.title}</p>
        <span className="tags">
          <span className="tag sky">{r.mode === 'together' ? 'Together' : 'Side by side'}</span>
        </span>
        <p className="idea-summary">
          {r.summary}
        </p>
        <ul className="facts">
          <li>
            <span className="k">
              {childName(younger)} ({formatAgeShort(ages[younger])})
            </span>
            <span>{r.younger.does}</span>
          </li>
          <li>
            <span className="k">
              {childName(older)} ({formatAgeShort(ages[older])})
            </span>
            <span>{r.older.does}</span>
          </li>
          <li>
            <span className="k">You</span>
            <span>{r.adult.does}</span>
          </li>
          <li>
            <span className="k">Time</span>
            <span>
              {durationText(r.duration)} (estimate){r.setupMinutes ? ` · ${r.setupMinutes} min setup` : ''}
            </span>
          </li>
        </ul>
        <CueLine cue={timing?.cue ?? null} prefix={timing?.cue ? childName(timing.cue.finding.child) : undefined} />
        <p className="safety-line">{r.safety[0].text}</p>
      </a>
    </li>
  );
}
