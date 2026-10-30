/**
 * Compatibility (plan v1 → v2) and the routine lifecycle across every format:
 * saved plans, the session draft, share links, and plan files.
 *
 * Fixtures in tests/fixtures/plans/ were written in the v1 shapes; the share
 * link and plan file were produced once by the v1 encoder (share.ts at af243cb)
 * and are never regenerated.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, readDraft, writeDraft } from '../src/lib/draft.ts';
import { analyzePlan, layoutPlan, timeline } from '../src/lib/layout.ts';
import { migratePlan, overheadFor, Plan, type PlanKid, type PlanSegment, type PlanSettings } from '../src/lib/plan.ts';
import { addEntry, addRoutine, makePlan, moveEntry, setAnchor, setMinutes } from '../src/lib/planEdit.ts';
import { fillAround } from '../src/lib/planner.ts';
import { reconcileSegments } from '../src/lib/reconcile.ts';
import { decodePayload, DEFAULT_SHARE_OPTIONS, encodePayload, importPayload, importPlanFile, planFileText, toCompact, type ShareOptions } from '../src/lib/share.ts';
import { BACKUP_KEY, DOWNGRADE_KEY, LEGACY_KEY, MAX_PLANS, MIRROR_KEY, PlanStore, STORE_KEY } from '../src/lib/storage.ts';
import { PlanStore as V1Store } from './fixtures/legacy/v1-storage.ts';
import { fixtureCatalog, MemoryStorage, root, timingFixture } from './helpers.ts';

const dir = join(root, 'tests/fixtures/plans');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const savedFixture = JSON.parse(read('v1-saved-plans.json')) as { version: 1; plans: Record<string, unknown>[] };
/** What a v1 build stored: compact JSON of the envelope. */
const savedText = JSON.stringify(savedFixture);
const draftText = JSON.stringify(JSON.parse(read('v1-session-draft.json')));
const links = JSON.parse(read('v1-share-links.json')) as { links: Record<'twoKidDefault' | 'twoKidAllText' | 'oneKidDefault', string>; compact: { twoKidAllText: unknown } };
const fileText = read('v1-plan-file.json');
const c = fixtureCatalog();
const ALL: ShareOptions = { includeTitle: true, includeCustomText: true, includeNotes: true };

/** Segment content that must survive a format, without generated IDs. */
const shape = (s: PlanSegment) => ({ kind: s.kind, ref: s.ref, minutes: s.minutes, label: s.label, who: s.who, younger: s.younger, routine: s.routine, at: s.at, locked: s.locked, along: s.along, settle: s.settle, holding: s.holding });
const strictShape = (segs: PlanSegment[]) => JSON.parse(JSON.stringify(segs.map(shape)));

