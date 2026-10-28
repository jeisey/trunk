/**
 * Deterministic client-side planner.
 *
 * 1. Filter: age, readiness, adults, curated pairings (hard), then the parent's
 *    energy/place/mode preferences.
 * 2. Fill the window greedily, scoring for variety (don't repeat an intent back
 *    to back), continuity (stay in the same place), and a seeded tiebreak.
 * 3. Never stretch an activity past its credible maximum. Insert flexible breaks
 *    at an age-appropriate cadence. Whatever can't be filled is shown as open time.
 *
 * Scoring is intentionally simple and readable; it is not an optimizer.
 */
import type { Activity, MixedAgeRecipe } from '../content/schema.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { activityEligible, activityPasses, hash, recipeEligible, recipePasses, DEFAULT_FILTERS, type Filters, relaxations, type Relaxation } from './filters.ts';
import { BREAK_LABEL, kidInputs, newId, youngerFor, type PlanKid, type PlanSegment, type PlanSettings } from './plan.ts';
import { monthsToDays } from './age.ts';
import { formatAgeShort } from './age.ts';

export interface PlannerInput {
  kids: PlanKid[];
  settings: PlanSettings;
  window: number;
  seed?: number;
}

export interface PlannerResult {
  segments: PlanSegment[];
  /** Wall-clock minutes left unscheduled (shown as open time). */
  open: number;
  /** Plain-language limits the parent should know about. */
  notes: string[];
  /** When nothing fits: the limiting constraint and safe adjustments. */
  blocked?: { reason: string; relax: Relaxation[] };
}

type Candidate = {
  kind: 'activity' | 'recipe';
  id: string;
  intents: readonly string[];
  goals: readonly string[];
  places: readonly string[];
  outing: boolean;
  media: boolean;
  effort: string;
  setup: number;
  cleanup: number;
  duration: { min: number; default: number; max: number };
};

const fromActivity = (a: Activity): Candidate => ({
  kind: 'activity',
  id: a.id,
  intents: a.intents,
  goals: a.goals,
  places: a.places,
  outing: a.outing,
  media: a.kind === 'media',
  effort: a.effort,
  setup: a.setupMinutes,
  cleanup: a.cleanupMinutes,
  duration: a.duration,
});

const fromRecipe = (r: MixedAgeRecipe, c: IndexedCatalog): Candidate => {
  const acts = [c.activityById.get(r.younger.activity), c.activityById.get(r.older.activity)];
  return {
    kind: 'recipe',
    id: r.id,
    intents: r.intents,
    goals: acts.flatMap((a) => a?.goals ?? []),
    places: r.places,
    outing: r.outing,
    media: acts.some((a) => a?.kind === 'media'),
    effort: r.effort,
    setup: r.setupMinutes,
    cleanup: r.cleanupMinutes,
    duration: r.duration,
  };
};

export function filtersFromSettings(settings: PlanSettings, window: number | null = null): Filters {
  return { ...DEFAULT_FILTERS, ...settings, minutes: window };
}

/** Break cadence by the youngest child's age: [minutes between breaks, break length]. */
export function breakCadence(youngestDays: number): { every: number; length: number } {
  if (youngestDays < monthsToDays(3)) return { every: 20, length: 10 };
  if (youngestDays < monthsToDays(12)) return { every: 30, length: 10 };
  if (youngestDays < monthsToDays(36)) return { every: 40, length: 10 };
  return { every: 45, length: 5 };
}

export function candidatesFor(c: IndexedCatalog, kids: PlanKid[], settings: PlanSettings, window: number | null) {
  const inputs = kidInputs({ kids });
  const f = filtersFromSettings(settings, window);
  if (inputs.length === 2) {
    const pair: [typeof inputs[0], typeof inputs[1]] = [inputs[0], inputs[1]];
    const eligible = c.recipes.filter((r) => recipeEligible(r, pair, settings.adults));
    const pass = eligible.filter((r) => recipePasses(r, f, c));
    return {
      eligibleCount: eligible.length,
      pool: pass.map((r) => fromRecipe(r, c)),
      relax: () => relaxations((skip) => eligible.filter((r) => recipePasses(r, f, c, skip)).length, f, true),
    };
  }
  const eligible = c.activities.filter((a) => activityEligible(a, inputs[0], settings.adults));
  const pass = eligible.filter((a) => activityPasses(a, f));
  return {
    eligibleCount: eligible.length,
    pool: pass.map(fromActivity),
    relax: () => relaxations((skip) => eligible.filter((a) => activityPasses(a, f, skip)).length, f, false),
  };
}

