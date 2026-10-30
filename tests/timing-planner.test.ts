/**
 * Phase-aware planner, finder timing, slot options, sequence notes, and interval
 * boundaries. Fixture catalogs only (tests/helpers.ts timingFixture and the
 * feed-nap scenario), so nothing here depends on real-catalog titles or order.
 */
import { describe, expect, it } from 'vitest';
import type { Activity, StarterPlan } from '../src/content/schema.ts';
import { catalog as realCatalog } from '../src/content/catalog.ts';
import { DEFAULT_FILTERS, findIdeas, rankActivities, activityEligible, activityPasses, type Filters } from '../src/lib/filters.ts';
import { analyzePlan, layoutPlan, timeline, type PlanAnalysis } from '../src/lib/layout.ts';
import { Plan, PLAN_VERSION, type PlanKid, type PlanSegment, type PlanSettings } from '../src/lib/plan.ts';
import { setMinutes, updateEntry } from '../src/lib/planEdit.ts';
import { childStimulation, fillAround, optionsForSlot, planWindow, starterToSegments } from '../src/lib/planner.ts';
import { sequenceNote } from '../src/lib/sequence.ts';
import { defaultPlanTitle } from '../src/lib/planTitle.ts';
import { isBusyNearbyCompatible } from '../src/lib/supervision.ts';
import { assessActivity, momentTiming, spanOf, type MomentContext } from '../src/lib/timing.ts';
import { toDays } from '../src/lib/age.ts';
import { checkRules, loadScenario } from '../scripts/planner-sequence.ts';
import { fixtureCatalog, fixturePolicies, timingFixture, timingRule } from './helpers.ts';

const { c, ids } = timingFixture();
const settings: PlanSettings = { energy: 'some', place: 'indoors', mode: 'either', adults: 1 };
const kid = (value: number, unit: 'w' | 'm' = 'm'): PlanKid => ({ age: { value, unit }, notYet: [] });
const infant = kid(4);
const toddler = kid(28);
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const stamp = '2026-10-29T10:00:00.000Z';

function planOf(kids: PlanKid[], segments: PlanSegment[], patch: Partial<Plan> = {}): Plan {
  return { v: PLAN_VERSION, id: 'p-test-1', title: '', kids, start: '10:00', window: 120, settings, segments, notes: '', createdAt: stamp, updatedAt: stamp, ...patch };
}
const routine = (id: string, type: 'nap' | 'milk-feed' | 'meal' | 'snack', who: 'c1' | 'c2' | 'both', minutes: number, at: number, extra: Partial<PlanSegment> = {}): PlanSegment => ({
  id,
  kind: 'routine',
  minutes,
  who,
  routine: type,
  at,
  ...extra,
});
const stimOf = (s: PlanSegment) => (s.kind === 'activity' ? c.activityById.get(s.ref ?? '')?.timing.stimulation : s.kind === 'recipe' ? c.recipeById.get(s.ref ?? '')?.timing.stimulation : undefined);
const plays = (a: PlanAnalysis) => a.entries.filter((e) => e.item.segment.kind === 'activity' || e.item.segment.kind === 'recipe');
const strip = (segs: PlanSegment[]) => segs.map(({ id: _id, ...rest }) => (void _id, rest));
const hardConflicts = (a: PlanAnalysis) => a.conflicts.filter((x) => x.severity === 'conflict');

describe('durations', () => {
  it.each([10, 20, 30, 90])('a %i-minute window is planned inside its window, with the rest shown as open time', (w) => {
    for (const kids of [[infant], [toddler], [infant, toddler], [toddler, infant]]) {
      const r = planWindow(c, { kids, settings, window: w, seed: 1 });
      const a = analyzePlan(planOf(kids, r.segments, { window: w }), c);
      expect(a.overrun).toBe(0);
      expect(a.end).toBeLessThanOrEqual(w);
      expect(a.busy + r.open).toBe(w);
      expect(hardConflicts(a)).toEqual([]);
      if (w === 30) expect(a.busy).toBeLessThanOrEqual(30);
    }
  });

  it('never stretches an activity past its maximum or below its minimum', () => {
    for (const seed of SEEDS) {
      for (const s of planWindow(c, { kids: [toddler], settings, window: 240, seed }).segments) {
        const a = c.activityById.get(s.ref ?? '');
        if (a) expect(s.minutes).toBeGreaterThanOrEqual(a.duration.min);
        if (a) expect(s.minutes).toBeLessThanOrEqual(a.duration.max);
      }
    }
  });

  it('stays fast on a 12-hour window with several anchors (real catalog and fixture)', () => {
    const keep = [
      routine('f1', 'milk-feed', 'c1', 20, 0),
      routine('m1', 'meal', 'c2', 30, 150),
      routine('n1', 'nap', 'c1', 90, 240, { settle: 10 }),
      routine('n2', 'nap', 'c2', 60, 420),
      routine('s1', 'snack', 'both', 15, 600),
    ];
    for (const cat of [realCatalog, c]) {
      for (const kids of [[kid(8)], [kid(8), toddler]]) {
        const k = kids.length === 1 ? keep.filter((x) => x.who !== 'c2').map((x) => ({ ...x, who: 'c1' as const })) : keep;
        const t0 = performance.now();
        const r = planWindow(cat, { kids, settings: { ...settings, energy: 'plenty', place: 'any' }, window: 720, seed: 3, start: '07:00', keep: k });
        const ms = performance.now() - t0;
        expect(ms).toBeLessThan(100);
        const a = analyzePlan(planOf(kids, r.segments, { window: 720, start: '07:00', settings: { ...settings, energy: 'plenty', place: 'any' } }), cat);
        expect(a.conflicts.filter((x) => x.kind === 'overlap' || x.kind === 'along-overrun')).toEqual([]);
        expect(a.entries.filter((e) => e.timing.avoid)).toEqual([]);
        expect(r.segments.length).toBeLessThanOrEqual(24);
      }
    }
  });
});

