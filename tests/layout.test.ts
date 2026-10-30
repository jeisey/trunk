/**
 * Contract tests for the shared timing evaluator and plan layout (lead-owned).
 * Workstreams build on these behaviours; change them only with the contract.
 */
import { describe, expect, it } from 'vitest';
import type { Activity, TimingRule } from '../src/content/schema.ts';
import { analyzePlan, layoutPlan, timeline } from '../src/lib/layout.ts';
import { migratePlan, PLAN_VERSION, type Plan, type PlanSegment } from '../src/lib/plan.ts';
import { assessActivity, assessRecipe, momentTiming, spanOf } from '../src/lib/timing.ts';
import { toDays } from '../src/lib/age.ts';
import { fixtureCatalog, loadFixture, variant } from './helpers.ts';

const f = loadFixture();
const tummy = f.activities.find((a) => a.id === 'act.fixture-floor-tummy-time')!;
const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;
const recipe = f.recipes[0];

const rule = (id: string, patch: Partial<TimingRule>): TimingRule => ({
  id,
  rev: 1,
  event: 'nap',
  when: 'before',
  window: { minutes: 30, basis: 'editorial' },
  fit: 'preferred',
  basis: 'editorial',
  claims: [],
  cue: 'Cue',
  reason: 'Fixture reason text.',
  checked: '2026-10-29',
  ...patch,
});

const policies: TimingRule[] = [
  rule('tim.core.fixture-wind-down', { match: { stimulation: ['settling'] }, cue: 'Good for winding down' }),
  rule('tim.core.fixture-lively-earlier', { match: { stimulation: ['lively'] }, fit: 'later', cue: 'Better earlier' }),
  rule('tim.core.fixture-infant-only', { event: 'milk-feed', when: 'after', fit: 'avoid', ageMin: '1w', ageMax: '12m', cue: 'Infant-only rule' }),
];

const quietBooks = variant(books, { id: 'act.fixture-quiet-books', ageMin: '1w', ageMax: '60m', timing: { stimulation: 'settling', rules: [] } });
const dance: Activity = variant(books, {
  id: 'act.fixture-dance',
  ageMin: '1w',
  ageMax: '60m',
  noise: 'loud',
  timing: { stimulation: 'lively', rules: ['tim.core.fixture-infant-only'] },
});
const busyBlocks: Activity = variant(books, {
  id: 'act.fixture-busy-blocks',
  ageMin: '18m',
  ageMax: '60m',
  supervision: { participation: 'watches', proximity: 'same-room', handsOn: 'none', minAdults: 1, shareable: true, space: 'Near you on the floor.' },
  hazards: [],
  timing: { stimulation: 'gentle', rules: [] },
});
const ledBooks: Activity = variant(books, {
  id: 'act.fixture-led-books',
  supervision: { participation: 'leads', proximity: 'arms-reach', handsOn: 'intermittent', minAdults: 1, shareable: true, space: 'Next to you.' },
  timing: { stimulation: 'gentle', rules: [] },
});
const c = fixtureCatalog({ timingRules: policies, activities: [quietBooks, dance, busyBlocks, ledBooks] });

const stamp = '2026-10-29T10:00:00.000Z';
function plan(kids: number[], segments: PlanSegment[], patch: Partial<Plan> = {}): Plan {
  return {
    v: PLAN_VERSION,
    id: 'p-test-1',
    title: '',
    kids: kids.map((m) => ({ age: { value: m, unit: 'm' as const }, notYet: [] })),
    start: '10:00',
    window: 120,
    settings: { energy: 'plenty', place: 'any', mode: 'either', adults: 1 },
    segments,
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  };
}

describe('plan v1 → v2 migration', () => {
  it('keeps every entry, key order, and timeline position', () => {
    const v1 = { ...plan([2], [{ id: 'a1', kind: 'activity', ref: tummy.id, minutes: 5 }, { id: 'b1', kind: 'break', minutes: 10, label: 'Flexible break' }, { id: 'c1', kind: 'custom', minutes: 15, label: 'Nap', who: 'c1' }]), v: 1 };
    const m = migratePlan(JSON.parse(JSON.stringify(v1)));
    expect(m?.from).toBe(1);
    expect(m!.plan.segments).toEqual(v1.segments);
    // A custom entry labelled "Nap" stays a custom entry.
    expect(m!.plan.segments[2].kind).toBe('custom');
    expect(JSON.stringify(m!.plan)).toBe(JSON.stringify({ ...v1, v: 2 }));
    const times = timeline(m!.plan, c).map((t) => [t.start, t.end]);
    const serial = [tummy.setupMinutes + 5 + tummy.cleanupMinutes, 10, 15];
    let at = 600;
    expect(times).toEqual(serial.map((w) => [at, (at += w)]));
  });

  it('rejects unknown and newer versions', () => {
    expect(migratePlan({ ...plan([2], []), v: 9 })).toBeNull();
    expect(migratePlan({ v: 1, id: 'x' })).toBeNull();
  });
});

