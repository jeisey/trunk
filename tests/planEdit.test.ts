import { describe, expect, it } from 'vitest';
import { analyzePlan, layoutPlan } from '../src/lib/layout.ts';
import { addEntry, addRoutine, duplicateEntry, makePlan, moveEntry, removeEntry, setAnchor } from '../src/lib/planEdit.ts';
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
});
