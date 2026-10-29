/**
 * Deterministic client-side planner (phase-aware, bounded).
 *
 * 1. Filter: age, readiness, adults, curated pairings (hard), then the parent's
 *    energy/place/mode preferences. Food activities are never added on their
 *    own (a parent-placed meal block is different: it is a routine block).
 * 2. Keep what the parent placed (`keep`): routine blocks, locked and custom
 *    entries. The gaps of the main sequence lie between anchored entries inside
 *    [0, window). Each gap is filled in time order with a small look-ahead
 *    (depth 2 over the top few candidates), and every candidate is assessed at
 *    its actual start against each affected child's nearest routine events
 *    (blocks laid out by layout.ts plus momentary context). Applicable
 *    non-advisory `avoid` rules are never auto-scheduled.
 * 3. Phase preferences only rank (never exclude): active play earlier when a
 *    known nap is later and the energy setting allows it; settling, low-mess,
 *    low-tidy-up ideas toward a known nap; something gentle first after waking.
 *    No waiting period is ever inserted, and nothing is inferred from age, the
 *    clock, or the end of the window.
 * 4. Two children: the main sequence uses curated pairings only. During one
 *    child's routine block, the other child's free time is filled with that
 *    child's own activities when one adult can supervise them (alongFeasible),
 *    or left visibly open.
 * 5. Variety, place continuity, low setup, at most one outing and one screen
 *    option, sun/night rules, realistic durations, and flexible breaks at the
 *    youngest child's cadence in long stretches (never next to a routine block).
 *    Whatever can't be filled is shown as open time.
 *
 * Scoring is intentionally simple and readable; it is not an optimizer.
 */
import type { Activity, MixedAgeRecipe, Stimulation, StarterPlan } from '../content/schema.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { activityEligible, activityPasses, hash, recipeEligible, recipePasses, DEFAULT_FILTERS, type Filters, relaxations, type Relaxation } from './filters.ts';
import { recipeAssignment, days as ageDays } from './eligibility.ts';
import { adultStateAt, alongFeasible, analyzePlan, childLabel, childTimings, layoutPlan, type AdultState, type LaidOut } from './layout.ts';
import { BREAK_LABEL, kidInputs, MAX_SEGMENTS, newId, PLAN_VERSION, ROUTINE_LABEL, youngerFor, type Plan, type PlanKid, type PlanSegment, type PlanSettings } from './plan.ts';
import { reconcileSegments } from './reconcile.ts';
import { assessActivity, assessRecipe, momentTiming, NO_TIMING, spanOf, type ChildTiming, type EventSpan, type MomentContext, type Span, type TimingAssessment } from './timing.ts';
import { monthsToDays, formatAgeShort, toDays } from './age.ts';
import { cleanText, LIMITS } from './text.ts';
import { parseHHMM } from './time.ts';
import { activityProfile, recipeProfile, timeIssue, type OutdoorProfile } from './timeRules.ts';

export interface PlannerInput {
  kids: PlanKid[];
  settings: PlanSettings;
  window: number;
  seed?: number;
  /** Local start time (HH:MM); enables time-of-day rules such as midday sun for young babies. */
  start?: string;
  /** Entries to keep (routine blocks, locked and custom entries). The result holds these plus what was generated, in valid order. */
  keep?: PlanSegment[];
  /** Momentary context per child (0 = the plan's start). Used for ranking and exclusions only; never stored. */
  moment?: (MomentContext | undefined)[];
  /** Timing-aware choices (default true). False reproduces the timing-unaware planner, for before/after comparisons. */
  timing?: boolean;
}

export interface PlannerResult {
  segments: PlanSegment[];
  /** Wall-clock minutes inside the window left unscheduled (shown as open time). */
  open: number;
  /** Plain-language limits the parent should know about, one short line each. */
  notes: string[];
  /** When nothing fits: the limiting constraint and safe adjustments. */
  blocked?: { reason: string; relax: Relaxation[] };
}

export type Candidate = {
  kind: 'activity' | 'recipe';
  id: string;
  title: string;
  intents: readonly string[];
  goals: readonly string[];
  places: readonly string[];
  outing: boolean;
  media: boolean;
  /** Snacks and other food activities are never added automatically. */
  food: boolean;
  /** Tummy-time activity, or a pairing with tummy time in it. */
  tummy: boolean;
  profile: OutdoorProfile;
  effort: string;
  setup: number;
  cleanup: number;
  duration: { min: number; default: number; max: number };
  stimulation: Stimulation;
  mess: 'none' | 'low' | 'medium' | 'high';
  act?: Activity;
  rec?: MixedAgeRecipe;
};

const MESS_ORDER = ['none', 'low', 'medium', 'high'] as const;

const fromActivity = (a: Activity): Candidate => ({
  kind: 'activity',
  id: a.id,
  title: a.title,
  intents: a.intents,
  goals: a.goals,
  places: a.places,
  outing: a.outing,
  media: a.kind === 'media',
  food: a.hazards.includes('food'),
  tummy: Boolean(a.tummyTime),
  profile: activityProfile(a),
  effort: a.effort,
  setup: a.setupMinutes,
  cleanup: a.cleanupMinutes,
  duration: a.duration,
  stimulation: a.timing.stimulation,
  mess: a.mess,
  act: a,
});

