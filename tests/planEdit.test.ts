import { describe, expect, it } from 'vitest';
import { analyzePlan, layoutPlan } from '../src/lib/layout.ts';
import { addEntry, addRoutine, applyRepair, clockProblem, duplicateEntry, makePlan, moveEntry, removeEntry, setAnchor, setLocked, setMinutes } from '../src/lib/planEdit.ts';
import { Plan } from '../src/lib/plan.ts';
import { fixtureCatalog, loadFixture } from './helpers.ts';

const f = loadFixture();
const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;
const recipe = f.recipes[0];
const c = fixtureCatalog();
const settings = { energy: 'plenty', place: 'any', mode: 'either', adults: 1 } as const;
const two = () => makePlan([{ age: { value: 2, unit: 'm' }, notYet: [] }, { age: { value: 28, unit: 'm' }, notYet: [] }], { ...settings }, '12:00', 180);

describe('plan editing', () => {
  it('places routine blocks by clock time and keeps the plan valid', () => {
    let p = two();
    p = addEntry(p, { id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' });
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 13 * 60, settle: 10 }, c);
    p = addRoutine(p, { routine: 'milk-feed', who: 'c1', minutes: 20, clock: 12 * 60 + 20 }, c);
    expect(p.segments.map((s) => s.routine ?? s.kind)).toEqual(['recipe', 'milk-feed', 'nap']);
    // A toddler meal during the baby's nap goes alongside it.
    p = addRoutine(p, { routine: 'meal', who: 'c2', minutes: 20, clock: 13 * 60 + 15 }, c);
    expect(p.segments[3]).toMatchObject({ routine: 'meal', along: true, at: 75 });
    expect(Plan.safeParse(p).success).toBe(true);
    expect(analyzePlan(p, c).conflicts.filter((x) => x.severity === 'conflict')).toEqual([]);
  });

  it('moves a routine group together and keeps its time', () => {
    let p = two();
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 12 * 60 + 30, settle: 5 }, c);
    p = addEntry(p, { id: 'a1', kind: 'activity', ref: books.id, minutes: 15, who: 'c2' }, { host: 0 });
    p = addEntry(p, { id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' });
    const moved = moveEntry(p, 2, -1);
    expect(moved.segments.map((s) => s.id)).toEqual(['r1', p.segments[0].id, 'a1']);
    expect(layoutPlan(moved, c)[1].start).toBe(30);
    // Moving an alongside entry stays inside its track.
    expect(moveEntry(p, 1, -1)).toBe(p);
  });

  it('removing a routine keeps what ran alongside it, flagged rather than deleted', () => {
    let p = two();
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 12 * 60, settle: 5 }, c);
    p = addEntry(p, { id: 'a1', kind: 'activity', ref: books.id, minutes: 15, who: 'c2' }, { host: 0 });
    const r = removeEntry(p, 0);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ id: 'a1', who: 'c2' });
    expect(r.segments[0].along).toBeUndefined();
    expect(analyzePlan(r, c).conflicts.map((x) => x.kind)).toContain('uncovered');
  });

  it('duplicates a routine after the original and re-anchors on time edits', () => {
    let p = makePlan([{ age: { value: 6, unit: 'm' }, notYet: [] }], { ...settings }, '09:00', 240);
    p = addRoutine(p, { routine: 'milk-feed', who: 'c1', minutes: 20, clock: 9 * 60 }, c);
    p = duplicateEntry(p, 0, c);
    expect(p.segments.map((s) => s.at)).toEqual([0, 20]);
    p = setAnchor(p, 0, 120, c);
    expect(p.segments.map((s) => s.at)).toEqual([20, 120]);
  });

  it('removing a nap keeps a locked alongside entry anchored, so the plan stays valid (review M4)', () => {
    let p = two();
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 12 * 60 + 10, settle: 5 }, c);
    p = addEntry(p, { id: 'a1', kind: 'activity', ref: books.id, minutes: 15, who: 'c2' }, { host: 0 });
    p = setLocked(p, 1, true, c);
    const r = removeEntry(p, 0);
    expect(Plan.safeParse(r).success).toBe(true);
    expect(r.segments[0]).toMatchObject({ id: 'a1', locked: true, at: 15 });
  });

  it('keeps two timed entries in time order when moving (review m2)', () => {
    let p = makePlan([{ age: { value: 9, unit: 'm' }, notYet: [] }], { ...settings }, '12:00', 180);
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 12 * 60 + 30 }, c);
    p = addRoutine(p, { routine: 'snack', who: 'c1', minutes: 15, clock: 14 * 60 }, c);
    expect(moveEntry(p, 1, -1)).toBe(p);
    expect(analyzePlan(p, c).conflicts).toEqual([]);
  });

  it('refuses a routine time before the plan starts instead of wrapping to tomorrow (review m10)', () => {
    const p = makePlan([{ age: { value: 9, unit: 'm' }, notYet: [] }], { ...settings }, '14:00', 120);
    expect(clockProblem(p, 13 * 60 + 30)).toMatch(/before this plan starts/);
    expect(addRoutine(p, { routine: 'nap', who: 'c1', minutes: 30, clock: 13 * 60 + 30 }, c)).toBe(p);
    expect(clockProblem(p, 15 * 60)).toBeNull();
  });

  it('every edit operation returns a valid plan (property check over random edit sequences)', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 200; run++) {
      let p = two();
      for (let step = 0; step < 12; step++) {
        const n = p.segments.length;
        const i = n ? rand(n) : 0;
        const op = rand(9);
        if (op === 0) p = addRoutine(p, { routine: (['nap', 'milk-feed', 'meal', 'snack'] as const)[rand(4)], who: (['c1', 'c2', 'both'] as const)[rand(3)], minutes: 10 + rand(60), clock: 12 * 60 + rand(200), settle: rand(2) ? rand(20) : undefined }, c);
        else if (op === 1) p = addEntry(p, { id: `a${run}${step}`, kind: 'activity', ref: books.id, minutes: 10, who: rand(2) ? 'c1' : 'c2' }, n && p.segments[i].kind === 'routine' && !p.segments[i].along && p.segments[i].who !== 'both' ? { host: i } : {});
        else if (op === 2) p = addEntry(p, { id: `r${run}${step}`, kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' });
        else if (n && op === 3) p = moveEntry(p, i, rand(2) ? 1 : -1);
        else if (n && op === 4) p = removeEntry(p, i);
        else if (n && op === 5) p = duplicateEntry(p, i, c);
        else if (n && op === 6) p = setLocked(p, i, Boolean(rand(2)), c);
        else if (n && op === 7) p = setMinutes(p, i, 1 + rand(120), c);
        else if (n && op === 8) {
          const cf = analyzePlan(p, c).conflicts.flatMap((x) => x.repairs);
          if (cf.length) p = applyRepair(p, cf[rand(cf.length)], c);
        }
        const r = Plan.safeParse(p);
        if (!r.success) throw new Error(`run ${run} step ${step} op ${op}: ${JSON.stringify(p.segments)}`);
      }
    }
  });
});