describe('saved plans written by v1', () => {
  it('open without data loss: IDs, titles, notes, child order, activity IDs, durations, and timeline positions', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, savedText);
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('ok');
    expect(r.plans).toHaveLength(savedFixture.plans.length);
    r.plans.forEach((p, i) => {
      const orig = savedFixture.plans[i];
      expect(JSON.stringify(p)).toBe(JSON.stringify({ ...orig, v: 2 }));
      // v1 timeline: entries back to back from the start time.
      let at = Number((orig.start as string).slice(0, 2)) * 60 + Number((orig.start as string).slice(3));
      const expected = (orig.segments as PlanSegment[]).map((s) => {
        const { setup, cleanup } = overheadFor(s, c);
        const span: [number, number] = [at, at + setup + s.minutes + cleanup];
        at = span[1];
        return span;
      });
      expect(timeline(p, c).map((t) => [t.start, t.end])).toEqual(expected);
    });
    // Custom entries labelled "Nap" or "Feed" stay custom: nothing is reinterpreted as a routine.
    const customs = r.plans.flatMap((p) => p.segments.filter((s) => s.label === 'Nap' || s.label === 'Feed'));
    expect(customs).toHaveLength(3);
    expect(customs.every((s) => s.kind === 'custom' && s.routine === undefined)).toBe(true);
    expect(r.plans.some((p) => p.segments.some((s) => s.kind === 'routine'))).toBe(false);
  });

  it('opening one from the store does not look edited (no false dirty state)', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, savedText);
    for (const p of new PlanStore(() => mem).load().plans) {
      const r = reconcileSegments(p.kids, p.settings, p.segments, c);
      expect(r).toMatchObject({ dropped: [], changed: [], adjusted: 0 });
      // What the app compares: the opened draft against the stored snapshot.
      expect(JSON.stringify({ ...p, segments: r.segments })).toBe(JSON.stringify(p));
    }
  });

  it('keeps the v1 text once before the first v2 write, and never overwrites that copy', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, savedText);
    const store = new PlanStore(() => mem);
    const [first, ...rest] = store.load().plans;
    expect(mem.getItem(LEGACY_KEY)).toBeNull();
    expect(store.save({ ...first, title: 'Rainy morning (edited)' }).ok).toBe(true);
    expect(mem.getItem(LEGACY_KEY)).toBe(savedText);
    const env = JSON.parse(mem.getItem(STORE_KEY)!);
    expect(env.version).toBe(2);
    expect(env.plans.every((p: { v: number }) => p.v === 2)).toBe(true);
    // The other plans are byte-for-byte what migration produced.
    const reloaded = new PlanStore(() => mem).load();
    expect(reloaded.status).toBe('ok');
    expect(reloaded.plans.slice(1)).toEqual(rest);
    expect(reloaded.plans[0].title).toBe('Rainy morning (edited)');
    store.save({ ...first, title: 'Again' });
    expect(mem.getItem(LEGACY_KEY)).toBe(savedText);
    // An existing copy is never replaced, even by other v1 data.
    const other = new MemoryStorage();
    other.setItem(LEGACY_KEY, 'earlier copy');
    other.setItem(STORE_KEY, savedText);
    const s2 = new PlanStore(() => other);
    s2.load();
    s2.save(first);
    expect(other.getItem(LEGACY_KEY)).toBe('earlier copy');
  });

  it('copies pre-envelope (v0) data the same way, and v2 data not at all', () => {
    const mem = new MemoryStorage();
    const bare = JSON.stringify(savedFixture.plans);
    mem.setItem(STORE_KEY, bare);
    const store = new PlanStore(() => mem);
    expect(store.load().plans).toHaveLength(savedFixture.plans.length);
    store.remove('p-mh1a2b3f-e5r1io');
    expect(mem.getItem(LEGACY_KEY)).toBe(bare);
    const fresh = new MemoryStorage();
    const s3 = new PlanStore(() => fresh);
    s3.load();
    s3.save(migratePlan(savedFixture.plans[0])!.plan);
    s3.save(migratePlan(savedFixture.plans[1])!.plan);
    expect(fresh.getItem(LEGACY_KEY)).toBeNull();
  });

  it('treats a newer envelope or any newer plan as read-only', () => {
    for (const text of [
      JSON.stringify({ version: 3, plans: [] }),
      JSON.stringify({ version: 2, plans: [{ ...savedFixture.plans[0], v: 2 }, { ...savedFixture.plans[1], v: 3, futureField: true }] }),
      JSON.stringify({ version: 1, plans: [{ ...savedFixture.plans[0], v: 3 }] }),
      JSON.stringify([{ ...savedFixture.plans[0], v: 4 }]),
    ]) {
      const mem = new MemoryStorage();
      mem.setItem(STORE_KEY, text);
      const store = new PlanStore(() => mem);
      expect(store.load().status).toBe('newer');
      const r = store.save(migratePlan(savedFixture.plans[0])!.plan);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('newer');
      expect(mem.getItem(STORE_KEY)).toBe(text);
      expect(mem.getItem(LEGACY_KEY)).toBeNull();
    }
  });

  it('a tab still on v1 data picks up another tab’s v2 write and keeps its plans', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, savedText);
    const a = new PlanStore(() => mem);
    const b = new PlanStore(() => mem);
    const plans = a.load().plans;
    b.load();
    b.save({ ...plans[2], title: 'From tab B' });
    a.save({ ...plans[0], title: 'From tab A' });
    const titles = new PlanStore(() => mem).load().plans.map((p) => p.title);
    expect(titles).toEqual(['From tab A', 'Maya and Theo, Tuesday', 'From tab B', '']);
    // A newer tab writing later stops this one.
    mem.setItem(STORE_KEY, JSON.stringify({ version: 9, plans: [] }));
    expect(a.save(plans[1]).ok).toBe(false);
  });

  it('enforces the ten-plan limit on migrated data without writing anything', () => {
    const mem = new MemoryStorage();
    const ten = Array.from({ length: MAX_PLANS }, (_, i) => ({ ...savedFixture.plans[0], id: `p-v1-${i}` }));
    const text = JSON.stringify({ version: 1, plans: ten });
    mem.setItem(STORE_KEY, text);
    const store = new PlanStore(() => mem);
    expect(store.load().plans).toHaveLength(MAX_PLANS);
    const r = store.save({ ...migratePlan(savedFixture.plans[1])!.plan, id: 'p-eleventh' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('limit');
    expect(mem.getItem(STORE_KEY)).toBe(text);
  });

  it('salvages readable v1 plans next to damaged ones and backs the text up', () => {
    const mem = new MemoryStorage();
    const text = JSON.stringify({ version: 1, plans: [savedFixture.plans[0], { v: 1, id: 'broken' }] });
    mem.setItem(STORE_KEY, text);
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('recovered');
    expect(r.plans.map((p) => p.id)).toEqual([savedFixture.plans[0].id]);
    expect(mem.getItem('trunk.plans.backup')).toBe(text);
  });
});