describe('post-feed windows', () => {
  const feedEnd = 20;
  it('never auto-schedules tummy time (or an infant-only avoid) in the 30 minutes after a feed, even across a break', () => {
    for (const seed of SEEDS) {
      for (const keep of [
        [routine('f1', 'milk-feed', 'c1', 20, 0)],
        [routine('f1', 'milk-feed', 'c1', 20, 0), { id: 'c1', kind: 'custom', minutes: 5, label: 'Burp and change', at: 20 } as PlanSegment],
      ]) {
        const r = planWindow(c, { kids: [infant], settings, window: 120, seed, keep });
        const a = analyzePlan(planOf([infant], r.segments), c);
        expect(a.entries.filter((e) => e.timing.avoid)).toEqual([]);
        for (const e of plays(a)) {
          if (e.item.segment.ref === ids['Tummy mat'] || e.item.segment.ref === ids['Dance party']) {
            expect(e.item.engageStart).toBeGreaterThanOrEqual(feedEnd + 30);
          }
        }
        expect(r.notes).toContain('Tummy time kept away from the feed.');
      }
    }
  });

  it('still offers tummy time once the window has passed', () => {
    const found = SEEDS.some((seed) => planWindow(c, { kids: [infant], settings, window: 120, seed, keep: [routine('f1', 'milk-feed', 'c1', 20, 0)] }).segments.some((s) => s.ref === ids['Tummy mat']));
    expect(found).toBe(true);
  });

  it('a toddler in a two-child plan does not inherit an infant-only rule', () => {
    for (const kids of [[infant, toddler], [toddler, infant]]) {
      const baby = kids[0] === infant ? 'c1' : 'c2';
      const p = planOf(kids, [routine('f1', 'milk-feed', 'both', 20, 0), routine('n1', 'nap', baby, 60, 20, { settle: 0 })]);
      const forToddler = optionsForSlot(c, p, { host: 1 });
      expect(forToddler.map((o) => o.id)).toContain(ids['Dance party']);
      expect(forToddler.find((o) => o.id === ids['Dance party'])?.timing.avoid).toBe(false);
      // The baby, right after the same feed, is kept away from it.
      const babyOnly = planOf([infant], [routine('f1', 'milk-feed', 'c1', 20, 0)]);
      expect(optionsForSlot(c, babyOnly, {}).map((o) => o.id)).not.toContain(ids['Dance party']);
      const r = planWindow(c, { kids, settings, window: 120, seed: 2, keep: p.segments });
      const a = analyzePlan(planOf(kids, r.segments), c);
      expect(a.entries.filter((e) => e.timing.avoid)).toEqual([]);
    }
  });
});

describe('nap preparation', () => {
  const napKeep = [routine('n1', 'nap', 'c1', 60, 60)];

  it('makes what comes right before a parent’s nap calmer, without moving the nap', () => {
    let livelyBefore = 0;
    let livelyWithout = 0;
    for (const seed of SEEDS) {
      const r = planWindow(c, { kids: [toddler], settings, window: 120, seed, keep: napKeep });
      const a = analyzePlan(planOf([toddler], r.segments), c);
      const nap = a.entries.find((e) => e.item.segment.routine === 'nap')!.item;
      expect(nap.start).toBe(60);
      const last = plays(a).filter((e) => e.item.end <= nap.start).at(-1)!;
      expect(['settling', 'gentle']).toContain(stimOf(last.item.segment));
      livelyBefore += plays(a).filter((e) => e.item.end > 30 && e.item.end <= 60 && stimOf(e.item.segment) === 'lively').length;
      const free = planWindow(c, { kids: [toddler], settings, window: 120, seed });
      const fa = analyzePlan(planOf([toddler], free.segments), c);
      livelyWithout += plays(fa).filter((e) => e.item.end > 30 && e.item.end <= 60 && stimOf(e.item.segment) === 'lively').length;
    }
    expect(livelyBefore).toBeLessThan(livelyWithout);
    expect(livelyBefore).toBe(0);
  });

  it('keeps the nap’s time when earlier entries are swapped or resized', () => {
    const r = planWindow(c, { kids: [toddler], settings, window: 120, seed: 4, keep: napKeep });
    const p = planOf([toddler], r.segments);
    const napIndex = p.segments.findIndex((s) => s.routine === 'nap');
    const opts = optionsForSlot(c, p, { replace: 0 }, 1);
    expect(opts.length).toBeGreaterThan(0);
    const inPlan = new Set(p.segments.map((s) => s.ref));
    expect(opts.every((o) => !inPlan.has(o.id) && !o.timing.avoid)).toBe(true);
    const swapped = updateEntry(p, 0, { ref: opts[0].id, minutes: opts[0].minutes });
    expect(layoutPlan(swapped, c)[napIndex].start).toBe(60);
    const resized = setMinutes(p, 0, 1000, c);
    expect(layoutPlan(resized, c)[napIndex].start).toBe(60);
    // Anything that now runs into the nap is reported, not absorbed by moving the nap.
    const ra = analyzePlan(resized, c);
    if (ra.conflicts.some((x) => x.kind === 'overlap')) expect(ra.conflicts.find((x) => x.kind === 'overlap')!.other).toBe(napIndex);
  });

  it('a window that ends without a nap invents nothing', () => {
    for (const seed of SEEDS) {
      const on = planWindow(c, { kids: [toddler], settings, window: 90, seed });
      const off = planWindow(c, { kids: [toddler], settings, window: 90, seed, timing: false });
      expect(on.segments.some((s) => s.kind === 'routine')).toBe(false);
      expect(on.notes.join(' ')).not.toMatch(/nap/i);
      expect(strip(on.segments)).toEqual(strip(off.segments));
    }
  });

  it('starts gently after a nap and puts active play while the nap is still a while off', () => {
    for (const seed of SEEDS) {
      const r = planWindow(c, { kids: [toddler], settings: { ...settings, energy: 'plenty' }, window: 180, seed, keep: [routine('n1', 'nap', 'c1', 45, 75)] });
      const a = analyzePlan(planOf([toddler], r.segments, { window: 180 }), c);
      const after = plays(a).find((e) => e.item.start >= 120)!;
      expect(['settling', 'gentle']).toContain(stimOf(after.item.segment));
      const firstTwo = plays(a).slice(0, 2).map((e) => stimOf(e.item.segment));
      expect(firstTwo).not.toContain('settling');
    }
  });
});

