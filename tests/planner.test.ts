import { describe, expect, it } from 'vitest';
import type { Activity, MixedAgeRecipe } from '../src/content/schema.ts';
import { DEFAULT_FILTERS, findIdeas } from '../src/lib/filters.ts';
import { planWindow } from '../src/lib/planner.ts';
import { bounds, resize, timeline, totalWallMinutes, type PlanKid, type PlanSegment, type PlanSettings } from '../src/lib/plan.ts';
import { reconcileSegments } from '../src/lib/reconcile.ts';
import { toDays } from '../src/lib/age.ts';
import { fixtureCatalog, loadFixture, variant } from './helpers.ts';

const f = loadFixture();
const tummy = f.activities.find((a) => a.id === 'act.fixture-floor-tummy-time')!;
const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;
const recipe = f.recipes[0];
const settings: PlanSettings = { energy: 'some', place: 'any', mode: 'either', adults: 1 };
const baby: PlanKid = { age: { value: 3, unit: 'w' }, notYet: [] };
const toddler: PlanKid = { age: { value: 28, unit: 'm' }, notYet: [] };

describe('wall-clock arithmetic', () => {
  const c = fixtureCatalog();

  it('counts two simultaneous tracks once and shared setup/cleanup once', () => {
    const plan = {
      start: '16:00',
      segments: [{ id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' } as PlanSegment],
    };
    const [t] = timeline(plan, c);
    // setup 2 + 5 minutes of parallel play + cleanup 1 = 8, not 5 + 5 + ...
    expect(t.wall).toBe(recipe.setupMinutes + 5 + recipe.cleanupMinutes);
    expect(t.end - t.start).toBe(8);
  });

  it('sequences segments back to back from the start time', () => {
    const plan = {
      start: '09:30',
      segments: [
        { id: 'a1', kind: 'activity', ref: books.id, minutes: 10 },
        { id: 'b1', kind: 'break', minutes: 10 },
        { id: 'c1', kind: 'custom', minutes: 15, label: 'Walk to the mailbox' },
      ] as PlanSegment[],
    };
    const items = timeline(plan, c);
    expect(items.map((i) => [i.start, i.end])).toEqual([
      [570, 582],
      [582, 592],
      [592, 607],
    ]);
    expect(totalWallMinutes(plan, c)).toBe(37);
  });

  it('wraps past midnight without breaking', () => {
    const items = timeline({ start: '23:50', segments: [{ id: 'c1', kind: 'custom', minutes: 20, label: 'x' }] }, c);
    expect(items[0].end).toBe(23 * 60 + 50 + 20);
  });
});

describe('planner', () => {
  it('never stretches a tiny infant session to fill a 90-minute window', () => {
    const c = fixtureCatalog();
    const result = planWindow(c, { kids: [baby], settings, window: 90, seed: 1 });
    expect(result.blocked).toBeUndefined();
    for (const seg of result.segments.filter((s) => s.ref === tummy.id)) {
      expect(seg.minutes).toBeLessThanOrEqual(tummy.duration.max);
    }
    // The leftover is shown as open time, not hidden inside an activity.
    const used = totalWallMinutes({ start: '10:00', segments: result.segments }, c);
    expect(used + result.open).toBe(90);
    expect(result.open).toBeGreaterThan(60);
    expect(result.notes.join(' ')).toMatch(/left open/);
  });

  it('resizing stays inside the realistic range', () => {
    const c = fixtureCatalog();
    let seg: PlanSegment = { id: 'a1', kind: 'activity', ref: tummy.id, minutes: tummy.duration.max };
    seg = resize(seg, 1, c);
    expect(seg.minutes).toBe(tummy.duration.max);
    for (let i = 0; i < 20; i++) seg = resize(seg, -1, c);
    expect(seg.minutes).toBe(tummy.duration.min);
    expect(bounds({ id: 'b', kind: 'break', minutes: 10 }, c)).toEqual({ min: 5, max: 45 });
  });

  it('explains an impossible two-child, one-adult combination instead of guessing', () => {
    const c = fixtureCatalog();
    const fourYear: PlanKid = { age: { value: 50, unit: 'm' }, notYet: [] };
    const result = planWindow(c, { kids: [baby, fourYear], settings, window: 90 });
    expect(result.segments).toEqual([]);
    expect(result.open).toBe(90);
    expect(result.blocked?.reason).toMatch(/doesn’t have a curated activity/);
  });

  it('uses only curated pairings for two children and assigns roles by age', () => {
    const c = fixtureCatalog();
    const result = planWindow(c, { kids: [toddler, baby], settings, window: 30, seed: 3 });
    expect(result.segments.length).toBeGreaterThan(0);
    const pairs = result.segments.filter((s) => s.kind === 'recipe');
    expect(pairs.length).toBeGreaterThan(0);
    expect(result.segments.every((s) => s.kind === 'recipe' || s.kind === 'break')).toBe(true);
    // The baby is child 2 here, so child 2 takes the younger role.
    expect(pairs.every((s) => s.younger === 'c2')).toBe(true);
  });

  it('is deterministic for the same inputs and seed', () => {
    const c = fixtureCatalog();
    const strip = (segs: PlanSegment[]) => segs.map(({ kind, ref, minutes }) => ({ kind, ref, minutes }));
    const a = planWindow(c, { kids: [baby], settings, window: 60, seed: 7 });
    const b = planWindow(c, { kids: [baby], settings, window: 60, seed: 7 });
    expect(strip(a.segments)).toEqual(strip(b.segments));
  });

  it('inserts flexible breaks and varies activities in a long window', () => {
    const extra: Activity[] = [1, 2, 3, 4].map((n) =>
      variant(books, { id: `act.fixture-extra-${n}`, intents: n % 2 ? ['move'] : ['calm'], duration: { min: 5, default: 15, max: 20 } }),
    );
    const c = fixtureCatalog({ activities: extra });
    const result = planWindow(c, { kids: [toddler], settings, window: 120, seed: 2 });
    const refs = result.segments.filter((s) => s.kind === 'activity').map((s) => s.ref);
    expect(result.segments.some((s) => s.kind === 'break')).toBe(true);
    for (let i = 1; i < refs.length; i++) expect(refs[i]).not.toBe(refs[i - 1]);
  });

  it('includes at most one outing and keeps screen options out unless energy is low or busy', () => {
    const outing = variant(books, { id: 'act.fixture-park-walk', kind: 'outing', outing: true, places: ['outdoors'], duration: { min: 20, default: 40, max: 60 }, goals: [] , evidence: { type: 'practical', claims: [] }, why: undefined });
    const show = variant(books, { id: 'act.fixture-show', kind: 'media', ageMin: '24m', goals: [], duration: { min: 10, default: 25, max: 30 } });
    const c = fixtureCatalog({ activities: [outing, show] });
    const plan = planWindow(c, { kids: [toddler], settings, window: 180, seed: 5 });
    expect(plan.segments.filter((s) => s.ref === outing.id).length).toBeLessThanOrEqual(1);
    expect(plan.segments.some((s) => s.ref === show.id)).toBe(false);
    const ideas = findIdeas(c, [{ days: toDays(toddler.age), notYet: [] }], { ...DEFAULT_FILTERS, energy: 'plenty', minutes: null });
    expect(ideas.activities.some((a) => a.id === show.id)).toBe(false);
    const busy = findIdeas(c, [{ days: toDays(toddler.age), notYet: [] }], { ...DEFAULT_FILTERS, energy: 'busy', minutes: null });
    expect(busy.activities.some((a) => a.id === show.id)).toBe(true);
    const young = findIdeas(c, [{ days: toDays({ value: 20, unit: 'm' }), notYet: [] }], { ...DEFAULT_FILTERS, energy: 'busy', minutes: null });
    expect(young.activities.some((a) => a.id === show.id)).toBe(false);
  });
});

describe('time-of-day rules', () => {
  it('keeps outdoor sun-exposed activities for babies under 6 months out of 10 a.m.–4 p.m.', () => {
    const walk = variant(tummy, {
      id: 'act.fixture-shaded-walk',
      kind: 'outing',
      outing: true,
      places: ['outdoors'],
      hazards: ['sun-weather'],
      tummyTime: undefined,
      supervision: { ...tummy.supervision, shareable: false },
      duration: { min: 10, default: 20, max: 30 },
    });
    const c = fixtureCatalog({ activities: [walk] });
    const plain = { kids: [baby], settings, window: 60, seed: 1 };
    const midday = planWindow(c, { ...plain, start: '11:00' });
    expect(midday.segments.some((s) => s.ref === walk.id)).toBe(false);
    expect(midday.notes.join(' ')).toMatch(/10 a.m.–4 p.m./);
    const evening = planWindow(c, { ...plain, start: '16:30' });
    expect(evening.segments.some((s) => s.ref === walk.id)).toBe(true);
  });

  it('does not schedule outdoor-only activities at night', () => {
    const walk = variant(books, { id: 'act.fixture-night-walk', kind: 'outing', outing: true, places: ['outdoors'], duration: { min: 10, default: 20, max: 30 } });
    const c = fixtureCatalog({ activities: [walk] });
    const late = planWindow(c, { kids: [toddler], settings, window: 60, seed: 1, start: '22:30' });
    expect(late.segments.some((s) => s.ref === walk.id)).toBe(false);
    expect(late.notes.join(' ')).toMatch(/8 p.m./);
    const morning = planWindow(c, { kids: [toddler], settings, window: 60, seed: 1, start: '09:00' });
    expect(morning.segments.some((s) => s.ref === walk.id)).toBe(true);
  });
});

describe('finder filters', () => {
  it('busy-nearby never returns activities that need you close or water/food', () => {
    const water = variant(books, {
      id: 'act.fixture-water',
      hazards: ['water'],
      supervision: { ...books.supervision, shareable: false, proximity: 'arms-reach' },
    });
    const c = fixtureCatalog();
    const withWater = { ...c, activities: [...c.activities, water], activityById: new Map([...c.activityById, [water.id, water]]) };
    const r = findIdeas(withWater, [{ days: toDays(toddler.age), notYet: [] }], { ...DEFAULT_FILTERS, energy: 'busy', minutes: null });
    expect(r.activities.map((a) => a.id)).toEqual([books.id]);
  });

  it('offers one-tap relaxations for optional filters but never for age or readiness', () => {
    const c = fixtureCatalog();
    const r = findIdeas(c, [{ days: toDays(baby.age), notYet: [] }], { ...DEFAULT_FILTERS, place: 'outdoors', minutes: 10 });
    expect(r.activities).toEqual([]);
    expect(r.relax.map((x) => x.filter)).toContain('place');
    const none = findIdeas(c, [{ days: toDays({ value: 50, unit: 'm' }), notYet: [] }], DEFAULT_FILTERS);
    expect(none.eligibleCount).toBe(0);
    expect(none.relax).toEqual([]);
  });

  it('hides activities that need an ability the parent marked "not yet"', () => {
    const walker = variant(books, { id: 'act.fixture-walker', readiness: { abilities: ['walks'], notes: [] } });
    const c = fixtureCatalog({ activities: [walker] });
    const kid = { days: toDays(toddler.age), notYet: [] as const };
    expect(findIdeas(c, [kid], { ...DEFAULT_FILTERS, minutes: null }).activities.some((a) => a.id === walker.id)).toBe(true);
    expect(findIdeas(c, [{ ...kid, notYet: ['walks'] }], { ...DEFAULT_FILTERS, minutes: null }).activities.some((a) => a.id === walker.id)).toBe(false);
  });
});

describe('reconcile', () => {
  it('drops retired, missing, and ineligible items and clamps lengths', () => {
    const retired = variant(books, { id: 'act.fixture-retired', retired: { date: '2026-10-01', reason: 'Guidance changed' } });
    const c = fixtureCatalog({ activities: [retired] });
    const segs: PlanSegment[] = [
      { id: 'a1', kind: 'activity', ref: books.id, minutes: 500 },
      { id: 'a2', kind: 'activity', ref: retired.id, minutes: 10 },
      { id: 'a3', kind: 'activity', ref: 'act.never-existed', minutes: 10 },
      { id: 'a4', kind: 'activity', ref: tummy.id, minutes: 3 },
    ];
    const r = reconcileSegments([toddler], settings, segs, c);
    expect(r.segments.map((s) => s.ref)).toEqual([books.id]);
    expect(r.segments[0].minutes).toBe(books.duration.max);
    expect(r.adjusted).toBe(1);
    expect(r.dropped.map((d) => d.reason)).toEqual(['retired from Trunk', 'no longer in Trunk', 'not suitable for this age or readiness']);
  });

  it('rejects a recipe whose roles no longer fit the children', () => {
    const c = fixtureCatalog();
    const r = reconcileSegments([toddler, { age: { value: 40, unit: 'm' }, notYet: [] }], settings, [{ id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 4 }], c);
    expect(r.segments).toEqual([]);
    expect(r.dropped[0].reason).toMatch(/fit these ages/);
  });
});

export type { MixedAgeRecipe };
