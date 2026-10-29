/**
 * Finder filtering and ranking. Pure functions over the catalog.
 *
 * Safety constraints (age, readiness the parent marked "not yet", adult count,
 * curated pairings) are never relaxed. Optional preferences (time, energy,
 * place, low prep, goals, materials, mess, noise, mode) can be relaxed one tap
 * at a time, and the UI always says which one.
 *
 * Momentary timing ("Just fed", "Nap soon") only reorders results or sets an
 * idea aside for now with its cue; it is never a relaxable filter and never
 * counts as an age or safety exclusion.
 */
import type { Activity, Goal, MixedAgeRecipe } from '../content/schema.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { activityFitsAge, activityFitsReadiness, days, recipeAssignment, type ChildInput } from './eligibility.ts';
import { isBusyNearbyCompatible } from './supervision.ts';
import { assessActivity, assessRecipe, hasMoment, momentTiming, spanOf, type MomentContext, type TimingAssessment } from './timing.ts';

export type Energy = 'busy' | 'low' | 'some' | 'plenty';
export type PlaceFilter = 'any' | 'indoors' | 'outdoors';
export type Mode = 'either' | 'together' | 'parallel';
export type Focus = 'both' | 0 | 1;
export type MaterialsFilter = 'any' | 'household' | 'none';
export type MessFilter = 'any' | 'low';

export interface Filters {
  minutes: number | null;
  energy: Energy;
  place: PlaceFilter;
  mode: Mode;
  focus: Focus;
  adults: 1 | 2;
  lowPrep: boolean;
  goals: Goal[];
  materials: MaterialsFilter;
  mess: MessFilter;
  quiet: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  minutes: 30,
  energy: 'some',
  place: 'any',
  mode: 'either',
  focus: 'both',
  adults: 1,
  lowPrep: false,
  goals: [],
  materials: 'any',
  mess: 'any',
  quiet: false,
};

export type OptionalFilter = 'minutes' | 'energy' | 'place' | 'mode' | 'lowPrep' | 'goals' | 'materials' | 'mess' | 'quiet';

export const ENERGY_LABEL: Record<Energy, string> = {
  busy: 'Busy nearby',
  low: 'Low energy',
  some: 'Some energy',
  plenty: 'Ready to play',
};

const EFFORT_ALLOWED: Record<Energy, readonly Activity['effort'][]> = {
  busy: ['low'],
  low: ['low'],
  some: ['low', 'medium'],
  plenty: ['low', 'medium', 'high'],
};

/** Media appears only in low-energy or busy-nearby contexts, and only where its age floor is met. */
export function mediaAllowed(energy: Energy): boolean {
  return energy === 'busy' || energy === 'low';
}

export function overheadMinutes(x: { setupMinutes: number; cleanupMinutes: number }): number {
  return x.setupMinutes + x.cleanupMinutes;
}

export function fitsTime(x: { setupMinutes: number; cleanupMinutes: number; duration: { min: number } }, minutes: number | null): boolean {
  return minutes === null || overheadMinutes(x) + x.duration.min <= minutes;
}

/** Suggested engagement minutes inside a time budget, never above the record's max or below its min. */
export function suggestedMinutes(x: { setupMinutes: number; cleanupMinutes: number; duration: { min: number; default: number; max: number } }, minutes: number | null): number {
  if (minutes === null) return x.duration.default;
  const room = minutes - overheadMinutes(x);
  return Math.max(x.duration.min, Math.min(x.duration.default, room, x.duration.max));
}

const isLowPrep = (x: { setupMinutes: number; mess: string }) => x.setupMinutes <= 2 && (x.mess === 'none' || x.mess === 'low');

/** Hard constraints for one child: age, readiness, adults, retirement. Never relaxed. */
export function activityEligible(a: Activity, child: ChildInput, adults: number): boolean {
  return !a.retired && activityFitsAge(a, child.days) && activityFitsReadiness(a, child.notYet) && a.supervision.minAdults <= adults;
}

