import { useRef, useState } from 'react';
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAgeShort } from '../lib/age.ts';
import { durationText, adultText } from '../lib/labels.ts';
import { alternativesFor } from '../lib/planner.ts';
import { BREAK_HINT, BREAK_LABEL, bounds, MAX_SEGMENTS, newId, resize, youngerFor, type Plan, type PlanSegment } from '../lib/plan.ts';
import { timeline, type TimedSegment } from '../lib/layout.ts';
import { activityProfile, recipeProfile, TIME_ISSUE_TEXT, timeIssue, type TimeIssue } from '../lib/timeRules.ts';
import { toDays } from '../lib/age.ts';
import { cleanText, LIMITS } from '../lib/text.ts';
import { formatClock, formatMinutes, parseHHMM } from '../lib/time.ts';
import { activityHref, childName, recipeHref } from './IdeaCards.tsx';

export function segmentTitle(seg: PlanSegment, c: IndexedCatalog): string {
  if (seg.kind === 'activity') return c.activityById.get(seg.ref ?? '')?.title ?? 'Unavailable activity';
  if (seg.kind === 'recipe') return c.recipeById.get(seg.ref ?? '')?.title ?? 'Unavailable pairing';
  if (seg.kind === 'break') return seg.label || BREAK_LABEL;
  return seg.label || 'Your own activity';
}

/** Floor (flat-surface) vs. held/supported tummy-time minutes in a plan, never merged. */
export function tummyTally(plan: Plan, c: IndexedCatalog): { flat: number; supported: number } {
  let flat = 0;
  let supported = 0;
  for (const seg of plan.segments) {
    const act =
      seg.kind === 'activity'
        ? c.activityById.get(seg.ref ?? '')
        : seg.kind === 'recipe'
          ? c.activityById.get(c.recipeById.get(seg.ref ?? '')?.younger.activity ?? '')
          : undefined;
    if (!act?.tummyTime) continue;
    if (act.tummyTime.flatSurface) flat += seg.minutes;
    else supported += seg.minutes;
  }
  return { flat, supported };
}

export function Tracks({ seg, plan, c }: { seg: PlanSegment; plan: Plan; c: IndexedCatalog }) {
  const ages = plan.kids.map((k) => formatAgeShort(k.age));
  if (seg.kind === 'activity') {
    const a = c.activityById.get(seg.ref ?? '');
    if (!a) return null;
    return (
      <ul className="tracks">
        <li>
          <span className="who">Child 1</span>
          <span>{a.summary}</span>
        </li>
        <li>
          <span className="who">You</span>
          <span>{adultText(a.supervision)}</span>
        </li>
      </ul>
    );
  }
  if (seg.kind === 'recipe') {
    const r = c.recipeById.get(seg.ref ?? '');
    if (!r) return null;
    const y = seg.younger === 'c2' ? 1 : 0;
    const o = y === 0 ? 1 : 0;
    return (
      <ul className="tracks">
        <li>
          <span className="who">
            {childName(y)} <span className="tiny">({ages[y]})</span>
          </span>
          <span>{r.younger.does}</span>
        </li>
        <li>
          <span className="who">
            {childName(o)} <span className="tiny">({ages[o]})</span>
          </span>
          <span>{r.older.does}</span>
        </li>
        <li>
          <span className="who">You</span>
          <span>{r.adult.does}</span>
        </li>
      </ul>
    );
  }
  if (seg.kind === 'break') {
    return (
      <ul className="tracks">
        <li>
          <span className="who">{plan.kids.length === 2 ? 'Everyone' : 'Child 1'}</span>
          <span>{BREAK_HINT}</span>
        </li>
      </ul>
    );
  }
  const who = seg.who === 'c1' ? 'Child 1' : seg.who === 'c2' ? 'Child 2' : plan.kids.length === 2 ? 'Both' : 'Child 1';
  return (
    <ul className="tracks">
      <li>
        <span className="who">{who}</span>
        <span>Your own entry (no sources attached)</span>
      </li>
    </ul>
  );
}