describe('momentary context', () => {
  const kids4 = [{ days: toDays(infant.age), notYet: [] as const }];
  const f: Filters = { ...DEFAULT_FILTERS, minutes: null, energy: 'plenty' };

  it('applies "Just fed" and "Nap soon" together in the finder', () => {
    const r = findIdeas(c, kids4, f, 0, [{ fed: true, nap: true }]);
    expect(r.setAside.map((x) => x.id)).toEqual(expect.arrayContaining([ids['Tummy mat'], ids['Dance party']]));
    expect(r.setAside.find((x) => x.id === ids['Tummy mat'])?.cue).toBe('Not right after a feed');
    expect(r.activities.map((a) => a.id)).not.toContain(ids['Tummy mat']);
    // Set-aside ideas are not age or safety exclusions.
    expect(r.eligibleCount).toBe(findIdeas(c, kids4, f, 0).eligibleCount);
    expect(r.timing.get(ids['Lullaby'])?.cue?.text).toBe('Good for winding down');
    expect(r.timing.get(ids['Kick gym'])?.cue?.text).toBe('Better earlier');
    const order = r.activities.map((a) => a.id);
    expect(order.indexOf(ids['Lullaby'])).toBeLessThan(order.indexOf(ids['Kick gym']));
  });

  it('with no moment, ranks exactly as without timing and shows no cues', () => {
    for (const seed of SEEDS) {
      const r = findIdeas(c, kids4, f, seed);
      const plain = rankActivities(c.activities.filter((a) => activityEligible(a, kids4[0], 1) && activityPasses(a, f)), kids4[0].days, f, seed);
      expect(r.activities.map((a) => a.id)).toEqual(plain.map((a) => a.id));
      expect(findIdeas(c, kids4, f, seed, [undefined, undefined]).activities).toEqual(r.activities);
      expect(r.setAside).toEqual([]);
      expect([...r.timing.values()].every((t) => t.cue === null && t.score === 0 && !t.avoid)).toBe(true);
    }
  });

  it('uses each child’s own moment for pairings, and the focused child’s moment for one child', () => {
    const pair = [{ days: toDays(infant.age), notYet: [] as const }, { days: toDays(toddler.age), notYet: [] as const }];
    const both = findIdeas(c, pair, f, 0, [undefined, { fed: false, nap: true }]);
    expect(both.kind).toBe('recipes');
    expect(both.timing.get('mix.fixture-kick-and-ball')?.score).toBeLessThan(0);
    const reversed = findIdeas(c, [pair[1], pair[0]], f, 0, [{ fed: false, nap: true }, undefined]);
    expect(reversed.timing.get('mix.fixture-kick-and-ball')?.score).toBe(both.timing.get('mix.fixture-kick-and-ball')?.score);
    const focus = findIdeas(c, pair, { ...f, focus: 0 }, 0, [{ fed: true, nap: false }, undefined]);
    expect(focus.setAside.map((x) => x.id)).toContain(ids['Tummy mat']);
    const other = findIdeas(c, pair, { ...f, focus: 1 }, 0, [{ fed: true, nap: false }, undefined]);
    expect(other.setAside).toEqual([]);
  });

  it('applies both in the planner, ranks only, and never adds a nap block', () => {
    const moment: MomentContext[] = [{ fed: true, nap: true, napIn: 40 }];
    for (const seed of SEEDS) {
      const r = planWindow(c, { kids: [infant], settings, window: 60, seed, moment });
      const a = analyzePlan(planOf([infant], r.segments, { window: 60 }), c);
      expect(r.segments.some((s) => s.kind === 'routine')).toBe(false);
      for (const e of plays(a)) {
        if (e.item.segment.ref === ids['Tummy mat'] || e.item.segment.ref === ids['Dance party']) expect(e.item.engageStart).toBeGreaterThanOrEqual(30);
        if (e.item.end <= 40 && e.item.end > 10) expect(stimOf(e.item.segment)).not.toBe('lively');
      }
      expect(r.notes).toContain('Nap expected in about 40 min: the rest is left open. Add a nap block to plan around it.');
    }
    const fed = planWindow(c, { kids: [infant], settings, window: 60, seed: 1, moment: [{ fed: true, nap: false }] });
    expect(fed.notes).toContain('Tummy time kept away from the feed you just finished.');
    // "Nap soon" without a time: the end of the first gap is treated as the nap, for ranking only.
    for (const seed of SEEDS) {
      const soon = planWindow(c, { kids: [toddler], settings, window: 30, seed, moment: [{ fed: false, nap: true }] });
      const last = soon.segments.filter((s) => s.kind === 'activity').at(-1)!;
      expect(stimOf(last)).not.toBe('lively');
    }
  });

  it('without a moment, the planner is identical to the timing-unaware planner', () => {
    for (const seed of SEEDS) {
      for (const kids of [[infant], [toddler], [infant, toddler]]) {
        expect(strip(planWindow(c, { kids, settings, window: 90, seed }).segments)).toEqual(strip(planWindow(c, { kids, settings, window: 90, seed, timing: false }).segments));
        expect(strip(planWindow(c, { kids, settings, window: 90, seed, moment: [undefined, undefined] }).segments)).toEqual(strip(planWindow(c, { kids, settings, window: 90, seed, timing: false }).segments));
      }
    }
  });
});

describe('two children, one adult (4 and 28 months, both orders)', () => {
  for (const order of ['baby first', 'toddler first'] as const) {
    const kids = order === 'baby first' ? [infant, toddler] : [toddler, infant];
    const baby = order === 'baby first' ? 'c1' : 'c2';
    const big = baby === 'c1' ? 'c2' : 'c1';

    it(`${order}: the sleeping baby gets no play; the toddler plays alongside without double-counting time`, () => {
      for (const seed of SEEDS) {
        const keep = [routine('n1', 'nap', baby, 60, 30, { settle: 10 })];
        const r = planWindow(c, { kids, settings, window: 120, seed, keep });
        const p = planOf(kids, r.segments);
        expect(Plan.safeParse(p).success).toBe(true);
        const a = analyzePlan(p, c);
        expect(hardConflicts(a)).toEqual([]);
        const along = a.entries.filter((e) => e.item.host !== null);
        expect(along.length).toBeGreaterThan(0);
        for (const e of along) {
          expect(e.item.segment.who).toBe(big);
          expect(e.item.start).toBeGreaterThanOrEqual(40);
          expect(e.item.end).toBeLessThanOrEqual(90);
        }
        // Nothing is planned for the baby during the nap.
        for (const e of a.entries) {
          if (e.item.segment.kind === 'activity' && e.item.segment.who === baby) expect(e.item.end <= 30 || e.item.start >= 90).toBe(true);
        }
        // Main entries are curated pairings, with the younger role on the baby whichever order they were entered.
        for (const s of r.segments.filter((x) => x.kind === 'recipe')) expect(s.younger).toBe(baby);
        expect(r.segments.filter((x) => !x.along).every((x) => x.kind === 'recipe' || x.kind === 'break' || x.kind === 'routine')).toBe(true);
        // Wall time is the union: the toddler's track sits inside the nap.
        const main = a.entries.filter((e) => e.item.host === null);
        expect(a.busy).toBe(main.reduce((m, e) => m + e.item.wall, 0));
      }
    });

    it(`${order}: unknown nap availability only allows busy-nearby ideas, and the gap stays visible`, () => {
      const p = planOf(kids, [routine('n1', 'nap', baby, 60, 0)]);
      const opts = optionsForSlot(c, p, { host: 0 });
      expect(opts.length).toBeGreaterThan(0);
      expect(opts.every((o) => isBusyNearbyCompatible(c.activityById.get(o.id)!))).toBe(true);
      expect(opts.map((o) => o.id)).not.toContain(ids['Read together']);
      const r = planWindow(c, { kids, settings, window: 60, seed: 1, keep: p.segments });
      for (const s of r.segments.filter((x) => x.along)) expect(isBusyNearbyCompatible(c.activityById.get(s.ref ?? '')!)).toBe(true);
      const holding = planWindow(c, { kids, settings, window: 60, seed: 1, keep: [routine('n1', 'nap', baby, 60, 0, { holding: true })] });
      for (const s of holding.segments.filter((x) => x.along)) expect(isBusyNearbyCompatible(c.activityById.get(s.ref ?? '')!)).toBe(true);
    });

    it(`${order}: a toddler meal with one adult leaves the baby’s time open (or reports a conflict)`, () => {
      const keep = [routine('m1', 'meal', big, 30, 0)];
      const r = planWindow(c, { kids, settings, window: 60, seed: 1, keep });
      expect(r.segments.filter((x) => x.along)).toEqual([]);
      expect(r.notes.join(' ')).toMatch(/full attention/);
      const p = planOf(kids, keep);
      expect(optionsForSlot(c, p, { host: 0 })).toEqual([]);
      const forced = planOf(kids, [...keep, { id: 'a1', kind: 'activity', ref: ids['Contrast cards'], minutes: 5, who: baby, along: true }]);
      expect(analyzePlan(forced, c).entries[1].conflicts.map((x) => x.kind)).toContain('along-adult');
      // Two adults: normal single-child ideas are fine.
      const two = planWindow(c, { kids, settings: { ...settings, adults: 2 }, window: 60, seed: 1, keep });
      expect(two.segments.some((x) => x.along && x.who === baby)).toBe(true);
    });
  }
});