const fromRecipe = (r: MixedAgeRecipe, c: IndexedCatalog): Candidate => {
  const acts = [c.activityById.get(r.younger.activity), c.activityById.get(r.older.activity)];
  const mess = acts.reduce((m, a) => Math.max(m, a ? MESS_ORDER.indexOf(a.mess) : 0), 0);
  return {
    kind: 'recipe',
    id: r.id,
    title: r.title,
    intents: r.intents,
    goals: acts.flatMap((a) => a?.goals ?? []),
    places: r.places,
    outing: r.outing,
    media: acts.some((a) => a?.kind === 'media'),
    food: acts.some((a) => a?.hazards.includes('food')),
    tummy: acts.some((a) => a?.tummyTime),
    profile: recipeProfile(r, acts[0]),
    effort: r.effort,
    setup: r.setupMinutes,
    cleanup: r.cleanupMinutes,
    duration: r.duration,
    stimulation: r.timing.stimulation,
    mess: MESS_ORDER[mess],
    rec: r,
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

/** One child's own activities (for alongside tracks and one-child slots in two-child plans). */
function childPool(c: IndexedCatalog, kids: PlanKid[], settings: PlanSettings, child: 0 | 1): Candidate[] {
  const input = kidInputs({ kids })[child];
  const f = filtersFromSettings(settings, null);
  return c.activities.filter((a) => activityEligible(a, input, settings.adults) && activityPasses(a, f)).map(fromActivity);
}

// ---------- Timing context ----------

const NAP_UNKNOWN_END = Number.POSITIVE_INFINITY;

/**
 * Per-child timing on the plan's axis: routine blocks plus momentary context.
 * A "nap soon" moment is used for ranking only and is never turned into a block:
 * at `napIn`, or with no time, at `napAt` (the end of the first gap). Its length
 * is unknown, so nothing after it is treated as "after waking".
 */
function withMoments(base: ChildTiming[], moments: readonly (MomentContext | undefined)[], napAt: number): ChildTiming[] {
  return base.map((t, i) => {
    const m = moments[i];
    if (!m || (!m.fed && !m.nap)) return t;
    const fromMoment = momentTiming(t.days, { fed: m.fed, fedAgo: m.fedAgo, nap: false });
    const events: EventSpan[] = [...t.events, ...fromMoment.events];
    if (m.nap) {
      const at = m.napIn != null && m.napIn >= 0 ? m.napIn : napAt;
      events.push({ event: 'nap', start: at, end: NAP_UNKNOWN_END });
    }
    return { days: t.days, events };
  });
}

/** Ranking nudges from the nearest known nap. Profile-based only for assessed (non-variable) records. */
function phaseScore(cand: Candidate, span: Span, lanes: readonly (0 | 1)[], timings: ChildTiming[], energy: PlanSettings['energy']): number {
  const known = cand.stimulation !== 'variable';
  const active = energy === 'plenty' || energy === 'some';
  let total = 0;
  for (const i of lanes) {
    const t = timings[i];
    if (!t) continue;
    let s = 0;
    let next = Infinity;
    let woke = -Infinity;
    for (const e of t.events) {
      if (e.event !== 'nap') continue;
      if (e.start >= span.start && e.start < next) next = e.start;
      if (e.end <= span.start && e.end > woke) woke = e.end;
    }
    if (next !== Infinity) {
      const until = next - span.end;
      if (until >= 0 && until <= 30) {
        // Winding down: calmer, less mess, little to set up or tidy away.
        if (known) s += cand.stimulation === 'settling' ? 8 : cand.stimulation === 'gentle' ? 4 : -8;
        s += cand.mess === 'none' || cand.mess === 'low' ? 1 : -4;
        s -= Math.min(4, cand.cleanup) + Math.min(3, Math.max(0, cand.setup - 1));
      } else if (until > 30 && active && known) {
        s += cand.stimulation === 'lively' ? 5 : cand.stimulation === 'gentle' ? 2 : 0;
      }
    }
    if (woke !== -Infinity && span.start - woke <= 20 && known) s += cand.stimulation === 'lively' ? -6 : 5;
    total += s;
  }
  return lanes.length ? total / lanes.length : 0;
}

// ---------- Plan assembly helpers ----------

const STAMP = '2026-01-01T00:00:00.000Z';

function scratchPlan(kids: PlanKid[], settings: PlanSettings, window: number, start: string | undefined, segments: PlanSegment[]): Plan {
  return { v: PLAN_VERSION, id: 'p-scratch', title: '', kids, start: start ?? '00:00', window, settings, segments, notes: '', createdAt: STAMP, updatedAt: STAMP };
}

/** Kept entries as groups (a main entry plus its alongside entries), stable-sorted by start. */
function orderKept(keep: PlanSegment[], kids: PlanKid[], c: IndexedCatalog): PlanSegment[] {
  if (keep.length < 2) return keep;
  const items = layoutPlan({ kids, segments: keep }, c);
  const groups: { start: number; segs: PlanSegment[] }[] = [];
  items.forEach((it) => {
    if (it.host !== null && groups.length) groups[groups.length - 1].segs.push(it.segment);
    else groups.push({ start: it.start, segs: [it.segment] });
  });
  return groups
    .map((g, i) => ({ ...g, i }))
    .sort((a, b) => a.start - b.start || a.i - b.i)
    .flatMap((g) => g.segs);
}

interface Placed {
  cand: Candidate;
  minutes: number;
  wall: number;
  span: Span;
  timing: TimingAssessment;
  score: number;
}

interface TrackState {
  last: Candidate | null;
  lastMinutes: number;
  /** No entry before this one in the whole plan (outings are nicest first). */
  first: boolean;
}

interface Track {
  pool: Candidate[];
  /** Children assessed: one child for activities, both for pairings. */
  lanes: (0 | 1)[];
  youngestDays: number;
  /** Alongside: which child the entry is for. */
  who?: 'c1' | 'c2';
  feasible?: (cand: Candidate, at: number) => boolean;
}

interface Gap {
  start: number;
  end: number;
  /** Kept index the generated entries go before; null = the end of the plan (or of a host's group, for tracks). */
  before: number | null;
}

const LOOKAHEAD = 5;
/** Cost of repeating an idea already in the plan: variety first, unless timing clearly favours the repeat. */
const REPEAT = 15;

type AvoidLog = { event: 'milk-feed' | 'meal' | 'nap'; when: 'before' | 'after'; tummy: boolean; moment: boolean };

const EVENT_WORD = { 'milk-feed': 'feed', meal: 'meal', nap: 'nap' } as const;

export function planWindow(c: IndexedCatalog, input: PlannerInput): PlannerResult {
  const { kids, settings, window } = input;
  const seed = input.seed ?? 0;
  const timingOn = input.timing !== false;
  const notes: string[] = [];
  const two = kids.length === 2;
  const inputs = kidInputs({ kids });
  const kidDays = inputs.map((k) => k.days);
  const youngest = Math.min(...kidDays);
  const { pool, eligibleCount, relax } = candidatesFor(c, kids, settings, window);

  const kept = orderKept((input.keep ?? []).slice(), kids, c);
  const items = layoutPlan({ kids, segments: kept }, c);

  // ---- Main-sequence gaps between anchored entries, inside [0, window) ----
  const gaps: Gap[] = [];
  {
    let t = 0;
    for (const it of items) {
      if (it.host !== null) continue;
      if (it.start > t && t < window) gaps.push({ start: t, end: Math.min(it.start, window), before: it.index });
      t = Math.max(t, it.end, ...items.filter((x) => x.host === it.index).map((x) => x.end));
    }
    if (t < window) gaps.push({ start: t, end: window, before: null });
  }

  const moments = timingOn ? (input.moment ?? []) : [];
  const timings = withMoments(childTimings({ kids }, items), moments, gaps[0]?.end ?? window);

  if (pool.length === 0 && kept.length === 0) {
    const ages = kids.map((k) => formatAgeShort(k.age)).join(' and ');
    const reason =
      eligibleCount === 0
        ? two
          ? `Trunk doesn’t have a curated activity that safely fits a ${ages} with ${settings.adults === 1 ? 'one adult' : 'two adults'} yet. Try planning for one child while the other sleeps or is with another adult.`
          : `No activities fit this age and readiness yet.`
        : `Your current choices rule out every option for a ${ages}.`;
    return { segments: [], open: window, notes, blocked: { reason, relax: eligibleCount ? relax() : [] } };
  }

  const cadence = breakCadence(youngest);
  const startClock = input.start ? parseHHMM(input.start) : null;
  const budget = Math.min(20, MAX_SEGMENTS - kept.length);
  let generatedCount = 0;
  const uses = new Map<string, number>();
  let usedOuting = false;
  let usedMedia = false;
  let skippedForSun = false;
  let skippedForNight = false;
  const avoided: AvoidLog[] = [];
  const momentFed = moments.map((m) => Boolean(m?.fed));

  // What the parent already placed counts toward variety and the outing/screen limits.
  for (const s of kept) {
    const a = s.kind === 'activity' ? c.activityById.get(s.ref ?? '') : undefined;
    const r = s.kind === 'recipe' ? c.recipeById.get(s.ref ?? '') : undefined;
    const cand = a ? fromActivity(a) : r ? fromRecipe(r, c) : null;
    if (!cand) continue;
    uses.set(cand.id, (uses.get(cand.id) ?? 0) + 1);
    usedOuting ||= cand.outing;
    usedMedia ||= cand.media;
  }

  const youngerIdx = new Map<string, 0 | 1>();
  if (two) for (const p of pool) if (p.rec) youngerIdx.set(p.id, recipeAssignment(p.rec, inputs[0], inputs[1]) === 1 ? 1 : 0);

  const assess = (cand: Candidate, span: Span, track: Track): TimingAssessment => {
    if (cand.act) return assessActivity(c, cand.act, span, timings[track.lanes[0]], track.lanes[0]);
    if (cand.rec && two) return assessRecipe(c, cand.rec, span, [timings[0], timings[1]], youngerIdx.get(cand.id) ?? 0);
    return NO_TIMING;
  };

  const baseScore = (cand: Candidate, minutes: number, room: number, ts: TrackState): number => {
    let s = 20;
    if ((uses.get(cand.id) ?? 0) > 0) s -= REPEAT;
    const last = ts.last;
    if (last) {
      if (cand.intents[0] === last.intents[0]) s -= 8;
      if (cand.goals.some((g) => last.goals.includes(g))) s -= 3;
      // Stay in the same place; an abrupt indoor/outdoor switch costs a little.
      s += cand.places.some((pl) => last.places.includes(pl)) ? 3 : -3;
      // Avoid strings of very short activities.
      if (minutes < 5 && ts.lastMinutes < 5) s -= 4;
    }
    if (cand.outing) s += ts.first && window >= 60 ? 4 : -2;
    if ((settings.energy === 'low' || settings.energy === 'busy') && cand.effort === 'low') s += 3;
    if (cand.media) s -= 10;
    if (cand.setup + cand.duration.default + cand.cleanup > room) s -= 4;
    // Unnecessary setup and tidy-up.
    s -= Math.min(4, Math.max(0, cand.setup + cand.cleanup - 3));
    return s + (hash(`${seed}:${cand.id}`) % 6);
  };

  const evaluate = (cand: Candidate, at: number, room: number, track: Track, ts: TrackState, quiet: boolean): Placed | null => {
    if (cand.food) return null;
    if (cand.outing && usedOuting) return null;
    if (cand.media && usedMedia) return null;
    if (ts.last && ts.last.id === cand.id) return null;
    const overhead = cand.setup + cand.cleanup;
    if (overhead + cand.duration.min > room) return null;
    const minutes = Math.max(cand.duration.min, Math.min(cand.duration.default, cand.duration.max, room - overhead));
    const wall = overhead + minutes;
    if (startClock !== null) {
      const issue = timeIssue(cand.profile, startClock + at, wall, track.youngestDays, settings.place);
      if (issue) {
        if (!quiet && issue === 'sun') skippedForSun = true;
        if (!quiet && issue === 'night') skippedForNight = true;
        return null;
      }
    }
    if (track.feasible && !track.feasible(cand, at)) return null;
    const span = spanOf(at, cand.setup, minutes, cand.cleanup);
    let timing = NO_TIMING;
    let phase = 0;
    if (timingOn) {
      timing = assess(cand, span, track);
      if (timing.avoid) {
        if (!quiet) {
          for (const f of timing.findings) {
            if (f.fit !== 'avoid' || f.advisory) continue;
            avoided.push({ event: f.event, when: f.when, tummy: cand.tummy, moment: f.event !== 'nap' && f.when === 'after' && momentFed[f.child] === true });
          }
        }
        return null;
      }
      phase = phaseScore(cand, span, track.lanes, timings, settings.energy);
    }
    return { cand, minutes, wall, span, timing, score: baseScore(cand, minutes, room, ts) + timing.score + phase };
  };

  /** Every idea that fits here. An idea appears at most twice, never back to back, and a repeat costs REPEAT. */
  const options = (at: number, room: number, track: Track, ts: TrackState, quiet: boolean): Placed[] => {
    const out: Placed[] = [];
    for (const cand of track.pool) {
      if ((uses.get(cand.id) ?? 0) >= 2) continue;
      const p = evaluate(cand, at, room, track, ts, quiet);
      if (p) out.push(p);
    }
    return out;
  };

  const byScore = (a: Placed, b: Placed) => b.score - a.score || (a.cand.id < b.cand.id ? -1 : a.cand.id > b.cand.id ? 1 : 0);

  const commit = (p: Placed, ts: TrackState) => {
    uses.set(p.cand.id, (uses.get(p.cand.id) ?? 0) + 1);
    usedOuting ||= p.cand.outing;
    usedMedia ||= p.cand.media;
    ts.last = p.cand;
    ts.lastMinutes = p.minutes;
    ts.first = false;
  };

  /** Depth-2 look-ahead over the top candidates: how good is this choice, and what does it leave room for? */
  const choose = (first: Placed[], at: number, room: number, track: Track, ts: TrackState): Placed => {
    const ranked = [...first].sort(byScore).slice(0, LOOKAHEAD);
    let best = ranked[0];
    let bestValue = -Infinity;
    for (const o of ranked) {
      const saved = { uses: uses.get(o.cand.id), usedOuting, usedMedia };
      const next: TrackState = { ...ts };
      commit(o, next);
      const room2 = room - o.wall;
      const second = room2 > 0 ? options(at + o.wall, room2, track, next, true) : [];
      if (saved.uses === undefined) uses.delete(o.cand.id);
      else uses.set(o.cand.id, saved.uses);
      usedOuting = saved.usedOuting;
      usedMedia = saved.usedMedia;
      const follow = second.length ? Math.max(...second.map((x) => x.score)) : -Math.min(8, Math.max(0, room2) / 3);
      const value = o.score + 0.5 * follow;
      if (value > bestValue) {
        best = o;
        bestValue = value;
      }
    }
    return best;
  };

  const toSegment = (p: Placed, track: Track): PlanSegment => {
    if (p.cand.kind === 'recipe') return { id: newId('r'), kind: 'recipe', ref: p.cand.id, minutes: p.minutes, younger: youngerFor(p.cand.id, { kids }, c) };
    const seg: PlanSegment = { id: newId('a'), kind: 'activity', ref: p.cand.id, minutes: p.minutes };
    if (two) seg.who = track.who ?? 'c1';
    if (track.who) seg.along = true;
    return seg;
  };

  const smallest = pool.length ? Math.min(...pool.map((p) => p.setup + p.duration.min + p.cleanup)) : Infinity;

  const fill = (gap: Gap, track: Track, ts: TrackState, carry: { sinceBreak: number } | null): PlanSegment[] => {
    const out: PlanSegment[] = [];
    let at = gap.start;
    let placed = 0;
    while (generatedCount < budget) {
      const room = gap.end - at;
      if (room <= 0) break;
      if (carry && placed > 0 && carry.sinceBreak >= cadence.every && room >= cadence.length + smallest) {
        out.push({ id: newId('b'), kind: 'break', minutes: cadence.length, label: BREAK_LABEL });
        generatedCount++;
        at += cadence.length;
        carry.sinceBreak = 0;
        continue;
      }
      const first = options(at, room, track, ts, false);
      if (!first.length) break;
      const pick = choose(first, at, room, track, ts);
      out.push(toSegment(pick, track));
      generatedCount++;
      placed++;
      commit(pick, ts);
      at += pick.wall;
      if (carry) carry.sinceBreak += pick.wall;
    }
    // A break never ends a stretch: it would sit next to a routine block or end the plan.
    while (out.length && out[out.length - 1].kind === 'break') {
      out.pop();
      generatedCount--;
    }
    return out;
  };

  const insertBefore = new Map<number, PlanSegment[]>();
  const appendToGroup = new Map<number, PlanSegment[]>();
  const tail: PlanSegment[] = [];
  const generated = new Set<PlanSegment>();
  const put = (map: Map<number, PlanSegment[]>, key: number, segs: PlanSegment[]) => {
    if (!segs.length) return;
    map.set(key, [...(map.get(key) ?? []), ...segs]);
    segs.forEach((s) => generated.add(s));
  };

  // ---- Main sequence ----
  if (pool.length) {
    const main: Track = { pool, lanes: two ? [0, 1] : [0], youngestDays: youngest };
    const ts: TrackState = { last: null, lastMinutes: 0, first: true };
    const carry = { sinceBreak: 0 };
    let gi = 0;
    for (const it of [...items.filter((x) => x.host === null), null]) {
      // Fill the gap that ends at this kept entry (or at the window's end).
      while (gi < gaps.length && (it === null || gaps[gi].before === it.index)) {
        const gap = gaps[gi++];
        const segs = fill(gap, main, ts, carry);
        if (gap.before === null) {
          tail.push(...segs);
          segs.forEach((s) => generated.add(s));
        } else put(insertBefore, gap.before, segs);
      }
      if (!it) break;
      const s = it.segment;
      ts.first = false;
      if (s.kind === 'routine' || s.kind === 'break') {
        carry.sinceBreak = 0;
        ts.last = null;
      } else {
        carry.sinceBreak += it.wall;
        const a = s.kind === 'activity' ? c.activityById.get(s.ref ?? '') : undefined;
        const r = s.kind === 'recipe' ? c.recipeById.get(s.ref ?? '') : undefined;
        ts.last = a ? fromActivity(a) : r ? fromRecipe(r, c) : null;
        ts.lastMinutes = s.minutes;
      }
    }
  }

  // ---- Alongside tracks: the other child's free time during a one-child routine block ----
  const childPools: (Candidate[] | null)[] = [null, null];
  if (two) {
    for (const h of items) {
      const hs = h.segment;
      if (hs.kind !== 'routine' || h.host !== null || (hs.who !== 'c1' && hs.who !== 'c2')) continue;
      const other: 0 | 1 = hs.who === 'c1' ? 1 : 0;
      const who = other === 0 ? 'c1' : 'c2';
      const trackStart = h.start + (hs.routine === 'nap' && !hs.holding ? (hs.settle ?? 0) : 0);
      const sub: Gap[] = [];
      let t = trackStart;
      for (const x of items.filter((y) => y.host === h.index)) {
        if (x.start > t && t < h.end) sub.push({ start: t, end: Math.min(x.start, h.end), before: x.index });
        t = Math.max(t, x.end);
      }
      if (t < h.end) sub.push({ start: t, end: h.end, before: null });
      if (!sub.length) continue;
      childPools[other] ??= childPool(c, kids, settings, other);
      const track: Track = {
        pool: childPools[other]!,
        lanes: [other],
        youngestDays: kidDays[other],
        who,
        feasible: (cand, at) =>
          alongFeasible({ id: 'x', kind: 'activity', ref: cand.id, minutes: cand.duration.min, who, along: true }, cand.act, hs, adultStateAt(hs, h.start, at), settings.adults).ok,
      };
      const ts: TrackState = { last: null, lastMinutes: 0, first: false };
      let open = 0;
      for (const g of sub) {
        const segs = fill(g, track, ts, null);
        if (g.before === null) put(appendToGroup, h.index, segs);
        else put(insertBefore, g.before, segs);
        const used = segs.reduce((m, s) => m + s.minutes + overheadOf(s, c), 0);
        open += Math.max(0, g.end - g.start - used);
      }
      if (open >= 5) {
        const state: AdultState = adultStateAt(hs, h.start, trackStart);
        const routine = (hs.routine ? ROUTINE_LABEL[hs.routine] : 'routine').toLowerCase();
        const host = childLabel(hs.who);
        const kid = childLabel(who);
        if (settings.adults === 1 && state === 'undivided') notes.push(`${kid}’s time during ${host}’s ${routine} is left open: it needs your full attention with one adult.`);
        else if (settings.adults === 1 && hs.routine === 'nap' && !hs.holding && hs.settle === undefined) notes.push(`Add your settling time to ${host}’s nap to see more for ${kid} alongside it.`);
        else notes.push(`${open} min of ${kid}’s time during ${host}’s ${routine} is left open.`);
      }
    }
  }

  // ---- Assemble in valid order ----
  let segments: PlanSegment[] = [];
  const groupEnd = (i: number) => {
    let e = i + 1;
    while (e < kept.length && kept[e].along) e++;
    return e;
  };
  const ends = new Map<number, number>();
  kept.forEach((s, i) => {
    if (!s.along && s.kind === 'routine') ends.set(groupEnd(i) - 1, i);
  });
  kept.forEach((s, i) => {
    segments.push(...(insertBefore.get(i) ?? []), s);
    const host = ends.get(i);
    if (host !== undefined) segments.push(...(appendToGroup.get(host) ?? []));
  });
  segments.push(...tail);

  // Safety net: a generated entry never causes an overlap or overrun (it would be a bug); drop it if it does.
  let analysis = analyzePlan(scratchPlan(kids, settings, window, input.start, segments), c);
  for (let guard = 0; guard < 6; guard++) {
    const bad = analysis.conflicts.find((x) => (x.kind === 'overlap' || x.kind === 'along-overrun') && generated.has(segments[x.index]));
    if (!bad) break;
    segments = segments.filter((_, i) => i !== bad.index);
    analysis = analyzePlan(scratchPlan(kids, settings, window, input.start, segments), c);
  }
  const open = analysis.open;
  const made = segments.filter((s) => generated.has(s));

  // ---- Notes: short plain lines ----
  const feedAvoid = avoided.filter((a) => a.event === 'milk-feed' || a.event === 'meal');
  if (feedAvoid.some((a) => a.tummy)) {
    notes.unshift(feedAvoid.some((a) => a.tummy && a.moment) ? 'Tummy time kept away from the feed you just finished.' : 'Tummy time kept away from the feed.');
  }
  for (const ev of ['milk-feed', 'meal', 'nap'] as const) {
    if (avoided.some((a) => a.event === ev && !a.tummy)) notes.push(`Some ideas left out right around the ${EVENT_WORD[ev]}.`);
  }
  for (const [i, m] of moments.entries()) {
    if (m?.nap && m.napIn != null && m.napIn >= 0 && m.napIn < window) {
      notes.push(`${two ? childLabel(i === 0 ? 'c1' : 'c2') + '’s' : 'The'} nap isn’t in the plan. Add it as a block to keep that time free.`);
    }
  }
  if (open > 0 && made.length > 0) notes.push(`${open} min left open. Activities aren't stretched past what's realistic for this age.`);
  if (skippedForNight) notes.push('Outdoor-only ideas are left out between 8 p.m. and 6 a.m.');
  if (skippedForSun) notes.push('Outdoor time for babies under 6 months is kept out of 10 a.m.–4 p.m., following AAP sun-safety guidance.');
  if (youngest < monthsToDays(3)) notes.push('Young babies may need to feed or sleep at any point. Stop the plan whenever they do.');

  const result: PlannerResult = { segments, open, notes: [...new Set(notes)] };
  if (!pool.length) {
    const ages = kids.map((k) => formatAgeShort(k.age)).join(' and ');
    result.blocked = {
      reason: eligibleCount === 0 ? `Nothing in Trunk fits a ${ages} together with ${settings.adults === 1 ? 'one adult' : 'two adults'} yet; your own entries are kept.` : `Your current choices rule out every option for a ${ages}.`,
      relax: eligibleCount ? relax() : [],
    };
  }
  return result;
}

function overheadOf(s: PlanSegment, c: IndexedCatalog): number {
  if (s.kind === 'activity') {
    const a = c.activityById.get(s.ref ?? '');
    return a ? a.setupMinutes + a.cleanupMinutes : 0;
  }
  if (s.kind === 'recipe') {
    const r = c.recipeById.get(s.ref ?? '');
    return r ? r.setupMinutes + r.cleanupMinutes : 0;
  }
  return 0;
}

// ---------- Fill around the parent's blocks ----------

/**
 * "Fill around these blocks": keeps routine blocks, locked entries, and custom
 * entries (a floating custom entry is pinned at its current start with `at`),
 * removes the other unlocked activities, pairings, and breaks, then fills the
 * gaps. Never adds a routine block.
 */
export function fillAround(c: IndexedCatalog, plan: Plan, opts: { seed?: number; moment?: (MomentContext | undefined)[] } = {}): { plan: Plan; result: PlannerResult } {
  const items = layoutPlan(plan, c);
  const keep: PlanSegment[] = [];
  plan.segments.forEach((s, i) => {
    if (s.kind === 'routine' || s.locked) keep.push(s);
    else if (s.kind === 'custom') keep.push(s.at !== undefined ? s : { ...s, at: Math.max(0, Math.min(1439, items[i].start)) });
  });
  const result = planWindow(c, { kids: plan.kids, settings: plan.settings, window: plan.window, seed: opts.seed, start: plan.start, keep, moment: opts.moment });
  return { plan: { ...plan, segments: result.segments, updatedAt: new Date().toISOString() }, result };
}

// ---------- Options for one slot (swap, add alongside, add at the end) ----------

export interface SlotOption {
  kind: 'activity' | 'recipe';
  id: string;
  title: string;
  /** Suggested engagement minutes for this slot. */
  minutes: number;
  /** For activities in two-child plans: which child it's for. */
  who?: 'c1' | 'c2';
  timing: TimingAssessment;
}

/**
 * Ranked ideas for one place in a plan.
 * - `replace`: alternatives for that entry, at that entry's time, for the same child(ren).
 * - `host`: ideas for the OTHER child alongside the routine block at that index, that one
 *   adult can supervise in the adult state at the track's next free start.
 * - neither: ideas to add at the end of the main sequence (two children: curated pairings only).
 * Applicable non-advisory timing avoids, food activities, a second outing, sun/night
 * clashes, and ideas already in the plan are left out. Ranked by timing, then variety.
 */
export function optionsForSlot(c: IndexedCatalog, plan: Plan, slot: { replace?: number; host?: number }, seed = 0): SlotOption[] {
  const items = layoutPlan(plan, c);
  const two = plan.kids.length === 2;
  const inputs = kidInputs(plan);
  const timings = childTimings(plan, items);
  const used = new Set(plan.segments.map((s) => s.ref).filter((r): r is string => Boolean(r)));
  const startClock = parseHHMM(plan.start);
  const youngest = Math.min(...inputs.map((k) => k.days));

  let at: number;
  let room = Infinity;
  let lane: 0 | 1 | null = two ? null : 0;
  let feasible: ((cand: Candidate, at: number) => boolean) | null = null;
  let ignore = -1;
  let prev: Candidate | null = null;
  let next: Candidate | null = null;
  const candOf = (s: PlanSegment | undefined): Candidate | null => {
    if (!s) return null;
    const a = s.kind === 'activity' ? c.activityById.get(s.ref ?? '') : undefined;
    const r = s.kind === 'recipe' ? c.recipeById.get(s.ref ?? '') : undefined;
    return a ? fromActivity(a) : r ? fromRecipe(r, c) : null;
  };
  const hostFeasible = (h: LaidOut, who: 'c1' | 'c2') => (cand: Candidate, t: number) =>
    alongFeasible({ id: 'x', kind: 'activity', ref: cand.id, minutes: cand.duration.min, who, along: true }, cand.act, h.segment, adultStateAt(h.segment, h.start, t), plan.settings.adults).ok;

  if (slot.replace !== undefined) {
    const it = items[slot.replace];
    if (!it || it.segment.kind === 'routine') return [];
    const seg = it.segment;
    ignore = it.index;
    at = it.start;
    if (it.host !== null) {
      const h = items[it.host];
      const who = seg.who === 'c2' ? 'c2' : 'c1';
      lane = who === 'c1' ? 0 : 1;
      feasible = hostFeasible(h, who);
      const track = items.filter((x) => x.host === h.index);
      const anchor = track.find((x) => x.index > it.index && x.anchored);
      const boundary = anchor ? anchor.start : h.end;
      const prevEnd = Math.max(it.end, ...track.filter((x) => x.index < (anchor?.index ?? Infinity)).map((x) => x.end));
      room = it.wall + Math.max(0, boundary - prevEnd);
      const pos = track.indexOf(it);
      prev = candOf(track[pos - 1]?.segment);
      next = candOf(track[pos + 1]?.segment);
    } else {
      if (seg.kind === 'activity' && two) lane = seg.who === 'c2' ? 1 : 0;
      else if (seg.kind === 'recipe') lane = null;
      const anchor = items.find((x) => x.host === null && x.index > it.index && x.anchored);
      if (anchor) {
        const prevEnd = Math.max(...items.filter((x) => x.index < anchor.index).map((x) => x.end));
        room = it.wall + Math.max(0, anchor.start - prevEnd);
      }
      const main = items.filter((x) => x.host === null);
      const pos = main.indexOf(it);
      prev = candOf(main[pos - 1]?.segment);
      next = candOf(main[pos + 1]?.segment);
    }
  } else if (slot.host !== undefined) {
    const h = items[slot.host];
    if (!two || !h || h.host !== null || h.segment.kind !== 'routine' || (h.segment.who !== 'c1' && h.segment.who !== 'c2')) return [];
    const who = h.segment.who === 'c1' ? 'c2' : 'c1';
    lane = who === 'c1' ? 0 : 1;
    const track = items.filter((x) => x.host === h.index);
    const settle = h.segment.routine === 'nap' && !h.segment.holding ? (h.segment.settle ?? 0) : 0;
    at = Math.max(h.start + settle, ...track.map((x) => x.end));
    room = h.end - at;
    if (room <= 0) return [];
    feasible = hostFeasible(h, who);
    prev = candOf(track[track.length - 1]?.segment);
  } else {
    const end = items.reduce((m, it) => Math.max(m, it.end), 0);
    at = end;
    const left = plan.window - end;
    room = Infinity;
    const main = items.filter((x) => x.host === null);
    prev = candOf(main[main.length - 1]?.segment);
    // Suggest lengths that fit what's left of the window, when something can.
    if (left > 0) room = left;
  }

  const pool: Candidate[] = lane === null ? candidatesFor(c, plan.kids, plan.settings, null).pool : two ? childPool(c, plan.kids, plan.settings, lane) : candidatesFor(c, plan.kids, plan.settings, null).pool;
  const otherOuting = plan.segments.some((s, i) => i !== ignore && candOf(s)?.outing);
  const otherMedia = plan.segments.some((s, i) => i !== ignore && candOf(s)?.media);
  const younger = (r: MixedAgeRecipe): 0 | 1 => (recipeAssignment(r, inputs[0], inputs[1]) === 1 ? 1 : 0);
  const lanes: (0 | 1)[] = lane === null ? [0, 1] : [lane];
  const ageForTime = lane === null ? youngest : inputs[lane].days;

  const scored: { opt: SlotOption; rank: number; variety: number }[] = [];
  for (const cand of pool) {
    if (used.has(cand.id) || cand.food) continue;
    if (cand.outing && otherOuting) continue;
    if (cand.media && otherMedia) continue;
    const overhead = cand.setup + cand.cleanup;
    let minutes = cand.duration.default;
    if (Number.isFinite(room)) {
      if (overhead + cand.duration.min > room) {
        // Appending past the window is allowed (it shows as an overrun); a slot between blocks is not.
        if (slot.replace !== undefined || slot.host !== undefined) continue;
      } else minutes = Math.min(minutes, room - overhead);
    }
    minutes = Math.max(cand.duration.min, Math.min(cand.duration.max, minutes));
    const wall = overhead + minutes;
    if (timeIssue(cand.profile, startClock + at, wall, ageForTime, plan.settings.place)) continue;
    if (feasible && !feasible(cand, at)) continue;
    const span = spanOf(at, cand.setup, minutes, cand.cleanup);
    const timing = cand.act
      ? assessActivity(c, cand.act, span, timings[lanes[0]], lanes[0])
      : cand.rec && two
        ? assessRecipe(c, cand.rec, span, [timings[0], timings[1]], younger(cand.rec))
        : NO_TIMING;
    if (timing.avoid) continue;
    let variety = 20 + (hash(`${seed}:${cand.id}`) % 6);
    if (prev && cand.intents[0] === prev.intents[0]) variety -= 8;
    if (next && cand.intents[0] === next.intents[0]) variety -= 4;
    if (prev) variety += cand.places.some((p) => prev!.places.includes(p)) ? 3 : -3;
    variety -= Math.min(4, Math.max(0, overhead - 3));
    const opt: SlotOption = { kind: cand.kind, id: cand.id, title: cand.title, minutes, timing };
    if (cand.kind === 'activity' && two) opt.who = lane === 1 ? 'c2' : 'c1';
    scored.push({ opt, rank: timing.score + phaseScore(cand, span, lanes, timings, plan.settings.energy), variety });
  }
  return scored.sort((a, b) => b.rank - a.rank || b.variety - a.variety || a.opt.id.localeCompare(b.opt.id)).map((s) => s.opt);
}

/** Ranked alternatives for one slot, excluding what's already in the plan. Kept for older callers; prefer optionsForSlot. */
export function alternativesFor(c: IndexedCatalog, kids: PlanKid[], settings: PlanSettings, exclude: readonly string[], seed = 0): Candidate[] {
  const { pool } = candidatesFor(c, kids, settings, null);
  return pool
    .filter((p) => !exclude.includes(p.id) && !p.food)
    .sort((a, b) => (hash(`${seed}:${b.id}`) % 97) - (hash(`${seed}:${a.id}`) % 97) || a.id.localeCompare(b.id));
}

// ---------- Starter plans ----------

const STARTER_SETTINGS: PlanSettings = { energy: 'plenty', place: 'any', mode: 'either', adults: 1 };

/**
 * Turn a starter plan into this parent's segments. A starter's `who` (c1/c2)
 * refers to the order of `sp.ages`; it is mapped to the parent's children by
 * age (younger ↔ younger), so a reversed child order still works. Routine
 * times (`at`) carry over. Everything then goes through reconcileSegments.
 */
export function starterToSegments(
  sp: StarterPlan,
  kids: PlanKid[],
  c: IndexedCatalog,
  settings: PlanSettings = STARTER_SETTINGS,
): { segments: PlanSegment[]; dropped: { label: string; reason: string }[]; changed: { label: string; reason: string }[] } {
  let swap = false;
  if (sp.ages.length === 2 && kids.length === 2) {
    const [s0, s1] = sp.ages.map(ageDays);
    const [k0, k1] = kids.map((k) => toDays(k.age));
    swap = s0 !== s1 && k0 !== k1 && s0 < s1 !== k0 < k1;
  }
  const map = <T extends 'c1' | 'c2' | 'both'>(w: T): T => (swap ? ((w === 'c1' ? 'c2' : w === 'c2' ? 'c1' : w) as T) : w);
  const segs = sp.segments.map((s): PlanSegment => {
    switch (s.kind) {
      case 'break':
        return { id: newId('b'), kind: 'break', minutes: s.minutes, label: s.label ? cleanText(s.label, LIMITS.custom) || BREAK_LABEL : BREAK_LABEL };
      case 'routine':
        return { id: newId('n'), kind: 'routine', minutes: s.minutes, who: map(s.who), routine: s.routine, at: Math.min(1439, s.at) };
      case 'activity': {
        const seg: PlanSegment = { id: newId('a'), kind: 'activity', ref: s.ref, minutes: s.minutes };
        if (s.who) seg.who = map(s.who);
        if (s.along) seg.along = true;
        return seg;
      }
      case 'recipe':
        return { id: newId('r'), kind: 'recipe', ref: s.ref, minutes: s.minutes };
    }
  });
  const r = reconcileSegments(kids, settings, segs, c);
  return { segments: r.segments, dropped: r.dropped, changed: r.changed };
}