/** Time-of-day rule a segment breaks, if any (sun for babies under 6 months, outdoors at night). */
export function segmentTimeIssue(t: TimedSegment, plan: Plan, c: IndexedCatalog): TimeIssue | null {
  const seg = t.segment;
  const youngest = Math.min(...plan.kids.map((k) => toDays(k.age)));
  if (seg.kind === 'activity') {
    const a = c.activityById.get(seg.ref ?? '');
    return a ? timeIssue(activityProfile(a), t.start, t.wall, youngest, plan.settings.place) : null;
  }
  if (seg.kind === 'recipe') {
    const r = c.recipeById.get(seg.ref ?? '');
    return r ? timeIssue(recipeProfile(r, c.activityById.get(r.younger.activity)), t.start, t.wall, youngest, plan.settings.place) : null;
  }
  return null;
}

function safetyCue(seg: PlanSegment, c: IndexedCatalog): string | null {
  if (seg.kind === 'activity') return c.activityById.get(seg.ref ?? '')?.safety[0]?.text ?? null;
  if (seg.kind === 'recipe') return c.recipeById.get(seg.ref ?? '')?.safety[0]?.text ?? null;
  return null;
}

export function PlanEditor({
  plan,
  c,
  onChange,
  announce,
}: {
  plan: Plan;
  c: IndexedCatalog;
  onChange: (plan: Plan) => void;
  announce: (text: string) => void;
}) {
  const items = timeline(plan, c);
  const used = items.reduce((s, t) => s + t.wall, 0);
  const start = parseHHMM(plan.start);
  const open = plan.window - used;
  const [adding, setAdding] = useState<null | 'activity' | 'custom'>(null);
  const [customText, setCustomText] = useState('');
  const [customMinutes, setCustomMinutes] = useState(15);
  const [customWho, setCustomWho] = useState<'both' | 'c1' | 'c2'>('both');
  const swapSeed = useRef(0);
  const listRef = useRef<HTMLOListElement>(null);
  const tally = tummyTally(plan, c);

  const update = (segments: PlanSegment[]) => onChange({ ...plan, segments, updatedAt: new Date().toISOString() });

  const focusLater = (selector: string) =>
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(selector);
      el?.focus();
    });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.segments.length) return;
    const next = [...plan.segments];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
    announce(`Moved ${segmentTitle(plan.segments[i], c)} ${dir < 0 ? 'earlier' : 'later'}.`);
    focusLater(`[data-seg="${plan.segments[i].id}"] [data-move="${dir}"]`);
  };

  const remove = (i: number) => {
    const seg = plan.segments[i];
    update(plan.segments.filter((_, k) => k !== i));
    announce(`Removed ${segmentTitle(seg, c)}.`);
  };

  const sizeBy = (i: number, dir: 1 | -1) => {
    const seg = plan.segments[i];
    const next = resize(seg, dir, c);
    if (next === seg) {
      const { min, max } = bounds(seg, c);
      announce(dir > 0 ? `${segmentTitle(seg, c)} is already at its realistic maximum of ${max} minutes.` : `${segmentTitle(seg, c)} is at its minimum of ${min} minutes.`);
      return;
    }
    update(plan.segments.map((s, k) => (k === i ? next : s)));
    announce(`${segmentTitle(seg, c)}: ${next.minutes} minutes.`);
  };

  const swap = (i: number) => {
    const seg = plan.segments[i];
    const exclude = plan.segments.map((s) => s.ref ?? '');
    swapSeed.current += 1;
    const hasOtherOuting = plan.segments.some((s, k) => k !== i && (c.activityById.get(s.ref ?? '')?.outing || c.recipeById.get(s.ref ?? '')?.outing));
    const options = alternativesFor(c, plan.kids, plan.settings, exclude, swapSeed.current).filter((o) => !(hasOtherOuting && o.outing));
    if (!options.length) {
      announce('No other options fit your current choices.');
      return;
    }
    const pick = options[0];
    const minutes = Math.max(pick.duration.min, Math.min(pick.duration.max, seg.minutes));
    const replacement: PlanSegment = { id: seg.id, kind: pick.kind, ref: pick.id, minutes };
    if (pick.kind === 'recipe') replacement.younger = youngerFor(pick.id, plan, c);
    update(plan.segments.map((s, k) => (k === i ? replacement : s)));
    announce(`Swapped in ${segmentTitle(replacement, c)}.`);
  };

  const addCandidate = (kind: 'activity' | 'recipe', ref: string, minutes: number) => {
    if (plan.segments.length >= MAX_SEGMENTS) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
    const seg: PlanSegment = { id: newId(kind === 'recipe' ? 'r' : 'a'), kind, ref, minutes };
    if (kind === 'recipe') seg.younger = youngerFor(ref, plan, c);
    update([...plan.segments, seg]);
    setAdding(null);
    announce(`Added ${segmentTitle(seg, c)}.`);
  };

  const addBreak = () => {
    if (plan.segments.length >= MAX_SEGMENTS) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
    update([...plan.segments, { id: newId('b'), kind: 'break', minutes: 10, label: BREAK_LABEL }]);
    announce('Added a flexible break.');
  };

  const addCustom = () => {
    const label = cleanText(customText, LIMITS.custom);
    if (!label) return;
    if (plan.segments.length >= MAX_SEGMENTS) return announce(`A plan can hold up to ${MAX_SEGMENTS} entries.`);
    const minutes = Math.max(1, Math.min(120, Math.round(customMinutes) || 15));
    const who = plan.kids.length === 2 ? customWho : 'c1';
    update([...plan.segments, { id: newId('c'), kind: 'custom', minutes, label, who }]);
    setCustomText('');
    setAdding(null);
    announce(`Added ${label}.`);
  };

  const options = adding === 'activity' ? alternativesFor(c, plan.kids, plan.settings, plan.segments.map((s) => s.ref ?? ''), 0).slice(0, 12) : [];

  return (
    <div>
      <div className="plan-summary" aria-live="polite">
        <span>
          <strong>{formatClock(start)}</strong> to <strong>{formatClock(start + used)}</strong>
        </span>
        <span>{formatMinutes(used)} planned of {formatMinutes(plan.window)}</span>
        {open > 0 && <span>{formatMinutes(open)} open</span>}
        {open < 0 && <span className="warn">Runs {formatMinutes(-open)} past your window</span>}
      </div>
      {(tally.flat > 0 || tally.supported > 0) && (
        <p className="tummy-tally note-box">
          <strong>Tummy time planned:</strong> up to {tally.flat} min of floor tummy time on a flat surface
          {tally.supported > 0 ? `, plus ${tally.supported} min held or supported (not a flat-surface position)` : ''}. Count only the minutes your baby is actually on their tummy, awake and watched, toward any target your baby’s clinicians gave you.
        </p>
      )}
      {plan.segments.length === 0 && <p className="empty">This plan is empty. Add an activity, a break, or your own entry below.</p>}
      <ol className="timeline" ref={listRef} aria-label="Plan timeline">
        {items.map((t, i) => {
          const seg = t.segment;
          const title = segmentTitle(seg, c);
          const href = seg.kind === 'activity' ? activityHref(seg.ref ?? '') : seg.kind === 'recipe' ? recipeHref(seg.ref ?? '') : null;
          const recipe = seg.kind === 'recipe' ? c.recipeById.get(seg.ref ?? '') : undefined;
          const cue = safetyCue(seg, c);
          const { min, max } = bounds(seg, c);
          return (
            <li key={seg.id} data-seg={seg.id} className={`seg${seg.kind === 'break' ? ' break' : ''}${t.missing ? ' problem' : ''}`}>
              <div className="seg-time">
                {formatClock(t.start)}–{formatClock(t.end)}
                {t.setup + t.cleanup > 0 ? ` · setup ${t.setup} + ${seg.minutes} min + tidy ${t.cleanup}` : ` · ${seg.minutes} min`}
              </div>
              <p className="seg-title">
                {href && !t.missing ? <a href={href}>{title}</a> : title}{' '}
                {recipe && <span className="tag blue">{recipe.mode === 'together' ? 'Together' : 'Side by side'}</span>}
                {seg.kind === 'custom' && <span className="tag">Your entry</span>}
              </p>
              {t.missing ? <p className="warn">This item is no longer in Trunk. Remove or swap it.</p> : <Tracks seg={seg} plan={plan} c={c} />}
              {cue && <p className="safety-line">{cue}</p>}
              {(() => {
                const issue = segmentTimeIssue(t, plan, c);
                return issue ? (
                  <p className="safety-line" role="note">
                    {TIME_ISSUE_TEXT[issue]}
                  </p>
                ) : null;
              })()}
              <div className="seg-tools">
                <span className="resize" role="group" aria-label={`Length of ${title}`}>
                  <button type="button" onClick={() => sizeBy(i, -1)} aria-label={`Shorter: ${title}`} disabled={seg.minutes <= min}>
                    −
                  </button>
                  <output aria-live="off">{seg.minutes} min</output>
                  <button type="button" onClick={() => sizeBy(i, 1)} aria-label={`Longer: ${title}`} disabled={seg.minutes >= max}>
                    +
                  </button>
                </span>
                <button type="button" data-move="-1" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move earlier: ${title}`}>
                  ↑
                </button>
                <button type="button" data-move="1" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move later: ${title}`}>
                  ↓
                </button>
                {(seg.kind === 'activity' || seg.kind === 'recipe') && (
                  <button type="button" onClick={() => swap(i)} aria-label={`Swap: ${title}`}>
                    Swap
                  </button>
                )}
                <button type="button" className="danger" onClick={() => remove(i)} aria-label={`Remove: ${title}`}>
                  Remove
                </button>
              </div>
              {(seg.kind === 'activity' || seg.kind === 'recipe') && !t.missing && (
                <p className="tiny" style={{ margin: '6px 0 0' }}>
                  Realistic range {durationText({ min, max, default: seg.minutes })} (estimate).
                </p>
              )}
            </li>
          );
        })}
        {open > 0 && plan.segments.length > 0 && (
          <li className="seg open">
            <div className="seg-time">
              {formatClock(start + used)}–{formatClock(start + plan.window)}
            </div>
            <p className="seg-title">Open time · {formatMinutes(open)}</p>
            <p className="subtle" style={{ margin: 0 }}>
              Unscheduled. Rest, free play, a snack, or whatever comes up.
            </p>
          </li>
        )}
      </ol>

      <div className="button-row" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => setAdding(adding === 'activity' ? null : 'activity')} aria-expanded={adding === 'activity'}>
          + Activity
        </button>
        <button type="button" onClick={addBreak}>
          + Break
        </button>
        <button type="button" onClick={() => setAdding(adding === 'custom' ? null : 'custom')} aria-expanded={adding === 'custom'}>
          + Your own
        </button>
      </div>

      {adding === 'activity' && (
        <div className="panel" style={{ marginTop: 10 }}>
          <h3>Add an activity</h3>
          {options.length === 0 ? (
            <p>Nothing else fits your current choices. Try changing energy or place above.</p>
          ) : (
            <ul className="idea-list">
              {options.map((o) => (
                <li key={o.id} className="idea" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span>
                    <strong>{o.kind === 'recipe' ? c.recipeById.get(o.id)?.title : c.activityById.get(o.id)?.title}</strong>
                    <br />
                    <span className="tiny">{durationText(o.duration)} (estimate)</span>
                  </span>
                  <button type="button" onClick={() => addCandidate(o.kind, o.id, o.duration.default)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {adding === 'custom' && (
        <form
          className="panel"
          style={{ marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            addCustom();
          }}
        >
          <h3>Add your own entry</h3>
          <p className="tiny">Your words, your call. Trunk doesn’t attach sources or safety checks to your own entries.</p>
          <div className="inline-fields">
            <label style={{ flex: '1 1 200px' }}>
              What
              <input type="text" maxLength={LIMITS.custom} value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="e.g. Library story time" required />
            </label>
            <label>
              Minutes
              <input type="number" min={1} max={120} value={customMinutes} onChange={(e) => setCustomMinutes(Number(e.target.value))} />
            </label>
            {plan.kids.length === 2 && (
              <label>
                For
                <select value={customWho} onChange={(e) => setCustomWho(e.target.value as 'both' | 'c1' | 'c2')}>
                  <option value="both">Both</option>
                  <option value="c1">Child 1</option>
                  <option value="c2">Child 2</option>
                </select>
              </label>
            )}
            <button type="submit">Add</button>
          </div>
        </form>
      )}
    </div>
  );
}