describe('alongside a nap', () => {
  it('ranks quieter ideas first for the child who is awake (ranking only)', () => {
    const p = planOf([infant, toddler], [routine('n1', 'nap', 'c1', 60, 0, { settle: 0 })]);
    const opts = optionsForSlot(c, p, { host: 0 });
    const noise = (id: string) => c.activityById.get(id)!.noise;
    const loud = opts.findIndex((o) => noise(o.id) === 'loud');
    expect(loud).toBeGreaterThan(-1);
    expect(opts.slice(loud).every((o) => noise(o.id) !== 'quiet')).toBe(true);
    // Not a nap (a feed): no noise preference, and nothing is excluded for noise.
    const feed = optionsForSlot(c, planOf([infant, toddler], [routine('f1', 'milk-feed', 'c1', 30, 0)]), { host: 0 });
    expect(feed.length).toBeGreaterThan(0);
  });
});

describe('fill around blocks', () => {
  it('keeps routines, locked and custom entries (custom pinned where it was), and replaces the rest', () => {
    const p = planOf([toddler], [
      { id: 'a1', kind: 'activity', ref: ids['Ball run'], minutes: 10 },
      { id: 'c1', kind: 'custom', minutes: 10, label: 'Nap' },
      { id: 'b1', kind: 'break', minutes: 10 },
      { id: 'a2', kind: 'activity', ref: ids['Busy blocks'], minutes: 10, at: 40, locked: true },
      routine('n1', 'nap', 'c1', 30, 70),
    ], { window: 150 });
    const before = layoutPlan(p, c);
    const { plan, result } = fillAround(c, p, { seed: 2 });
    expect(Plan.safeParse(plan).success).toBe(true);
    const ids2 = plan.segments.map((s) => s.id);
    expect(ids2).toEqual(expect.arrayContaining(['c1', 'a2', 'n1']));
    expect(ids2).not.toContain('a1');
    expect(ids2).not.toContain('b1');
    const custom = plan.segments.find((s) => s.id === 'c1')!;
    expect(custom).toMatchObject({ kind: 'custom', label: 'Nap', at: before[1].start });
    expect(plan.segments.find((s) => s.id === 'n1')).toEqual(p.segments[4]);
    expect(plan.segments.find((s) => s.id === 'a2')).toEqual(p.segments[3]);
    expect(plan.segments.filter((s) => s.kind === 'routine')).toHaveLength(1);
    const a = analyzePlan(plan, c);
    expect(a.conflicts.filter((x) => x.kind === 'overlap')).toEqual([]);
    expect(layoutPlan(plan, c).find((x) => x.segment.id === 'n1')!.start).toBe(70);
    expect(result.segments).toBe(plan.segments);
  });
});

describe('slot options', () => {
  it('appends activities for one child and curated pairings for two', () => {
    expect(optionsForSlot(c, planOf([toddler], []), {}).every((o) => o.kind === 'activity' && o.who === undefined)).toBe(true);
    const pair = optionsForSlot(c, planOf([infant, toddler], []), {});
    expect(pair.length).toBeGreaterThan(0);
    expect(pair.every((o) => o.kind === 'recipe')).toBe(true);
  });

  it('ranks by timing at the entry’s own time', () => {
    const p = planOf([toddler], [{ id: 'a1', kind: 'activity', ref: ids['Ball run'], minutes: 10 }, routine('n1', 'nap', 'c1', 30, 15)]);
    const opts = optionsForSlot(c, p, { replace: 0 });
    expect(opts[0].timing.score).toBeGreaterThan(0);
    const ranks = opts.map((o) => o.timing.score);
    expect([...ranks].sort((x, y) => y - x)).toEqual(ranks);
    expect(opts.find((o) => o.id === ids['Dance party'])?.timing.cue?.text).toBe('Better earlier');
  });
});

describe('starter plans', () => {
  const starter: StarterPlan = {
    id: 'plan.fixture-nap-alongside',
    rev: 1,
    title: 'Fixture nap alongside',
    summary: 'An example to edit.',
    circumstance: 'Fixture.',
    ages: ['4m', '28m'],
    start: '13:00',
    segments: [
      { kind: 'recipe', ref: 'mix.fixture-cards-and-books', minutes: 6 },
      { kind: 'routine', routine: 'nap', who: 'c1', minutes: 45, at: 15 },
      { kind: 'activity', ref: 'act.fixture-busy-blocks', minutes: 10, who: 'c2', along: true },
      { kind: 'break', minutes: 5, label: 'Drinks' },
    ],
    checked: '2026-10-29',
  };

  it('maps the starter’s children to the parent’s by age, whichever order they were entered', () => {
    for (const kids of [[infant, toddler], [toddler, infant]]) {
      const baby = kids[0] === infant ? 'c1' : 'c2';
      const { segments, dropped } = starterToSegments(starter, kids, c);
      expect(dropped).toEqual([]);
      expect(segments.find((s) => s.kind === 'routine')).toMatchObject({ routine: 'nap', who: baby, at: 15, minutes: 45 });
      expect(segments.find((s) => s.kind === 'activity')).toMatchObject({ who: baby === 'c1' ? 'c2' : 'c1', along: true });
      expect(segments.find((s) => s.kind === 'recipe')?.younger).toBe(baby);
      expect(Plan.safeParse(planOf(kids, segments)).success).toBe(true);
      expect(hardConflicts(analyzePlan(planOf(kids, segments), c))).toEqual([]);
    }
  });

  it('maps the real catalog’s alongside starter in both child orders', () => {
    const sp = realCatalog.planById.get('plan.baby-nap-toddler-alongside');
    if (!sp) return;
    const ages = sp.ages.map((x) => ({ value: Number(x.slice(0, -1)), unit: x.slice(-1) as 'w' | 'm' }));
    for (const kids of [ages.map((age) => ({ age, notYet: [] })), [...ages].reverse().map((age) => ({ age, notYet: [] }))]) {
      const { segments, dropped } = starterToSegments(sp, kids, realCatalog);
      expect(dropped).toEqual([]);
      const younger = toDays(kids[0].age) < toDays(kids[1].age) ? 'c1' : 'c2';
      const nap = segments.find((s) => s.kind === 'routine')!;
      expect(nap.who).toBe(younger);
      for (const s of segments.filter((x) => x.along)) expect(s.who).not.toBe(younger);
      for (const s of segments.filter((x) => x.kind === 'recipe')) expect(s.younger).toBe(younger);
      expect(Plan.safeParse(planOf(kids, segments, { start: sp.start })).success).toBe(true);
    }
  });
});

