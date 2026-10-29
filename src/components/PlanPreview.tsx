import type { IndexedCatalog } from '../content/catalog.ts';
import { childLabel, type EntryAnalysis, type Gap, type PlanAnalysis } from '../lib/layout.ts';
import type { Plan } from '../lib/plan.ts';
import { TIME_ISSUE_TEXT } from '../lib/timeRules.ts';
import { formatMinutes } from '../lib/time.ts';
import { CueDetails } from './Cues.tsx';
import { activityHref, recipeHref } from './IdeaCards.tsx';
import { childGapText, clockAt, entryRoles, entryTitle, planRows, whoText } from './planDisplay.ts';

/** A read-only view of a plan (shared links, plan files): the same rows, roles, cues, and conflicts as the editor. */
export function PlanPreview({ plan, analysis, c }: { plan: Plan; analysis: PlanAnalysis; c: IndexedCatalog }) {
  const entry = (e: EntryAnalysis) => {
    const seg = e.item.segment;
    const title = entryTitle(seg, c);
    const who = whoText(seg, plan.kids.length);
    const recipe = seg.kind === 'recipe' ? c.recipeById.get(seg.ref ?? '') : undefined;
    const href = seg.kind === 'activity' && !e.item.missing ? activityHref(seg.ref ?? '') : recipe ? recipeHref(recipe.id) : null;
    const roles = entryRoles(plan, c, e);
    return (
      <li key={seg.id} className={`seg seg-${seg.kind}${seg.along ? ' along' : ''}`}>
        <div className="seg-time">
          <span>
            {clockAt(plan, e.item.start)}–{clockAt(plan, e.item.end)}
          </span>
          <span className="seg-len">{seg.minutes} min</span>
        </div>
        <p className="seg-title">
          {href ? <a href={href}>{title}</a> : <span>{title}</span>}
          {who && !seg.along && <span className="who-chip">{who}</span>}
          {recipe && <span className="tag sky">{recipe.mode === 'together' ? 'Together' : 'Side by side'}</span>}
          {seg.kind === 'custom' && <span className="tag">Their entry</span>}
          {seg.kind === 'routine' && <span className="tag">Estimate</span>}
        </p>
        {roles.length > 0 && (
          <ul className="tracks">
            {roles.map((r) => (
              <li key={r.who}>
                <span className="who">{r.who}:</span> {r.text}
              </li>
            ))}
          </ul>
        )}
        {e.timing.cue && <CueDetails cue={e.timing.cue} c={c} prefix={plan.kids.length === 2 && seg.kind === 'recipe' ? childLabel(e.timing.cue.finding.child === 1 ? 1 : 0) : undefined} />}
        {e.timeIssue && <p className="safety-line">{TIME_ISSUE_TEXT[e.timeIssue]}</p>}
        {e.conflicts
          .filter((cf) => cf.kind !== 'timing')
          .map((cf, k) => (
            <p key={k} className={`conflict ${cf.severity}`}>
              {cf.message}
            </p>
          ))}
      </li>
    );
  };
  const gap = (g: Gap, key: string) =>
    g.who === 'all' ? (
      <li key={key} className="seg open">
        <div className="seg-time">
          <span>
            {clockAt(plan, g.start)}–{clockAt(plan, g.end)}
          </span>
        </div>
        <p className="seg-title">Open time · {formatMinutes(g.end - g.start)}</p>
      </li>
    ) : (
      <li key={key} className={`seg gap-child adult-${g.adult ?? 'busy'}`}>
        <div className="seg-time">
          <span>
            {clockAt(plan, g.start)}–{clockAt(plan, g.end)}
          </span>
        </div>
        <p className="gap-text">{childGapText(g, plan)}</p>
      </li>
    );
  return (
    <ol className="timeline" aria-label="Plan timeline">
      {planRows(plan, analysis).map((row) => {
        if (row.kind === 'entry') return entry(row.entry);
        if (row.kind === 'gap') return gap(row.gap, `gap-${row.gap.who}-${row.gap.start}`);
        return (
          <li key={`track-${row.host.item.segment.id}`} className="along-track">
            <p className="track-head">
              While {childLabel(row.hostLane)} {row.verb} · {childLabel(row.otherLane)}:
            </p>
            <ol className="timeline nested">{row.items.map((t) => (t.kind === 'entry' ? entry(t.entry) : gap(t.gap, `cg-${t.gap.start}`)))}</ol>
          </li>
        );
      })}
      {analysis.overrun > 0 && (
        <li className="seg overrun">
          <p className="seg-title">Runs {formatMinutes(analysis.overrun)} past the window</p>
        </li>
      )}
    </ol>
  );
}