export function activityPasses(a: Activity, f: Filters, skip: OptionalFilter | null = null): boolean {
  if (a.kind === 'media' && !mediaAllowed(f.energy)) return false;
  if (skip !== 'minutes' && !fitsTime(a, f.minutes)) return false;
  if (skip !== 'energy') {
    if (!EFFORT_ALLOWED[f.energy].includes(a.effort)) return false;
    if (f.energy === 'busy' && !isBusyNearbyCompatible(a)) return false;
  }
  if (skip !== 'place' && f.place !== 'any' && !a.places.includes(f.place)) return false;
  if (skip !== 'lowPrep' && f.lowPrep && !isLowPrep(a)) return false;
  if (skip !== 'goals' && f.goals.length > 0 && !a.goals.some((g) => f.goals.includes(g))) return false;
  if (skip !== 'materials') {
    if (f.materials === 'none' && a.materials.level !== 'none') return false;
    if (f.materials === 'household' && (a.materials.level === 'special' || a.materials.level === 'toys')) return false;
  }
  if (skip !== 'mess' && f.mess === 'low' && (a.mess === 'medium' || a.mess === 'high')) return false;
  if (skip !== 'quiet' && f.quiet && a.noise !== 'quiet') return false;
  return true;
}

export function recipeBusyCompatible(r: MixedAgeRecipe, c: IndexedCatalog): boolean {
  const y = c.activityById.get(r.younger.activity);
  const o = c.activityById.get(r.older.activity);
  return Boolean(y && o && isBusyNearbyCompatible(y) && isBusyNearbyCompatible(o) && r.adult.handsOnFor === 'neither');
}

export function recipeEligible(r: MixedAgeRecipe, kids: [ChildInput, ChildInput], adults: number): boolean {
  return !r.retired && r.adult.minAdults <= adults && recipeAssignment(r, kids[0], kids[1]) !== null;
}

export function recipePasses(r: MixedAgeRecipe, f: Filters, c: IndexedCatalog, skip: OptionalFilter | null = null): boolean {
  const acts = [c.activityById.get(r.younger.activity), c.activityById.get(r.older.activity)].filter((a): a is Activity => Boolean(a));
  if (acts.some((a) => a.kind === 'media') && !mediaAllowed(f.energy)) return false;
  if (skip !== 'mode' && f.mode !== 'either' && r.mode !== f.mode) return false;
  if (skip !== 'minutes' && !fitsTime(r, f.minutes)) return false;
  if (skip !== 'energy') {
    if (!EFFORT_ALLOWED[f.energy].includes(r.effort)) return false;
    if (f.energy === 'busy' && !recipeBusyCompatible(r, c)) return false;
  }
  if (skip !== 'place' && f.place !== 'any' && !r.places.includes(f.place)) return false;
  if (skip !== 'lowPrep' && f.lowPrep && !isLowPrep({ setupMinutes: r.setupMinutes, mess: acts.some((a) => a.mess === 'medium' || a.mess === 'high') ? 'medium' : 'low' })) return false;
  if (skip !== 'goals' && f.goals.length > 0 && !acts.some((a) => a.goals.some((g) => f.goals.includes(g)))) return false;
  if (skip !== 'materials') {
    if (f.materials === 'none' && acts.some((a) => a.materials.level !== 'none')) return false;
    if (f.materials === 'household' && acts.some((a) => a.materials.level === 'special' || a.materials.level === 'toys')) return false;
  }
  if (skip !== 'mess' && f.mess === 'low' && acts.some((a) => a.mess === 'medium' || a.mess === 'high')) return false;
  if (skip !== 'quiet' && f.quiet && acts.some((a) => a.noise !== 'quiet')) return false;
  return true;
}

/** Small deterministic hash for stable tie-breaking and "shuffle". */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Rank: activities aimed at this age first (narrower ranges centred on the
 * child), then low setup when energy is low, with a seeded tiebreak; then
 * spread intents so the top of the list isn't five versions of one idea.
 */