describe('sequence notes', () => {
  it('explains only meaningful positions, from the analysis', () => {
    const p = planOf([toddler], [
      { id: 'a1', kind: 'activity', ref: ids['Ball run'], minutes: 10 },
      { id: 'a2', kind: 'activity', ref: ids['Unrated idea'], minutes: 10 },
      { id: 'a3', kind: 'activity', ref: ids['Quiet books'], minutes: 10 },
      routine('n1', 'nap', 'c1', 30, 60),
      { id: 'a4', kind: 'activity', ref: ids['Busy blocks'], minutes: 10 },
      { id: 'a5', kind: 'activity', ref: ids['Read together'], minutes: 10 },
    ], { window: 150 });
    const a = analyzePlan(p, c);
    const notes = p.segments.map((_, i) => sequenceNote(p, a, i, c));
    expect(notes).toEqual(['Active play while there’s time', null, 'Quiet play before the nap', null, 'Gentle start after waking', null]);
  });

  it('notes a feed-sensitive idea placed clear of the feed, once', () => {
    const p = planOf([infant], [routine('f1', 'milk-feed', 'c1', 20, 0), { id: 'b1', kind: 'break', minutes: 30 }, { id: 'a1', kind: 'activity', ref: ids['Tummy mat'], minutes: 5 }, { id: 'a2', kind: 'activity', ref: ids['Tummy mat'], minutes: 5 }]);
    const a = analyzePlan(p, c);
    expect(p.segments.map((_, i) => sequenceNote(p, a, i, c))).toEqual([null, null, 'Kept clear of the feed', null]);
  });
});

describe('default titles', () => {
  it('names a plan by part of day, length, and ages, with no names or dates', () => {
    expect(defaultPlanTitle({ kids: [infant, kid(24)], start: '15:00', window: 90 })).toBe('Afternoon · 90 min · 4 mo + 2 yr');
    expect(defaultPlanTitle({ kids: [kid(3, 'w')], start: '07:30', window: 120 })).toBe('Morning · 2 hr · 3 wk');
    expect(defaultPlanTitle({ kids: [toddler], start: '23:30', window: 150 })).toBe('Night · 2 hr 30 min · 2 yr 4 mo');
    expect(defaultPlanTitle({ kids: [toddler], start: '18:00', window: 30 })).toMatch(/^Evening/);
  });
});

describe('intervals and boundaries', () => {
  const tummy = c.activityById.get(ids['Tummy mat'])!;
  const days4 = toDays(infant.age);
  const feed = (start: number, end: number) => ({ days: days4, events: [{ event: 'milk-feed' as const, start, end }] });

  it('touching at the exact end is not an overlap', () => {
    // After a feed ending at 20: the window is [20, 50).
    expect(assessActivity(c, tummy, spanOf(49, 1, 5, 0), feed(0, 20)).avoid).toBe(false);
    expect(assessActivity(c, tummy, spanOf(48, 1, 5, 0), feed(0, 20)).avoid).toBe(true);
    // Before a feed at 100: the window is [85, 100); engagement plus tidy-up ending at 85 touches it.
    expect(assessActivity(c, tummy, spanOf(79, 1, 5, 0), feed(100, 120)).avoid).toBe(false);
    expect(assessActivity(c, tummy, spanOf(80, 1, 5, 0), feed(100, 120)).avoid).toBe(true);
  });

  it('measures after-windows from the feed’s end and before-windows from its start, counting tidy-up only before', () => {
    expect(assessActivity(c, tummy, spanOf(25, 0, 5, 0), feed(0, 20)).avoid).toBe(true);
    expect(assessActivity(c, tummy, spanOf(25, 0, 5, 0), feed(-30, -10)).avoid).toBe(false);
    const messy: Activity = { ...tummy, setupMinutes: 5, cleanupMinutes: 5 };
    // Setup inside the after-window doesn't count; engagement does.
    expect(assessActivity(c, messy, spanOf(45, 5, 5, 5), feed(0, 20)).avoid).toBe(false);
    // Tidy-up running into the before-window does.
    expect(assessActivity(c, messy, spanOf(71, 5, 5, 0), feed(100, 120)).avoid).toBe(false);
    expect(assessActivity(c, messy, spanOf(70, 5, 5, 5), feed(100, 120)).avoid).toBe(false);
    expect(assessActivity(c, messy, spanOf(71, 5, 5, 5), feed(100, 120)).avoid).toBe(true);
  });

  it('fills only the gaps between anchors, never across overlapping anchors or past the window', () => {
    const overlapping = [routine('f1', 'milk-feed', 'c1', 30, 20), routine('n1', 'nap', 'c1', 40, 40)];
    for (const seed of SEEDS) {
      const r = planWindow(c, { kids: [toddler], settings, window: 120, seed, keep: overlapping });
      const a = analyzePlan(planOf([toddler], r.segments), c);
      const generated = a.entries.filter((e) => e.item.segment.kind !== 'routine');
      for (const e of generated) expect(e.item.end <= 20 || e.item.start >= 80).toBe(true);
      expect(a.conflicts.filter((x) => x.kind === 'overlap').every((x) => r.segments[x.index].kind === 'routine')).toBe(true);
      const late = planWindow(c, { kids: [toddler], settings, window: 120, seed, keep: [routine('n1', 'nap', 'c1', 60, 100)] });
      const la = analyzePlan(planOf([toddler], late.segments), c);
      expect(la.overrun).toBe(40);
      for (const e of la.entries.filter((x) => x.item.segment.kind !== 'routine')) expect(e.item.end).toBeLessThanOrEqual(100);
      // An alongside track under a nap that runs past the window stays inside the window too.
      const pair = [infant, toddler];
      const over = planWindow(c, { kids: pair, settings, window: 120, seed, keep: [routine('n1', 'nap', 'c1', 60, 90, { settle: 0 })] });
      const oa = analyzePlan(planOf(pair, over.segments), c);
      for (const e of oa.entries.filter((x) => x.item.host !== null)) expect(e.item.end).toBeLessThanOrEqual(120);
    }
  });

  it('plans across midnight with linear offsets and wrapped clocks', () => {
    const r = planWindow(c, { kids: [toddler], settings: { ...settings, place: 'any' }, window: 90, seed: 1, start: '23:30' });
    const p = planOf([toddler], r.segments, { start: '23:30', window: 90 });
    const a = analyzePlan(p, c);
    expect(a.overrun).toBe(0);
    expect(a.end).toBeGreaterThan(30);
    expect(a.entries.every((e) => e.timeIssue === null)).toBe(true);
    const t = timeline(p, c).at(-1)!;
    expect(t.end).toBeGreaterThan(1440);
  });

  it('an edit updates downstream assessments', () => {
    const p = planOf([infant], [routine('f1', 'milk-feed', 'c1', 20, 0), { id: 'c1', kind: 'custom', minutes: 10, label: 'Change' }, { id: 'a1', kind: 'activity', ref: ids['Tummy mat'], minutes: 5 }]);
    expect(analyzePlan(p, c).entries[2].timing.avoid).toBe(true);
    const longer = setMinutes(p, 1, 30, c);
    expect(analyzePlan(longer, c).entries[2].timing.avoid).toBe(false);
    expect(sequenceNote(longer, analyzePlan(longer, c), 2, c)).toBe('Kept clear of the feed');
  });
});