describe('session draft written by v1', () => {
  it('opens clean: the plan and its snapshot migrate the same way', () => {
    const mem = new MemoryStorage();
    mem.setItem(DRAFT_KEY, draftText);
    const d = readDraft(mem)!;
    expect(d.plan.v).toBe(2);
    expect(JSON.stringify(d.plan)).toBe(JSON.stringify({ ...JSON.parse(draftText).plan, v: 2 }));
    expect(d.snapshot).toBe(JSON.stringify(d.plan));
  });

  it('stays dirty when it was dirty, and unsaved when it had no snapshot', () => {
    const raw = JSON.parse(draftText);
    const mem = new MemoryStorage();
    mem.setItem(DRAFT_KEY, JSON.stringify({ plan: { ...raw.plan, title: 'Edited' }, snapshot: raw.snapshot }));
    const d = readDraft(mem)!;
    expect(d.snapshot).not.toBe(JSON.stringify(d.plan));
    expect(JSON.parse(d.snapshot!).title).toBe('Maya and Theo, Tuesday');
    mem.setItem(DRAFT_KEY, JSON.stringify({ plan: raw.plan, snapshot: null }));
    expect(readDraft(mem)!.snapshot).toBeNull();
    mem.setItem(DRAFT_KEY, JSON.stringify({ plan: raw.plan, snapshot: '{oops' }));
    expect(readDraft(mem)).toMatchObject({ snapshot: null });
  });

  it('reads unknown, newer, or damaged drafts as nothing, and never throws', () => {
    const raw = JSON.parse(draftText);
    const mem = new MemoryStorage();
    for (const text of ['{oops', 'null', '[]', JSON.stringify({ plan: { ...raw.plan, v: 3 }, snapshot: null }), JSON.stringify({ snapshot: raw.snapshot }), JSON.stringify({ plan: { v: 1, id: 'x' } })]) {
      mem.setItem(DRAFT_KEY, text);
      expect(readDraft(mem)).toBeNull();
    }
    expect(readDraft(null)).toBeNull();
    const blocked = new MemoryStorage();
    blocked.failWrites = 'blocked';
    expect(() => writeDraft(migratePlan(raw.plan)!.plan, null, blocked)).not.toThrow();
    const throwing = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(readDraft(throwing)).toBeNull();
  });

  it('round-trips a v2 draft and clears it', () => {
    const mem = new MemoryStorage();
    const plan = migratePlan(JSON.parse(draftText).plan)!.plan;
    writeDraft(plan, JSON.stringify(plan), mem);
    expect(readDraft(mem)).toEqual({ plan, snapshot: JSON.stringify(plan) });
    writeDraft(null, null, mem);
    expect(mem.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('share links and files written by v1', () => {
  it('decode to what the v1 encoder put in them', async () => {
    expect(await decodePayload(links.links.twoKidAllText)).toEqual(links.compact.twoKidAllText);
  });

  it('import with privacy defaults and without reinterpreting custom text', async () => {
    const def = await importPayload(links.links.twoKidDefault, c);
    expect(def.dropped).toEqual([]);
    expect(def.plan.v).toBe(2);
    expect(def.plan.title).toBe('Shared plan');
    expect(def.plan.notes).toBe('');
    expect(def.plan.kids.map((k) => k.age)).toEqual([{ value: 6, unit: 'w' }, { value: 28, unit: 'm' }]);
    expect(def.plan.segments.map((s) => [s.kind, s.minutes, s.who, s.label])).toEqual([
      ['recipe', 4, undefined, undefined],
      ['break', 10, undefined, 'Flexible break'],
      ['custom', 45, 'c1', 'Your own activity'],
      ['custom', 20, 'c2', 'Your own activity'],
    ]);
    expect(def.plan.segments[0].younger).toBe('c1');
    const all = await importPayload(links.links.twoKidAllText, c);
    expect(all.plan.title).toBe('Maya and Theo, Tuesday');
    expect(all.plan.notes).toBe('Theo has a cold; skip the park.');
    expect(all.plan.segments.filter((s) => s.kind === 'custom').map((s) => s.label)).toEqual(['Nap', 'Grandma Ruth video call']);
    expect(all.plan.segments.some((s) => s.kind === 'routine')).toBe(false);
    const one = await importPayload(links.links.oneKidDefault, c);
    expect(one.plan.segments.map((s) => [s.kind, s.ref, s.minutes])).toEqual([
      ['activity', 'act.fixture-board-book-basket', 15],
      ['break', undefined, 10],
      ['custom', undefined, 30],
    ]);
  });

  it('open the downloaded v1 plan file the same way as the link', async () => {
    const fromFile = importPlanFile(fileText, c);
    const fromLink = await importPayload(links.links.twoKidAllText, c);
    expect(strictShape(fromFile.plan.segments)).toEqual(strictShape(fromLink.plan.segments));
    expect(fromFile.plan.title).toBe(fromLink.plan.title);
  });

  it('re-share as v2 with the same content', async () => {
    const { plan } = await importPayload(links.links.twoKidAllText, c);
    const payload = await encodePayload(plan, ALL);
    expect(payload.startsWith('2z.')).toBe(true);
    const again = await importPayload(payload, c);
    expect(strictShape(again.plan.segments)).toEqual(strictShape(plan.segments));
  });
});

describe('routine lifecycle (library level)', () => {
  const { c: tc, ids } = timingFixture();
  const settings: PlanSettings = { energy: 'some', place: 'indoors', mode: 'either', adults: 1 };
  const kids: PlanKid[] = [{ age: { value: 4, unit: 'm' }, notYet: [] }, { age: { value: 28, unit: 'm' }, notYet: [] }];

  it('routines, who, at, along, and settle survive editing, filling, saving, sharing, and files', async () => {
    let p = makePlan(kids, settings, '12:00', 240);
    p = addRoutine(p, { routine: 'nap', who: 'c1', minutes: 60, clock: 12 * 60 + 30, settle: 10 }, tc);
    p = addRoutine(p, { routine: 'milk-feed', who: 'c1', minutes: 20, clock: 12 * 60 }, tc);
    p = addRoutine(p, { routine: 'meal', who: 'c2', minutes: 25, clock: 14 * 60 }, tc);
    p = addEntry(p, { id: 'cnap', kind: 'custom', minutes: 15, label: 'Nap', who: 'c2' });
    expect(p.segments.map((s) => s.routine ?? s.kind)).toEqual(['milk-feed', 'nap', 'meal', 'custom']);
    p = setMinutes(p, 1, 75, tc);
    p = setAnchor(p, 2, 130, tc);
    p = moveEntry(p, 3, -1);
    expect(Plan.safeParse(p).success).toBe(true);

    const { plan: filled, result } = fillAround(tc, p, { seed: 3 });
    expect(Plan.safeParse(filled).success).toBe(true);
    const routines = (x: typeof p) => x.segments.filter((s) => s.kind === 'routine').map(shape);
    expect(routines(filled)).toEqual(routines(p));
    expect(filled.segments.filter((s) => s.kind === 'routine')).toHaveLength(3);
    const custom = filled.segments.find((s) => s.id === 'cnap')!;
    expect(custom).toMatchObject({ kind: 'custom', label: 'Nap', who: 'c2' });
    expect(custom.at).toBe(layoutPlan(p, tc).find((x) => x.segment.id === 'cnap')!.start);
    const along = filled.segments.filter((s) => s.along);
    expect(along.length).toBeGreaterThan(0);
    expect(along.every((s) => s.who === 'c2' && s.kind === 'activity')).toBe(true);
    const a = analyzePlan(filled, tc);
    expect(a.conflicts.filter((x) => x.kind === 'overlap' || x.kind === 'along-overrun' || x.kind === 'along-adult')).toEqual([]);
    expect(a.entries.filter((e) => e.timing.avoid)).toEqual([]);
    expect(result.notes.every((n) => !n.includes('\n'))).toBe(true);
    // Nothing alongside the baby's feed and nap is for the baby.
    expect(filled.segments.some((s) => s.kind === 'activity' && s.who === 'c1')).toBe(false);

    // Save and reload.
    const mem = new MemoryStorage();
    const store = new PlanStore(() => mem);
    store.load();
    expect(store.save(filled).ok).toBe(true);
    const back = new PlanStore(() => mem).load().plans[0];
    expect(back).toEqual(filled);

    // Share link (with custom text opted in) and plan file.
    const fromLink = await importPayload(await encodePayload(back, ALL), tc);
    expect(fromLink.dropped).toEqual([]);
    expect(fromLink.changed).toEqual([]);
    expect(strictShape(fromLink.plan.segments)).toEqual(strictShape(back.segments));
    const fromFile = importPlanFile(planFileText(back, ALL), tc);
    expect(strictShape(fromFile.plan.segments)).toEqual(strictShape(back.segments));
    // Default privacy: the custom "Nap" keeps its kind and child, not its text.
    const plain = await importPayload(await encodePayload(back, DEFAULT_SHARE_OPTIONS), tc);
    const plainCustom = plain.plan.segments.find((s) => s.kind === 'custom')!;
    expect(plainCustom).toMatchObject({ label: 'Your own activity', who: 'c2', at: custom.at });
    expect(plain.plan.segments.filter((s) => s.kind === 'routine').map(shape)).toEqual(routines(back));
    expect(JSON.stringify(toCompact(back, DEFAULT_SHARE_OPTIONS))).not.toMatch(/Nap|Grandma/);

    // The ten-plan limit still holds.
    for (let i = 1; i < MAX_PLANS; i++) expect(store.save({ ...filled, id: `p-copy-${i}` }).ok).toBe(true);
    const r = store.save({ ...filled, id: 'p-copy-eleven' });
    expect(r.ok).toBe(false);
    void ids;
  });

  it('carries locks, anchors, holding, and one-child activities through a link', async () => {
    const segments: PlanSegment[] = [
      { id: 'n1', kind: 'routine', minutes: 45, who: 'c1', routine: 'nap', at: 10, holding: true },
      { id: 'a1', kind: 'activity', ref: ids['Busy blocks'], minutes: 10, who: 'c2', along: true },
      { id: 'r1', kind: 'recipe', ref: 'mix.fixture-cards-and-books', minutes: 5, younger: 'c1', at: 60, locked: true },
      { id: 'a2', kind: 'activity', ref: ids['Contrast cards'], minutes: 5, who: 'c1' },
      { id: 'b1', kind: 'break', minutes: 10, label: 'Flexible break', at: 90, locked: true },
    ];
    const plan = { ...makePlan(kids, settings, '09:00', 120), segments };
    expect(Plan.safeParse(plan).success).toBe(true);
    const back = await importPayload(await encodePayload(plan, DEFAULT_SHARE_OPTIONS), tc);
    expect(back.dropped).toEqual([]);
    expect(strictShape(back.plan.segments)).toEqual(strictShape(segments));
  });
});

describe('reconciling v2 entries', () => {
  const { c: tc, ids } = timingFixture();
  const settings: PlanSettings = { energy: 'some', place: 'any', mode: 'either', adults: 1 };
  const baby: PlanKid = { age: { value: 4, unit: 'm' }, notYet: [] };
  const toddler: PlanKid = { age: { value: 28, unit: 'm' }, notYet: [] };

  it('checks each one-child activity against its own child, and needs a child in two-child plans', () => {
    const r = reconcileSegments([toddler, baby], settings, [
      { id: 'a1', kind: 'activity', ref: ids['Contrast cards'], minutes: 5, who: 'c2' },
      { id: 'a2', kind: 'activity', ref: ids['Contrast cards'], minutes: 5, who: 'c1' },
      { id: 'a3', kind: 'activity', ref: ids['Quiet books'], minutes: 5 },
    ], tc);
    expect(r.segments.map((s) => s.id)).toEqual(['a1']);
    expect(r.dropped.map((d) => d.reason)).toEqual(['not suitable for Child 1’s age or readiness', 'single-child activity in a two-child plan']);
  });

  it('keeps routine blocks, fixes their child for one child, and clamps estimates', () => {
    const r = reconcileSegments([baby], settings, [
      { id: 'n1', kind: 'routine', minutes: 240, who: 'c2', routine: 'milk-feed', at: 0 },
      { id: 'c1', kind: 'custom', minutes: 30, label: 'Nap', who: 'c2' },
    ], tc);
    expect(r.segments[0]).toMatchObject({ kind: 'routine', routine: 'milk-feed', who: 'c1', minutes: 90, at: 0 });
    expect(r.segments[1]).toMatchObject({ kind: 'custom', label: 'Nap', who: 'c1' });
    expect(r.adjusted).toBe(1);
    expect(r.dropped).toEqual([]);
  });

  it('removes an invalid alongside flag visibly instead of dropping the entry', () => {
    const r = reconcileSegments([baby, toddler], settings, [
      { id: 'n1', kind: 'routine', minutes: 60, who: 'c1', routine: 'nap', at: 0 },
      { id: 'a1', kind: 'activity', ref: ids['Busy blocks'], minutes: 10, who: 'c2', along: true },
      { id: 'c1', kind: 'custom', minutes: 10, label: 'Snack', who: 'c1', along: true },
      { id: 'n2', kind: 'routine', minutes: 30, who: 'both', routine: 'nap', at: 90 },
      { id: 'c2', kind: 'custom', minutes: 10, label: 'Walk', who: 'c2', along: true },
    ], tc);
    expect(r.segments.map((s) => [s.id, s.along ?? false])).toEqual([['n1', false], ['a1', true], ['c1', false], ['n2', false], ['c2', false]]);
    expect(r.changed).toHaveLength(2);
    expect(r.changed[0]).toMatchObject({ label: 'Snack' });
    expect(Plan.safeParse({ ...makePlan([baby, toddler], settings, '10:00', 120), segments: r.segments }).success).toBe(true);
    const one = reconcileSegments([baby], settings, [{ id: 'n1', kind: 'routine', minutes: 60, who: 'c1', routine: 'nap', at: 0 }, { id: 'c1', kind: 'custom', minutes: 10, label: 'x', who: 'c2', along: true }], tc);
    expect(one.segments[1]).toMatchObject({ who: 'c1' });
    expect(one.segments[1].along).toBeUndefined();
  });

  it('applies the same checks to an imported v2 link', async () => {
    const encode = (obj: unknown) => `2j.${btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    const compact = {
      s: '10:00',
      w: 120,
      k: [[4, 'm'], [28, 'm']],
      o: [2, 0, 0, 1],
      g: [
        ['n', 'nap', 60, '1', 0, { s: 10 }],
        ['a', 'fixture-busy-blocks', 10, { w: '2', g: 1 }],
        ['a', 'fixture-cards', 10, { w: '2', g: 1 }],
        ['r', 'fixture-cards-and-books', 5, '2', { g: 1, l: 1 }],
        ['n', 'snack', 15, '2', 70, { h: 1, s: 5 }],
      ],
    };
    const r = await importPayload(encode(compact), tc);
    expect(r.dropped.map((d) => d.label)).toEqual(['Contrast cards']);
    const segs = r.plan.segments;
    expect(segs[0]).toMatchObject({ routine: 'nap', settle: 10, who: 'c1' });
    expect(segs[1]).toMatchObject({ ref: ids['Busy blocks'], who: 'c2', along: true });
    // A pairing can't run alongside; a lock needs a time; settle/holding are nap-only.
    expect(segs[2]).toMatchObject({ kind: 'recipe', younger: 'c1' });
    expect(segs[2].along).toBeUndefined();
    expect(segs[2].locked).toBeUndefined();
    expect(segs[3]).toMatchObject({ routine: 'snack', at: 70 });
    expect(segs[3].holding).toBeUndefined();
    expect(Plan.safeParse(r.plan).success).toBe(true);
  });
});

describe('a v1 tab left open after the update (review M5, real v1 PlanStore from b9cec90)', () => {
  const v2plan = (): Plan => ({
    ...makePlan([{ age: { value: 4, unit: 'm' }, notYet: [] }], { energy: 'some', place: 'any', mode: 'either', adults: 1 }, '12:00', 90),
    id: 'p-newplan-1234',
    title: 'Nap day',
    segments: [{ id: 'n1', kind: 'routine', minutes: 45, who: 'c1', routine: 'nap', at: 15 }],
  });

  it('a v1 write over v2 data loses nothing, is reported, and the next write restores v2', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, savedText);
    const oldTab = new V1Store(() => mem);
    const old = oldTab.load();
    expect(old.plans).toHaveLength(4);
    const newTab = new PlanStore(() => mem);
    newTab.load();
    expect(newTab.save(v2plan()).ok).toBe(true);
    expect(JSON.parse(mem.getItem(STORE_KEY)!)).toMatchObject({ version: 2 });
    expect(mem.getItem(MIRROR_KEY)).toBe(mem.getItem(STORE_KEY));
    // The old build doesn't notice and writes a v1 envelope without the new plan.
    expect(oldTab.save({ ...old.plans[0], title: 'Rainy morning (edited)' }).ok).toBe(true);
    const downgraded = mem.getItem(STORE_KEY)!;
    expect(JSON.parse(downgraded).version).toBe(1);
    expect(downgraded).not.toContain('p-newplan-1234');

    // The new tab notices on its next read.
    const seen = newTab.refresh();
    expect(seen.map((p) => p.id)).toContain('p-newplan-1234');
    expect(seen).toHaveLength(5);
    expect(newTab.getStatus()).toBe('recovered');
    expect(newTab.getMessage()).toBe('An older version of Trunk changed your saved plans in another tab. Trunk kept both versions.');
    expect(mem.getItem(BACKUP_KEY)).toBe(downgraded);
    // A tab opened now sees the same.
    const fresh = new PlanStore(() => mem).load();
    expect(fresh.status).toBe('recovered');
    expect(fresh.plans.map((p) => p.id)).toEqual(seen.map((p) => p.id));
    expect(fresh.message).toMatch(/older version of Trunk/);

    // The next write restores v2 with every plan; the one-time v1 copy is untouched.
    expect(newTab.save({ ...v2plan(), title: 'Nap day (edited)' }).ok).toBe(true);
    expect(newTab.getStatus()).toBe('ok');
    const restored = JSON.parse(mem.getItem(STORE_KEY)!);
    expect(restored.version).toBe(2);
    expect(restored.plans.map((p: { id: string }) => p.id)).toEqual(seen.map((p) => p.id));
    expect(new PlanStore(() => mem).load()).toMatchObject({ status: 'ok' });
    expect(mem.getItem(LEGACY_KEY)).toBe(savedText);
  });

  it('keeps new plans from the older text up to the limit and sets the rest aside', () => {
    const mem = new MemoryStorage();
    const ten = Array.from({ length: MAX_PLANS }, (_, i) => ({ ...migratePlan(savedFixture.plans[0])!.plan, id: `p-mirror-${i}` }));
    const mirror = JSON.stringify({ version: 2, plans: ten });
    mem.setItem(MIRROR_KEY, mirror);
    mem.setItem(BACKUP_KEY, 'an earlier backup');
    const older = JSON.stringify({ version: 1, plans: [savedFixture.plans[1], savedFixture.plans[2], { ...savedFixture.plans[0], id: 'p-mirror-0', title: 'v1 edit' }] });
    mem.setItem(STORE_KEY, older);
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('recovered');
    expect(r.plans.map((p) => p.id)).toEqual(ten.map((p) => p.id));
    expect(r.plans[0].title).toBe(ten[0].title);
    expect(r.message).toMatch(/2 plans didn’t fit the 10-plan limit/);
    expect(mem.getItem(BACKUP_KEY)).toBe('an earlier backup');
    expect(mem.getItem(DOWNGRADE_KEY)).toBe(older);
  });

  it('falls back to reading the older data when the mirror is unreadable', () => {
    const mem = new MemoryStorage();
    mem.setItem(MIRROR_KEY, '{damaged');
    mem.setItem(STORE_KEY, savedText);
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('ok');
    expect(r.plans).toHaveLength(savedFixture.plans.length);
  });

  it('review m11: if the one-time v1 copy can’t be written, the v1 text isn’t overwritten', () => {
    class LegacyFull extends MemoryStorage {
      override setItem(key: string, value: string) {
        if (key === LEGACY_KEY) throw new DOMException('full', 'QuotaExceededError');
        super.setItem(key, value);
      }
    }
    const mem = new LegacyFull();
    mem.setItem(STORE_KEY, savedText);
    const store = new PlanStore(() => mem);
    const [first] = store.load().plans;
    const r = store.save({ ...first, title: 'Edited' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('quota');
    expect(mem.getItem(STORE_KEY)).toBe(savedText);
    expect(mem.getItem(MIRROR_KEY)).toBeNull();
  });
});
