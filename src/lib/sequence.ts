/**
 * One short line explaining why an entry sits where it does, derived from the
 * plan's analysis (never stored). Shown only where it means something: the
 * last calm idea before a nap, the first gentle idea after one, the first
 * active idea while a nap is still a while off, the first feed-sensitive idea
 * placed clear of a feed. Most entries get no line.
 *
 * Uses only the parent's own routine blocks. Records whose stimulation is
 * "variable" (not rated) never get a profile-based line, and nothing here says
 * an activity is "safe" or helps sleep.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import type { Activity, Stimulation } from '../content/schema.ts';
import type { EntryAnalysis, PlanAnalysis } from './layout.ts';
import type { Plan } from './plan.ts';
import { rulesFor } from './timing.ts';
import { days } from './eligibility.ts';
import { toDays } from './age.ts';

const BEFORE_NAP = 30;
const AFTER_WAKE = 20;
const FEED_NEAR = 60;

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

/** Activities that carry a feed- or meal-related "avoid" rule for this child's age (tummy time, for example). */
function feedSensitive(e: EntryAnalysis, lane: 0 | 1, plan: Plan, c: IndexedCatalog): boolean {
  const s = e.item.segment;
  let acts: (Activity | undefined)[] = [];
  if (s.kind === 'activity') acts = [c.activityById.get(s.ref ?? '')];
  else if (s.kind === 'recipe') {
    const r = c.recipeById.get(s.ref ?? '');
    if (r) {
      const youngerLane = s.younger === 'c2' ? 1 : 0;
      acts = [c.activityById.get(lane === youngerLane ? r.younger.activity : r.older.activity)];
    }
  }
  const childDays = toDays(plan.kids[lane].age);
  return acts.some(
    (a) =>
      a !== undefined &&
      rulesFor(c, a.timing.stimulation, a.timing.rules).some(
        (r) => (r.event === 'milk-feed' || r.event === 'meal') && r.fit === 'avoid' && !r.condition && (!r.ageMin || !r.ageMax || (childDays >= days(r.ageMin) && childDays < days(r.ageMax))),
      ),
  );
}

export function sequenceNote(plan: Plan, analysis: PlanAnalysis, index: number, c: IndexedCatalog): string | null {
  const e = analysis.entries[index];
  if (!e) return null;
  const stim = stimulationOf(e, c);
  if (!stim) return null;
  const kidCount = plan.kids.length;
  const lanes = lanesOf(e, kidCount);
  const play = (lane: 0 | 1) => analysis.entries.filter((x) => lanesOf(x, kidCount).includes(lane) && stimulationOf(x, c) !== null);
  const { start, end } = e.item;

  // Kept clear of a feed: the first feed-sensitive idea after a feed, placed outside its window.
  if (!e.timing.avoid) {
    for (const lane of lanes) {
      if (!feedSensitive(e, lane, plan, c)) continue;
      const feed = analysis.events[lane]
        .filter((ev) => (ev.event === 'milk-feed' || ev.event === 'meal') && ev.end <= start && start - ev.end <= FEED_NEAR)
        .sort((a, b) => b.end - a.end)[0];
      if (!feed) continue;
      const earlier = play(lane).some((x) => x !== e && x.item.start >= feed.end && x.item.start < start && feedSensitive(x, lane, plan, c));
      if (!earlier) return feed.event === 'meal' ? 'Kept clear of the meal' : 'Kept clear of the feed';
    }
  }

  if (stim === 'variable') return null;

  for (const lane of lanes) {
    const naps = analysis.events[lane].filter((ev) => ev.event === 'nap');
    const next = naps.filter((n) => n.start >= end).sort((a, b) => a.start - b.start)[0];
    const woke = naps.filter((n) => n.end <= start).sort((a, b) => b.end - a.end)[0];

    if (next && next.start - end <= BEFORE_NAP && (stim === 'settling' || stim === 'gentle')) {
      const last = !play(lane).some((x) => x !== e && x.item.start >= end && x.item.start < next.start);
      if (last) return stim === 'settling' ? 'Quiet play before the nap' : 'Calm play before the nap';
    }
    if (woke && start - woke.end <= AFTER_WAKE && (stim === 'settling' || stim === 'gentle')) {
      const firstAfter = !play(lane).some((x) => x !== e && x.item.start >= woke.end && x.item.start < start);
      if (firstAfter) return 'Gentle start after waking';
    }
    if (next && next.start - end > BEFORE_NAP && stim === 'lively') {
      const since = woke ? woke.end : -Infinity;
      const firstLively = !play(lane).some((x) => x !== e && x.item.start >= since && x.item.start < start && stimulationOf(x, c) === 'lively');
      if (firstLively) return 'Active play while there’s time';
    }
  }
  return null;
}