describe('no false certainty', () => {
  it('an unrated ("variable") idea is unassessed: no profile preference, no cue, no sequence note', () => {
    const t = findIdeas(c, [{ days: toDays(toddler.age), notYet: [] }], { ...DEFAULT_FILTERS, minutes: null, energy: 'plenty' }, 0, [{ fed: false, nap: true }]).timing.get(ids['Unrated idea'])!;
    expect(t.unassessed).toBe(true);
    expect(t.cue).toBeNull();
    expect(t.score).toBe(0);
    const p = planOf([toddler], [{ id: 'a1', kind: 'activity', ref: ids['Unrated idea'], minutes: 10 }, routine('n1', 'nap', 'c1', 30, 15)]);
    expect(sequenceNote(p, analyzePlan(p, c), 0, c)).toBeNull();
  });

  it('a conditional (advisory) rule ranks lower but never excludes', () => {
    const spitUp = timingRule('tim.core.fixture-spit-up', { event: 'milk-feed', when: 'after', fit: 'later', condition: 'spit-up', ageMin: '1w', ageMax: '12m', cue: 'Gentle play after feeds if they spit up' });
    const { c: base } = timingFixture();
    const cards = { ...base.activityById.get(ids['Contrast cards'])!, timing: { stimulation: 'gentle' as const, rules: ['tim.core.fixture-spit-up'] } };
    const cat = fixtureCatalog({ timingRules: [...fixturePolicies, spitUp], activities: [...base.activities.filter((a) => a.id.startsWith('act.fixture-') && !['act.fixture-floor-tummy-time', 'act.fixture-board-book-basket', cards.id].includes(a.id)), cards] });
    const r = findIdeas(cat, [{ days: toDays(infant.age), notYet: [] }], { ...DEFAULT_FILTERS, minutes: null }, 0, [{ fed: true, nap: false }]);
    expect(r.setAside.map((x) => x.id)).not.toContain(cards.id);
    const t = r.timing.get(cards.id)!;
    expect(t.avoid).toBe(false);
    expect(t.score).toBeLessThan(0);
    expect(t.cue?.tone).toBe('caution');
    let placed = false;
    for (const seed of SEEDS) {
      const plan = planWindow(cat, { kids: [infant], settings, window: 40, seed, keep: [routine('f1', 'milk-feed', 'c1', 10, 0)] });
      placed ||= plan.segments.some((s) => s.ref === cards.id && s.kind === 'activity');
    }
    expect(placed).toBe(true);
  });
});

describe('feed-and-nap scenario (tests/fixtures/planner/feed-nap.json)', () => {
  const { scenario: s, c: sc } = loadScenario();
  const run = (seed: number, timing: boolean) => {
    const r = planWindow(sc, { kids: s.kids, settings: s.settings, window: s.window, start: s.start, seed, keep: s.keep, timing });
    const p = planOf(s.kids, r.segments, { start: s.start, window: s.window, settings: s.settings });
    return { r, p, a: analyzePlan(p, sc) };
  };

  it('follows the timing rules for every seed, whatever the hash order', () => {
    for (const seed of s.seeds) {
      const { p, a } = run(seed, true);
      expect(checkRules(p, a, sc)).toEqual([]);
      const feedEnd = a.entries[0].item.end;
      const nap = a.entries.find((e) => e.item.segment.routine === 'nap')!.item;
      expect(nap.start).toBe(90);
      const ps = plays(a);
      const stim = (e: (typeof ps)[number]) => sc.activityById.get(e.item.segment.ref ?? '')!.timing.stimulation;
      for (const e of ps) {
        if (sc.activityById.get(e.item.segment.ref ?? '')?.tummyTime) expect(e.item.engageStart).toBeGreaterThanOrEqual(feedEnd + 30);
      }
      const before = ps.filter((e) => e.item.end <= nap.start).at(-1)!;
      expect(['settling', 'gentle']).toContain(stim(before));
      const after = ps.find((e) => e.item.start >= nap.end)!;
      expect(['settling', 'gentle']).toContain(stim(after));
      expect(hardConflicts(a)).toEqual([]);
    }
  });

  it('differs from the timing-unaware sequence it is compared with', () => {
    const broken = s.seeds.filter((seed) => {
      const { p, a } = run(seed, false);
      return checkRules(p, a, sc).length > 0;
    });
    expect(broken.length).toBeGreaterThan(0);
  });
});

// ---------- Review fixes (docs/review/timing-review.md) ----------