describe('timing evaluator', () => {
  const infant = toDays({ value: 4, unit: 'm' });
  const toddler = toDays({ value: 28, unit: 'm' });

  it('measures post-feed windows from the feed’s end, across anything in between', () => {
    const p = plan([4], [
      { id: 'f1', kind: 'routine', routine: 'milk-feed', who: 'c1', minutes: 20, at: 0 },
      { id: 'b1', kind: 'break', minutes: 5 },
      { id: 'a1', kind: 'activity', ref: tummy.id, minutes: 5 },
      { id: 'a2', kind: 'activity', ref: tummy.id, minutes: 5, at: 60 },
    ]);
    const a = analyzePlan(p, c);
    expect(a.entries[2].timing.avoid).toBe(true);
    expect(a.entries[2].timing.cue?.text).toMatch(/after a feed/);
    expect(a.entries[3].timing.avoid).toBe(false);
  });

  it('checks a before-feed window against engagement plus tidy-up', () => {
    const span = spanOf(0, 1, 5, 1);
    const child = { days: infant, events: [{ event: 'milk-feed' as const, start: 20, end: 40 }] };
    expect(assessActivity(c, tummy, span, child).avoid).toBe(true);
    expect(assessActivity(c, tummy, spanOf(0, 1, 5, 1), { days: infant, events: [{ event: 'milk-feed', start: 30, end: 50 }] }).avoid).toBe(false);
  });

  it('never applies an infant-only rule to a toddler', () => {
    const span = spanOf(0, 0, 10, 0);
    const fed = [{ event: 'milk-feed' as const, start: -20, end: -1 }];
    expect(assessActivity(c, dance, span, { days: infant, events: fed }).avoid).toBe(true);
    expect(assessActivity(c, dance, span, { days: toddler, events: fed }).avoid).toBe(false);
  });

  it('assesses each recipe role against the right child, whichever order they were entered', () => {
    const both = { ...recipe, older: { ...recipe.older, activity: dance.id }, timing: { stimulation: 'gentle' as const } };
    const span = spanOf(0, 0, 10, 0);
    const fed = [{ event: 'milk-feed' as const, start: -20, end: -1 }];
    // Toddler (older role, dance) was just fed: the infant-only rule must not land on them.
    const kidsA = [{ days: infant, events: [] }, { days: toddler, events: fed }] as const;
    expect(assessRecipe(c, both, span, kidsA, 0).avoid).toBe(false);
    const kidsB = [{ days: toddler, events: fed }, { days: infant, events: [] }] as const;
    expect(assessRecipe(c, both, span, kidsB, 1).avoid).toBe(false);
  });

  it('prefers settling activities before a nap and moves lively ones earlier, without excluding them', () => {
    const nap = [{ event: 'nap' as const, start: 30, end: 90 }];
    const near = spanOf(10, 0, 15, 0);
    const pre = assessActivity(c, quietBooks, near, { days: toddler, events: nap });
    expect(pre.cue).toMatchObject({ text: 'Good for winding down', tone: 'good' });
    const lively = assessActivity(c, dance, near, { days: toddler, events: nap });
    expect(lively.avoid).toBe(false);
    expect(lively.score).toBeLessThan(0);
    expect(assessActivity(c, dance, spanOf(-60, 0, 15, 0), { days: toddler, events: nap }).score).toBe(0);
  });

  it('applies "Just fed" and "Nap soon" together, and nothing when neither is set', () => {
    const t = momentTiming(infant, { fed: true, nap: true });
    expect(assessActivity(c, dance, spanOf(0, 0, 10, 0), t).findings.map((x) => x.event).sort()).toEqual(['milk-feed', 'nap']);
    expect(assessActivity(c, dance, spanOf(0, 0, 10, 0), momentTiming(infant, undefined)).findings).toEqual([]);
  });
});