export function rankActivities(list: Activity[], childDays: number, f: Filters, seed: number, timingScore: (a: Activity) => number = () => 0): Activity[] {
  const score = (a: Activity) => {
    const min = days(a.ageMin);
    const max = days(a.ageMax);
    const width = Math.max(30, max - min);
    const centre = (min + max) / 2;
    let s = 100 - Math.min(40, (width / 1826) * 60) - Math.min(20, (Math.abs(childDays - centre) / width) * 20);
    if ((f.energy === 'low' || f.energy === 'busy') && a.setupMinutes <= 2) s += 8;
    if (f.minutes !== null && a.duration.default > f.minutes) s -= 6;
    if (a.kind === 'media') s -= 30;
    return s + timingScore(a) + (hash(`${seed}:${a.id}`) % 12);
  };
  const sorted = [...list].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  return spreadByIntent(sorted);
}

function spreadByIntent<T extends { intents: readonly string[] }>(sorted: T[]): T[] {
  const out: T[] = [];
  const rest = [...sorted];
  while (rest.length) {
    const last = out[out.length - 1];
    const idx = last ? rest.findIndex((x) => x.intents[0] !== last.intents[0]) : 0;
    out.push(rest.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}

export function rankRecipes(list: MixedAgeRecipe[], seed: number, timingScore: (r: MixedAgeRecipe) => number = () => 0): MixedAgeRecipe[] {
  const score = (r: MixedAgeRecipe) => (hash(`${seed}:${r.id}`) % 100) + timingScore(r);
  return spreadByIntent([...list].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)));
}

export interface Relaxation {
  filter: OptionalFilter;
  count: number;
}

/** For an empty result, which single optional filter would bring results back? */
export function relaxations(count: (skip: OptionalFilter) => number, f: Filters, twoChildren: boolean): Relaxation[] {
  const active: OptionalFilter[] = [];
  if (f.minutes !== null) active.push('minutes');
  if (f.energy !== 'plenty') active.push('energy');
  if (f.place !== 'any') active.push('place');
  if (twoChildren && f.mode !== 'either') active.push('mode');
  if (f.lowPrep) active.push('lowPrep');
  if (f.goals.length) active.push('goals');
  if (f.materials !== 'any') active.push('materials');
  if (f.mess !== 'any') active.push('mess');
  if (f.quiet) active.push('quiet');
  return active.map((filter) => ({ filter, count: count(filter) })).filter((r) => r.count > 0);
}

export const RELAX_LABEL: Record<OptionalFilter, string> = {
  minutes: 'Allow longer activities',
  energy: 'Include ones that need more from you',
  place: 'Indoors or outdoors',
  mode: 'Together or side by side',
  lowPrep: 'Allow a little setup',
  goals: 'Any focus',
  materials: 'Any materials',
  mess: 'Allow some mess',
  quiet: 'Allow some noise',
};

export function relaxFilter(f: Filters, filter: OptionalFilter): Filters {
  switch (filter) {
    case 'minutes':
      return { ...f, minutes: null };
    case 'energy':
      return { ...f, energy: f.energy === 'busy' ? 'low' : 'plenty' };
    case 'place':
      return { ...f, place: 'any' };
    case 'mode':
      return { ...f, mode: 'either' };
    case 'lowPrep':
      return { ...f, lowPrep: false };
    case 'goals':
      return { ...f, goals: [] };
    case 'materials':
      return { ...f, materials: 'any' };
    case 'mess':
      return { ...f, mess: 'any' };
    case 'quiet':
      return { ...f, quiet: false };
  }
}

/** An idea left out for now because of an applicable timing rule (not an age, readiness, or safety exclusion). */
export interface SetAside {
  id: string;
  kind: 'activity' | 'recipe';
  title: string;
  /** The rule's short parent-facing cue, e.g. "Not right after a feed". */
  cue: string;
}