export function planWindow(c: IndexedCatalog, input: PlannerInput): PlannerResult {
  const { kids, settings, window } = input;
  const seed = input.seed ?? 0;
  const notes: string[] = [];
  const { pool, eligibleCount, relax } = candidatesFor(c, kids, settings, window);
  const youngest = Math.min(...kidInputs({ kids }).map((k) => k.days));

  if (pool.length === 0) {
    const ages = kids.map((k) => formatAgeShort(k.age)).join(' and ');
    const reason =
      eligibleCount === 0
        ? kids.length === 2
          ? `Trunk doesn’t have a curated activity that safely fits a ${ages} with ${settings.adults === 1 ? 'one adult' : 'two adults'} yet. Try planning for one child while the other sleeps or is with another adult.`
          : `No activities fit this age and readiness yet.`
        : `Your current choices rule out every option for a ${ages}.`;
    return { segments: [], open: window, notes, blocked: { reason, relax: eligibleCount ? relax() : [] } };
  }

  const cadence = breakCadence(youngest);
  const segments: PlanSegment[] = [];
  const uses = new Map<string, number>();
  let remaining = window;
  let sinceBreak = 0;
  let last: Candidate | null = null;
  let usedOuting = false;
  let usedMedia = false;
  const smallest = Math.min(...pool.map((p) => p.setup + p.duration.min + p.cleanup));

  const score = (p: Candidate): number => {
    let s = 20;
    const n = uses.get(p.id) ?? 0;
    s -= n * 25;
    if (last) {
      if (p.id === last.id) s -= 100;
      if (p.intents[0] === last.intents[0]) s -= 8;
      if (p.goals.some((g) => last!.goals.includes(g))) s -= 3;
      if (p.places.some((pl) => last!.places.includes(pl))) s += 3;
    }
    if (p.outing) s += segments.length === 0 && window >= 60 ? 4 : -2;
    if ((settings.energy === 'low' || settings.energy === 'busy') && p.effort === 'low') s += 3;
    if (p.media) s -= 10;
    if (p.setup + p.duration.default + p.cleanup > remaining) s -= 4;
    return s + (hash(`${seed}:${p.id}`) % 6);
  };

  for (let guard = 0; guard < 40 && segments.length < 20; guard++) {
    if (segments.length > 0 && sinceBreak >= cadence.every && remaining >= cadence.length + smallest) {
      segments.push({ id: newId('b'), kind: 'break', minutes: cadence.length, label: BREAK_LABEL });
      remaining -= cadence.length;
      sinceBreak = 0;
      continue;
    }
    const options = pool.filter((p) => {
      if (p.setup + p.duration.min + p.cleanup > remaining) return false;
      if (p.outing && usedOuting) return false;
      if (p.media && usedMedia) return false;
      if (last && p.id === last.id) return false;
      // Repeats only once every other option has been used, and at most twice.
      const n = uses.get(p.id) ?? 0;
      if (n >= 2) return false;
      if (n >= 1 && pool.some((q) => !uses.has(q.id) && q.setup + q.duration.min + q.cleanup <= remaining && !(q.outing && usedOuting) && !(q.media && usedMedia))) return false;
      return true;
    });
    if (options.length === 0) break;
    const pick = options.reduce((best, p) => (score(p) > score(best) || (score(p) === score(best) && p.id < best.id) ? p : best));
    const room = remaining - pick.setup - pick.cleanup;
    const minutes = Math.max(pick.duration.min, Math.min(pick.duration.default, pick.duration.max, room));
    const seg: PlanSegment = { id: newId(pick.kind === 'recipe' ? 'r' : 'a'), kind: pick.kind, ref: pick.id, minutes };
    if (pick.kind === 'recipe') seg.younger = youngerFor(pick.id, { kids }, c);
    segments.push(seg);
    uses.set(pick.id, (uses.get(pick.id) ?? 0) + 1);
    const wall = pick.setup + minutes + pick.cleanup;
    remaining -= wall;
    sinceBreak += wall;
    usedOuting ||= pick.outing;
    usedMedia ||= pick.media;
    last = pick;
  }

  if (remaining > 0 && segments.length > 0) {
    notes.push(`${remaining} min left open. Activities aren't stretched past what's realistic for this age.`);
  }
  if (youngest < monthsToDays(3)) {
    notes.push('Young babies may need to feed or sleep at any point. Stop the plan whenever they do.');
  }
  return { segments, open: Math.max(0, remaining), notes };
}

/** Ranked alternatives for one slot (used by "Swap"), excluding what's already in the plan. */
export function alternativesFor(c: IndexedCatalog, kids: PlanKid[], settings: PlanSettings, exclude: readonly string[], seed = 0): Candidate[] {
  const { pool } = candidatesFor(c, kids, settings, null);
  return pool
    .filter((p) => !exclude.includes(p.id))
    .sort((a, b) => (hash(`${seed}:${b.id}`) % 97) - (hash(`${seed}:${a.id}`) % 97) || a.id.localeCompare(b.id));
}