describe('plan layout', () => {
  it('keeps an anchored nap fixed and reports what runs into it, with local repairs', () => {
    const p = plan([28], [
      { id: 'a1', kind: 'activity', ref: books.id, minutes: 20 },
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 30 },
    ]);
    const ok = analyzePlan(p, c);
    expect(ok.conflicts).toEqual([]);
    const longer = { ...p, segments: [{ ...p.segments[0], minutes: 30 }, p.segments[1]] };
    const a = analyzePlan(longer, c);
    expect(layoutPlan(longer, c)[1].start).toBe(30);
    const overlap = a.conflicts.find((x) => x.kind === 'overlap');
    expect(overlap?.minutes).toBe(30 + books.setupMinutes + books.cleanupMinutes - 30);
    expect(overlap?.repairs.map((r) => r.kind)).toEqual(expect.arrayContaining(['shorten', 'move-after', 'shift', 'remove']));
  });

  it('runs one child’s activity alongside the other child’s nap without double-counting time', () => {
    const p = plan([2, 28], [
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 0, settle: 10 },
      { id: 'a1', kind: 'activity', ref: books.id, minutes: 20, who: 'c2', along: true },
      { id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' },
    ]);
    const items = layoutPlan(p, c);
    expect(items[1].start).toBe(10);
    expect(items[1].host).toBe(0);
    expect(items[2].start).toBe(60);
    const a = analyzePlan(p, c);
    expect(a.busy).toBe(60 + recipe.setupMinutes + 5 + recipe.cleanupMinutes);
    expect(a.conflicts.filter((x) => x.severity === 'conflict')).toEqual([]);
    // Child 2's settling-time gap is visible, with the adult busy.
    expect(a.gaps.find((g) => g.who === 'c2' && g.start === 0)).toMatchObject({ end: 10, adult: 'busy' });
  });

  it('never treats unknown nap availability as free, and keeps meal supervision undivided', () => {
    const unknown = plan([4, 28], [
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 0 },
      { id: 'a1', kind: 'activity', ref: ledBooks.id, minutes: 20, who: 'c2', along: true },
      { id: 'a2', kind: 'activity', ref: busyBlocks.id, minutes: 20, who: 'c2', along: true },
    ]);
    const u = analyzePlan(unknown, c);
    expect(u.entries[1].conflicts.map((x) => x.kind)).toContain('along-adult');
    expect(u.entries[2].conflicts.filter((x) => x.severity === 'conflict')).toEqual([]);
    const meal = plan([10, 28], [
      { id: 'm1', kind: 'routine', routine: 'meal', who: 'c1', minutes: 30, at: 0 },
      { id: 'a1', kind: 'activity', ref: busyBlocks.id, minutes: 20, who: 'c2', along: true },
    ]);
    expect(analyzePlan(meal, c).entries[1].conflicts.map((x) => x.kind)).toContain('along-adult');
    expect(analyzePlan({ ...meal, settings: { ...meal.settings, adults: 2 } }, c).conflicts).toEqual([]);
  });

  it('wraps clock times past midnight while offsets stay linear', () => {
    const p = plan([28], [{ id: 'a1', kind: 'activity', ref: books.id, minutes: 30 }], { start: '23:50' });
    const [t] = timeline(p, c);
    expect(t.start).toBe(23 * 60 + 50);
    expect(t.end % 1440).toBe((23 * 60 + 50 + t.wall) % 1440);
    expect(analyzePlan(p, c).end).toBe(t.wall);
  });

  it('reports open time and overruns from the union of occupied intervals', () => {
    const p = plan([28], [{ id: 'a1', kind: 'activity', ref: books.id, minutes: 20 }, { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 90, at: 60 }]);
    const a = analyzePlan(p, c);
    expect(a.overrun).toBe(30);
    expect(a.open).toBe(120 - 90 + 30 - (20 + books.setupMinutes + books.cleanupMinutes));
    expect(a.gaps.some((g) => g.who === 'all' && g.end === 60)).toBe(true);
  });

  it('reports two entries for the same child at once inside an alongside track (review M3)', () => {
    const p = plan([4, 28], [
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 90, at: 0, settle: 0 },
      { id: 'a1', kind: 'activity', ref: busyBlocks.id, minutes: 15, who: 'c2', along: true },
      { id: 's1', kind: 'routine', routine: 'snack', who: 'c2', minutes: 15, at: 5, along: true },
    ]);
    const a = analyzePlan(p, c);
    const o = a.conflicts.find((x) => x.kind === 'overlap');
    expect(o).toMatchObject({ index: 1, other: 2, severity: 'conflict' });
    expect(o!.repairs.map((r) => r.kind)).toEqual(expect.arrayContaining(['shorten', 'shift', 'remove']));
  });

  it('splits a child’s free time where settling ends (review m1)', () => {
    const p = plan([4, 28], [{ id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 0, settle: 15 }]);
    const gaps = analyzePlan(p, c).gaps.filter((g) => g.who === 'c2');
    expect(gaps.map((g) => [g.start, g.end, g.adult])).toEqual([
      [0, 15, 'busy'],
      [15, 60, 'free'],
    ]);
    const unknown = plan([4, 28], [{ id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 0 }]);
    expect(analyzePlan(unknown, c).gaps.filter((g) => g.who === 'c2').map((g) => g.adult)).toEqual(['unknown']);
  });

  it('marks alongside play during a nap with unknown availability as the parent’s call, never as free time', () => {
    const p = plan([4, 28], [
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: 0 },
      { id: 'a1', kind: 'activity', ref: busyBlocks.id, minutes: 20, who: 'c2', along: true },
    ]);
    const cf = analyzePlan(p, c).entries[1].conflicts;
    expect(cf).toHaveLength(1);
    expect(cf[0]).toMatchObject({ kind: 'along-adult', severity: 'caution' });
    expect(cf[0].message).toMatch(/settling time/);
  });

  it('a momentary nap with a time has no end, so nothing gets an after-waking cue', () => {
    const t = momentTiming(toDays({ value: 28, unit: 'm' }), { fed: false, nap: true, napIn: 15 });
    const late = assessActivity(c, quietBooks, spanOf(10, 0, 30, 0), t);
    expect(late.findings.map((x) => `${x.event}/${x.when}`)).toEqual(['nap/before']);
  });

  it('shows an overlap on both entries and offers only repairs that don’t cause a new conflict (UI review M5)', async () => {
    const { usefulRepairs } = await import('../src/lib/repairs.ts');
    const wall = books.setupMinutes + 20 + books.cleanupMinutes;
    const p = plan([28], [
      { id: 'a1', kind: 'activity', ref: books.id, minutes: 20 },
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 60, at: wall - 10 },
      { id: 'f1', kind: 'routine', routine: 'milk-feed', who: 'c1', minutes: 20, at: wall + 50 },
    ]);
    const a = analyzePlan(p, c);
    const o = a.conflicts.find((x) => x.kind === 'overlap')!;
    expect(a.entries[0].conflicts).toContain(o);
    expect(a.entries[1].conflicts).toContain(o);
    expect(a.conflicts.filter((x) => x === o)).toHaveLength(1);
    const kinds = usefulRepairs(p, o, c).map((r) => r.kind);
    expect(kinds).toContain('shorten');
    expect(kinds).toContain('remove');
    // Moving the activity after the nap, or the nap later, would run into the feed.
    expect(kinds).not.toContain('shift');
    expect(kinds).not.toContain('move-after');
  });

  it('flags a pairing that no longer fits the children instead of hiding it', () => {
    const p = plan([10, 28], [{ id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1' }]);
    const cf = analyzePlan(p, c).entries[0].conflicts;
    expect(cf.map((x) => x.kind)).toContain('eligibility');
    expect(cf.find((x) => x.kind === 'eligibility')!.repairs.map((r) => r.kind)).toEqual(['swap', 'remove']);
  });

  it('flags a main entry that double-books a child already busy alongside another routine (UI review M5)', () => {
    const p = plan([2, 28], [
      { id: 'n1', kind: 'routine', routine: 'nap', who: 'c1', minutes: 90, at: 0, settle: 0 },
      { id: 'a1', kind: 'activity', ref: busyBlocks.id, minutes: 20, who: 'c2', along: true },
      { id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 5, younger: 'c1', at: 10 },
    ]);
    const a = analyzePlan(p, c);
    // The pairing runs into the nap (reported against the nap) and also double-books Child 2.
    expect(a.conflicts.some((x) => x.kind === 'overlap' && x.index === 0 && x.other === 2)).toBe(true);
    const double = a.conflicts.filter((x) => x.kind === 'overlap' && /Child 2 would be doing/.test(x.message));
    expect(double).toHaveLength(1);
    expect(double[0]).toMatchObject({ index: 1, other: 2 });
    expect(a.entries[2].conflicts).toContain(double[0]);
  });
});