describe('review B1/m4: sequence notes only certify what a rule checked', () => {
  const tummyId = ids['Tummy mat'];
  const baby7 = kid(7);
  it('never says "kept clear of the meal" when no meal rule applies', () => {
    for (const gap of [0, 40]) {
      const p = planOf([baby7], [routine('m1', 'meal', 'c1', 20, 0), ...(gap ? [{ id: 'c1', kind: 'custom', minutes: gap, label: 'Wash up' } as PlanSegment] : []), { id: 'a1', kind: 'activity', ref: tummyId, minutes: 5 }]);
      const a = analyzePlan(p, c);
      expect(p.segments.map((_, i) => sequenceNote(p, a, i, c))).toEqual(p.segments.map(() => null));
    }
    const snack = planOf([baby7], [routine('s1', 'snack', 'c1', 10, 0), { id: 'a1', kind: 'activity', ref: tummyId, minutes: 5 }]);
    expect(sequenceNote(snack, analyzePlan(snack, c), 1, c)).toBeNull();
  });

  it('says it only outside the window of a meal rule the activity carries, and only nearby', () => {
    const mealRule = timingRule('tim.core.fixture-tummy-after-meal', { event: 'meal', when: 'after', fit: 'avoid', ageMin: '1w', ageMax: '12m', cue: 'Not right after a meal' });
    const base = c.activityById.get(tummyId)!;
    const withMeal: Activity = { ...base, timing: { ...base.timing, rules: [...base.timing.rules, mealRule.id] } };
    const cat = { ...c, timingRules: [...c.timingRules, mealRule], timingRuleById: new Map([...c.timingRuleById, [mealRule.id, mealRule]]), activityById: new Map([...c.activityById, [tummyId, withMeal]]) };
    const at = (gap: number) => {
      const p = planOf([baby7], [routine('m1', 'meal', 'c1', 20, 0), ...(gap ? [{ id: 'c1', kind: 'custom', minutes: gap, label: 'Wash up' } as PlanSegment] : []), { id: 'a1', kind: 'activity', ref: tummyId, minutes: 5 }]);
      const a = analyzePlan(p, cat);
      return { note: sequenceNote(p, a, p.segments.length - 1, cat), avoid: a.entries.at(-1)!.timing.avoid };
    };
    expect(at(0)).toEqual({ note: null, avoid: true });
    expect(at(30)).toEqual({ note: 'Kept clear of the meal', avoid: false });
    expect(at(120).note).toBeNull();
    // A milk feed is not a meal: the meal rule never certifies distance from a feed.
    const feed = planOf([baby7], [routine('f1', 'milk-feed', 'c1', 20, 0), { id: 'c1', kind: 'custom', minutes: 30, label: 'x' }, { id: 'a1', kind: 'activity', ref: tummyId, minutes: 5 }]);
    expect(sequenceNote(feed, analyzePlan(feed, cat), 2, cat)).toBe('Kept clear of the feed');
  });

  it('gives no positive line to an entry with a caution', () => {
    const spitUp = timingRule('tim.core.fixture-spit-up-later', { event: 'milk-feed', when: 'after', fit: 'later', condition: 'spit-up', ageMin: '1w', ageMax: '12m', cue: 'Spits up? Keep play calm after a feed' });
    const kick = c.activityById.get(ids['Kick gym'])!;
    const cat = { ...c, timingRules: [...c.timingRules, spitUp], timingRuleById: new Map([...c.timingRuleById, [spitUp.id, spitUp]]), activityById: new Map([...c.activityById, [kick.id, { ...kick, timing: { ...kick.timing, rules: [spitUp.id] } }]]) };
    const segs = (feed: boolean): PlanSegment[] => [...(feed ? [routine('f1', 'milk-feed', 'c1', 10, 0)] : []), { id: 'a1', kind: 'activity', ref: kick.id, minutes: 10, ...(feed ? {} : { at: 10 }) }, routine('n1', 'nap', 'c1', 60, 90)];
    const plain = planOf([baby7], segs(false));
    expect(sequenceNote(plain, analyzePlan(plain, cat), 0, cat)).toBe('Active play while there’s time');
    const fed = planOf([baby7], segs(true));
    const a = analyzePlan(fed, cat);
    expect(a.entries[1].timing.cue?.tone).toBe('caution');
    expect(sequenceNote(fed, a, 1, cat)).toBeNull();
  });
});

describe('review M1: "Nap soon" with a time', () => {
  it('fills only up to the nap time, never shows "after waking", and says what it left open', () => {
    for (const seed of SEEDS) {
      for (const kids of [[infant], [infant, toddler], [toddler, infant]]) {
        const lane = kids[0] === infant ? 0 : 1;
        const moment: (MomentContext | undefined)[] = [undefined, undefined];
        moment[lane] = { fed: false, nap: true, napIn: 45 };
        const r = planWindow(c, { kids, settings, window: 120, seed, start: '14:00', moment });
        const extra = kids.map((k, i) => momentTiming(toDays(k.age), moment[i]));
        const a = analyzePlan(planOf(kids, r.segments, { start: '14:00' }), c, extra);
        expect(r.segments.some((s) => s.kind === 'routine')).toBe(false);
        for (const e of a.entries) {
          expect(e.item.end).toBeLessThanOrEqual(45);
          expect(e.timing.findings.some((f) => f.event === 'nap' && f.when === 'after')).toBe(false);
        }
        expect(r.notes).toContain(`${kids.length === 2 ? `${lane === 0 ? 'Child 1' : 'Child 2'}’s nap` : 'Nap'} expected at 2:45 PM: the rest is left open. Add a nap block to plan around it.`);
        expect(r.open).toBeGreaterThanOrEqual(75);
      }
    }
  });

  it('a nap time past the window caps nothing', () => {
    const r = planWindow(c, { kids: [toddler], settings, window: 60, seed: 1, moment: [{ fed: false, nap: true, napIn: 90 }] });
    expect(r.notes.join(' ')).not.toMatch(/expected/);
  });
});

describe('review M2: "Nap soon" with no time', () => {
  it('ranks calm first throughout, never at the end of the window, and says so', () => {
    let livelySoon = 0;
    let livelyFree = 0;
    for (const seed of SEEDS) {
      const soon = planWindow(c, { kids: [toddler], settings: { ...settings, energy: 'plenty' }, window: 180, seed, moment: [{ fed: false, nap: true }] });
      const free = planWindow(c, { kids: [toddler], settings: { ...settings, energy: 'plenty' }, window: 180, seed });
      const first = soon.segments.find((s) => s.kind === 'activity')!;
      expect(['settling', 'gentle']).toContain(stimOf(first));
      expect(soon.notes).toContain('Nap soon: calmer ideas first. Add a nap block when you know the time.');
      expect(soon.segments.some((s) => s.kind === 'routine')).toBe(false);
      livelySoon += soon.segments.filter((s) => stimOf(s) === 'lively').length;
      livelyFree += free.segments.filter((s) => stimOf(s) === 'lively').length;
      // Lively ideas, if any, come after the calm ones: nothing assumes the nap is at the end.
      const order = soon.segments.filter((s) => s.kind === 'activity').map((s) => stimOf(s));
      const firstLively = order.indexOf('lively');
      if (firstLively >= 0) expect(order.slice(0, firstLively).filter((x) => x === 'settling' || x === 'gentle').length).toBeGreaterThanOrEqual(2);
    }
    expect(livelySoon).toBeLessThan(livelyFree);
  });
});