export interface FinderResult {
  kind: 'activities' | 'recipes';
  activities: Activity[];
  recipes: MixedAgeRecipe[];
  eligibleCount: number;
  relax: Relaxation[];
  /** Timing assessment at "now" for every listed and set-aside idea (keyed by record ID). */
  timing: Map<string, TimingAssessment>;
  /** Left out of the results for now by an applicable, non-advisory timing rule. Never offered as a relaxation. */
  setAside: SetAside[];
}

/**
 * Finder results for the parent's children and filters.
 *
 * `moments[i]` is child i's momentary context ("Just fed", "Nap soon"), held in
 * memory only. Each idea is assessed as if it started now (setup, suggested
 * minutes, tidy-up). An applicable non-advisory "avoid" moves it to `setAside`
 * (it is not an age/readiness/supervision exclusion, so `eligibleCount` and
 * relaxations ignore it); otherwise the timing score adjusts the ranking. With
 * no moment set, results and ranking are exactly what they were without timing.
 */
export function findIdeas(c: IndexedCatalog, kids: ChildInput[], f: Filters, seed = 0, moments: readonly (MomentContext | undefined)[] = []): FinderResult {
  const pair = kids.length === 2 && f.focus === 'both';
  const timing = new Map<string, TimingAssessment>();
  const setAside: SetAside[] = [];
  if (pair) {
    const both = kids as [ChildInput, ChildInput];
    const active = hasMoment(moments[0]) || hasMoment(moments[1]);
    const ctx = [momentTiming(both[0].days, moments[0]), momentTiming(both[1].days, moments[1])] as const;
    const assess = (r: MixedAgeRecipe, minutes: number | null) =>
      assessRecipe(c, r, spanOf(0, r.setupMinutes, suggestedMinutes(r, minutes), r.cleanupMinutes), ctx, recipeAssignment(r, both[0], both[1]) === 1 ? 1 : 0);
    const eligible = c.recipes.filter((r) => recipeEligible(r, both, f.adults));
    const shown: MixedAgeRecipe[] = [];
    for (const r of eligible.filter((x) => recipePasses(x, f, c))) {
      const t = assess(r, f.minutes);
      timing.set(r.id, t);
      if (t.avoid) setAside.push({ id: r.id, kind: 'recipe', title: r.title, cue: t.cue?.text ?? 'Not right now' });
      else shown.push(r);
    }
    const recipes = rankRecipes(shown, seed, (r) => timing.get(r.id)?.score ?? 0);
    const relax = recipes.length
      ? []
      : relaxations((skip) => eligible.filter((r) => recipePasses(r, f, c, skip) && !(active && assess(r, skip === 'minutes' ? null : f.minutes).avoid)).length, f, true);
    return { kind: 'recipes', activities: [], recipes, eligibleCount: eligible.length, relax, timing, setAside };
  }
  const index = kids.length === 2 && f.focus !== 'both' ? f.focus : 0;
  const child = kids[index];
  const active = hasMoment(moments[index]);
  const ctx = momentTiming(child.days, moments[index]);
  const assess = (a: Activity, minutes: number | null) => assessActivity(c, a, spanOf(0, a.setupMinutes, suggestedMinutes(a, minutes), a.cleanupMinutes), ctx, index);
  const eligible = c.activities.filter((a) => activityEligible(a, child, f.adults));
  const shown: Activity[] = [];
  for (const a of eligible.filter((x) => activityPasses(x, f))) {
    const t = assess(a, f.minutes);
    timing.set(a.id, t);
    if (t.avoid) setAside.push({ id: a.id, kind: 'activity', title: a.title, cue: t.cue?.text ?? 'Not right now' });
    else shown.push(a);
  }
  const activities = rankActivities(shown, child.days, f, seed, (a) => timing.get(a.id)?.score ?? 0);
  const relax = activities.length
    ? []
    : relaxations((skip) => eligible.filter((a) => activityPasses(a, f, skip) && !(active && assess(a, skip === 'minutes' ? null : f.minutes).avoid)).length, f, false);
  return { kind: 'activities', activities, recipes: [], eligibleCount: eligible.length, relax, timing, setAside };
}
