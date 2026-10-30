/**
 * One short line explaining why an entry sits where it does, derived from the
 * plan's analysis (never stored). Shown only where it means something: the
 * last calm idea before a nap, the first gentle idea after one, the first
 * active idea while a nap is still a while off, the first idea with a feed (or
 * meal) avoid rule placed just outside that rule's window. Most entries get no
 * line, and an entry with any timing caution gets none.
 *
 * Uses only the parent's own routine blocks. Records whose stimulation is
 * "variable" (not rated) never get a profile-based line, and nothing here says
 * an activity is "safe" or helps sleep.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import type { Activity, RoutineEvent, Stimulation, TimingRule } from '../content/schema.ts';
import type { EntryAnalysis, PlanAnalysis } from './layout.ts';
import type { Plan } from './plan.ts';
import { rulesFor } from './timing.ts';
import { childStimulation } from './planner.ts';
import { days } from './eligibility.ts';
import { toDays } from './age.ts';

const BEFORE_NAP = 30;
const AFTER_WAKE = 20;
/** A "kept clear" line only when the entry is within this many minutes of the rule's window. */
const NEAR = 30;

function stimulationOf(e: EntryAnalysis, c: IndexedCatalog): Stimulation | null {
  const s = e.item.segment;
  if (s.kind === 'activity') return c.activityById.get(s.ref ?? '')?.timing.stimulation ?? null;
  if (s.kind === 'recipe') return c.recipeById.get(s.ref ?? '')?.timing.stimulation ?? null;
  return null;
}

/** Children a play entry (activity or pairing) is for. */
function lanesOf(e: EntryAnalysis, kidCount: number): (0 | 1)[] {
  const s = e.item.segment;
  if (s.kind === 'activity') return [e.child ?? 0];
  if (s.kind === 'recipe') return kidCount === 2 ? [0, 1] : [0];
  return [];
}

/**
 * The in-scope, non-conditional "avoid" rules this entry's own activity carries for
 * this child (for a pairing, the child's role), exactly as the evaluator selects them.
 */
function avoidRules(e: EntryAnalysis, lane: 0 | 1, plan: Plan, c: IndexedCatalog): TimingRule[] {
  const s = e.item.segment;
  let act: Activity | undefined;
  if (s.kind === 'activity') act = c.activityById.get(s.ref ?? '');
  else if (s.kind === 'recipe') {
    const r = c.recipeById.get(s.ref ?? '');
    if (r) act = c.activityById.get(lane === (s.younger === 'c2' ? 1 : 0) ? r.younger.activity : r.older.activity);
  }
  if (!act) return [];
  const childDays = toDays(plan.kids[lane].age);
  return rulesFor(c, act.timing.stimulation, act.timing.rules).filter(
    (r) => r.fit === 'avoid' && !r.condition && (!r.ageMin || !r.ageMax || (childDays >= days(r.ageMin) && childDays < days(r.ageMax))),
  );
}

const CLEAR_TEXT: Partial<Record<RoutineEvent, string>> = { 'milk-feed': 'Kept clear of the feed', meal: 'Kept clear of the meal' };

/**
 * "Kept clear of the feed/meal": only for an event that one of the entry's own avoid
 * rules is keyed to, only when the entry lies outside that rule's window (and close
 * enough for the note to mean something), and only on the first such entry after
 * the event (or the last one before it).
 */