describe('review M6: alongside a nap with unknown settling time', () => {
  for (const kids of [[infant, toddler], [toddler, infant]]) {
    const baby = kids[0] === infant ? 'c1' : 'c2';
    const big = baby === 'c1' ? 'Child 2' : 'Child 1';
    const babyName = baby === 'c1' ? 'Child 1' : 'Child 2';
    it(`plans nothing alongside until the settling time is known (${baby === 'c1' ? 'baby first' : 'toddler first'})`, () => {
      for (const seed of SEEDS) {
        const unknown = planWindow(c, { kids, settings, window: 90, seed, keep: [routine('n1', 'nap', baby, 60, 0)] });
        expect(unknown.segments.filter((s) => s.along)).toEqual([]);
        expect(unknown.notes).toContain(`Add your settling time to ${babyName}’s nap to plan ${big}’s time.`);
        const known = planWindow(c, { kids, settings, window: 90, seed, keep: [routine('n1', 'nap', baby, 60, 0, { settle: 15 })] });
        const items = layoutPlan(planOf(kids, known.segments), c).filter((x) => x.host !== null);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((x) => x.start >= 15)).toBe(true);
        // Holding and milk feeds stay "busy": only busy-nearby ideas.
        for (const keep of [[routine('n1', 'nap', baby, 60, 0, { holding: true })], [routine('f1', 'milk-feed', baby, 30, 0)]]) {
          const r = planWindow(c, { kids, settings, window: 90, seed, keep });
          for (const s of r.segments.filter((x) => x.along)) expect(isBusyNearbyCompatible(c.activityById.get(s.ref ?? '')!)).toBe(true);
        }
      }
    });
  }
});

describe('review m7: care routines and ritual repeats', () => {
  const books = c.activityById.get(ids['Quiet books'])!;
  const chore: Activity = { ...books, id: 'act.fixture-sock-helper', title: 'Sock helper', kind: 'routine', timing: { stimulation: 'gentle', rules: [] } };
  const cat = { ...c, activities: [...c.activities, chore], activityById: new Map([...c.activityById, [chore.id, chore]]) };

  it('never adds a care routine on its own, but still offers it last for a parent to add', () => {
    for (const seed of SEEDS) {
      expect(planWindow(cat, { kids: [toddler], settings, window: 180, seed }).segments.some((s) => s.ref === chore.id)).toBe(false);
      expect(planWindow(cat, { kids: [infant, toddler], settings, window: 90, seed, keep: [routine('n1', 'nap', 'c1', 60, 0, { settle: 0 })] }).segments.some((s) => s.ref === chore.id)).toBe(false);
    }
    const opts = optionsForSlot(cat, planOf([toddler], []), {});
    expect(opts.at(-1)?.id).toBe(chore.id);
  });

  it('repeats an idea at most once per alongside track and not within 60 minutes in the main sequence', () => {
    for (const seed of SEEDS) {
      const r = planWindow(c, { kids: [toddler], settings, window: 240, seed });
      const items = layoutPlan(planOf([toddler], r.segments, { window: 240 }), c);
      const starts = new Map<string, number[]>();
      for (const it of items) if (it.segment.ref) starts.set(it.segment.ref, [...(starts.get(it.segment.ref) ?? []), it.start]);
      for (const list of starts.values()) for (let i = 1; i < list.length; i++) expect(list[i] - list[i - 1]).toBeGreaterThanOrEqual(60);
      const two = planWindow(c, { kids: [infant, toddler], settings, window: 150, seed, keep: [routine('n1', 'nap', 'c1', 120, 0, { settle: 0 })] });
      const along = two.segments.filter((s) => s.along).map((s) => s.ref);
      expect(new Set(along).size).toBe(along.length);
    }
  });
});

describe('review m9: each child’s own role stimulation', () => {
  it('uses the role, with the shared space as a floor', () => {
    expect(childStimulation({ stimulation: 'gentle', roles: ['gentle', 'lively'] }, 1, 0)).toBe('lively');
    expect(childStimulation({ stimulation: 'gentle', roles: ['gentle', 'lively'] }, 0, 0)).toBe('gentle');
    expect(childStimulation({ stimulation: 'gentle', roles: ['gentle', 'lively'] }, 0, 1)).toBe('lively');
    expect(childStimulation({ stimulation: 'lively', roles: ['settling', 'gentle'] }, 0, 0)).toBe('lively');
    expect(childStimulation({ stimulation: 'gentle', roles: ['variable', 'settling'] }, 0, 0)).toBe('variable');
    expect(childStimulation({ stimulation: 'variable', roles: ['settling', 'gentle'] }, 1, 0)).toBe('gentle');
    expect(childStimulation({ stimulation: 'settling' }, 1, 0)).toBe('settling');
  });

  it('keeps a pairing with a lively role for one child out of that child’s wind-down', () => {
    const mixed = { ...c.recipeById.get('mix.fixture-cards-and-books')!, id: 'mix.fixture-cards-and-ball', older: { ...c.recipeById.get('mix.fixture-cards-and-books')!.older, activity: ids['Ball run'] } };
    const cat = { ...c, recipes: [...c.recipes, mixed], recipeById: new Map([...c.recipeById, [mixed.id, mixed]]) };
    for (const kids of [[infant, toddler], [toddler, infant]]) {
      for (const seed of SEEDS) {
        const r = planWindow(cat, { kids, settings, window: 120, seed, keep: [routine('n1', 'nap', 'both', 60, 60)] });
        const a = analyzePlan(planOf(kids, r.segments), cat);
        for (const e of a.entries) if (e.item.end <= 60 && 60 - e.item.end < 30) expect(e.item.segment.ref).not.toBe(mixed.id);
      }
    }
  });
});

describe('review: notes and starters', () => {
  it('no longer adds the general "young babies may need to feed or sleep" caveat', () => {
    const r = planWindow(c, { kids: [kid(3, 'w')], settings, window: 60, seed: 1 });
    expect(r.notes.join(' ')).not.toMatch(/may need to feed or sleep/);
  });

  it('copies an example settling time (or holding) from a starter nap', () => {
    const sp = {
      id: 'plan.fixture-settle',
      rev: 1,
      title: 'Fixture settle',
      summary: 'An example to edit.',
      circumstance: 'Fixture.',
      ages: ['4m', '28m'],
      start: '13:00',
      segments: [
        { kind: 'routine', routine: 'nap', who: 'c1', minutes: 45, at: 0, settle: 10 },
        { kind: 'activity', ref: 'act.fixture-busy-blocks', minutes: 10, who: 'c2', along: true },
        { kind: 'routine', routine: 'nap', who: 'c2', minutes: 45, at: 60, holding: true },
      ],
      checked: '2026-10-29',
    } as unknown as StarterPlan;
    const { segments } = starterToSegments(sp, [toddler, infant], c);
    expect(segments[0]).toMatchObject({ routine: 'nap', who: 'c2', settle: 10 });
    expect(segments[2]).toMatchObject({ routine: 'nap', who: 'c1', holding: true });
    expect(segments[2].settle).toBeUndefined();
  });
});