function keptClear(e: EntryAnalysis, lanes: (0 | 1)[], plan: Plan, analysis: PlanAnalysis, c: IndexedCatalog, play: (lane: 0 | 1) => EntryAnalysis[]): string | null {
  const { engageStart, end } = e.item;
  for (const lane of lanes) {
    for (const rule of avoidRules(e, lane, plan, c)) {
      const text = CLEAR_TEXT[rule.event];
      if (!text) continue;
      const w = rule.window.minutes;
      const events = analysis.events[lane].filter((ev) => ev.event === rule.event);
      const carries = (x: EntryAnalysis) => avoidRules(x, lane, plan, c).some((r) => r.id === rule.id);
      if (rule.when === 'after') {
        const ev = events.filter((x) => x.end <= engageStart).sort((a, b) => b.end - a.end)[0];
        if (!ev || engageStart < ev.end + w || engageStart - ev.end >= w + NEAR) continue;
        const earlier = play(lane).some((x) => x !== e && x.item.engageStart >= ev.end && x.item.engageStart < engageStart && carries(x));
        if (!earlier) return text;
      } else {
        const ev = events.filter((x) => x.start >= end).sort((a, b) => a.start - b.start)[0];
        if (!ev || end > ev.start - w || ev.start - w - end >= NEAR) continue;
        const later = play(lane).some((x) => x !== e && x.item.end > end && x.item.end <= ev.start && carries(x));
        if (!later) return text;
      }
    }
  }
  return null;
}

export function sequenceNote(plan: Plan, analysis: PlanAnalysis, index: number, c: IndexedCatalog): string | null {
  const e = analysis.entries[index];
  if (!e) return null;
  const stim = stimulationOf(e, c);
  if (!stim) return null;
  // An entry with any timing concern (a caution or an avoid) gets no positive line.
  if (e.timing.avoid || e.timing.findings.some((f) => f.fit === 'avoid' || f.fit === 'later')) return null;
  const kidCount = plan.kids.length;
  const lanes = lanesOf(e, kidCount);
  const play = (lane: 0 | 1) => analysis.entries.filter((x) => lanesOf(x, kidCount).includes(lane) && stimulationOf(x, c) !== null);
  const { start, end } = e.item;

  const clear = keptClear(e, lanes, plan, analysis, c, play);
  if (clear) return clear;

  // Each child's own stimulation (a pairing's role, with the shared space as a floor).
  const seg = e.item.segment;
  const recipe = seg.kind === 'recipe' ? c.recipeById.get(seg.ref ?? '') : undefined;
  const stimFor = (lane: 0 | 1): Stimulation => {
    if (!recipe) return stim;
    const roles: [Stimulation, Stimulation] = [
      c.activityById.get(recipe.younger.activity)?.timing.stimulation ?? 'variable',
      c.activityById.get(recipe.older.activity)?.timing.stimulation ?? 'variable',
    ];
    return childStimulation({ stimulation: stim, roles }, lane, seg.younger === 'c2' ? 1 : 0);
  };
  const calm = (x: Stimulation) => x === 'settling' || x === 'gentle';
  const allCalm = lanes.every((l) => calm(stimFor(l)));

  for (const lane of lanes) {
    const own = stimFor(lane);
    if (own === 'variable') continue;
    const naps = analysis.events[lane].filter((ev) => ev.event === 'nap');
    const next = naps.filter((n) => n.start >= end).sort((a, b) => a.start - b.start)[0];
    const woke = naps.filter((n) => n.end <= start).sort((a, b) => b.end - a.end)[0];

    if (next && next.start - end <= BEFORE_NAP && allCalm) {
      const last = !play(lane).some((x) => x !== e && x.item.start >= end && x.item.start < next.start);
      if (last) return lanes.every((l) => stimFor(l) === 'settling') ? 'Quiet play before the nap' : 'Calm play before the nap';
    }
    if (woke && start - woke.end <= AFTER_WAKE && allCalm) {
      const firstAfter = !play(lane).some((x) => x !== e && x.item.start >= woke.end && x.item.start < start);
      if (firstAfter) return 'Gentle start after waking';
    }
    if (next && next.start - end > BEFORE_NAP && own === 'lively') {
      const since = woke ? woke.end : -Infinity;
      const firstLively = !play(lane).some((x) => x !== e && x.item.start >= since && x.item.start < start && stimulationOf(x, c) === 'lively');
      if (firstLively) return 'Active play while there’s time';
    }
  }
  return null;
}
