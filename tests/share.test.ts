import { describe, expect, it } from 'vitest';
import { PLAN_VERSION, type Plan } from '../src/lib/plan.ts';
import {
  bytesToBase64Url,
  decodePayload,
  DEFAULT_SHARE_OPTIONS,
  encodePayload,
  importPayload,
  importPlanFile,
  MAX_LINK_LENGTH,
  planFileText,
  reconcile,
  shareUrl,
  ShareError,
  toCompact,
} from '../src/lib/share.ts';
import { cleanText } from '../src/lib/text.ts';
import { fixtureCatalog, loadFixture, variant } from './helpers.ts';

const f = loadFixture();
const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;
const recipe = f.recipes[0];

function samplePlan(extra: Partial<Plan> = {}): Plan {
  return {
    v: PLAN_VERSION,
    id: 'p-local-1',
    title: 'Maya and Theo, Tuesday',
    kids: [
      { age: { value: 6, unit: 'w' }, notYet: [] },
      { age: { value: 28, unit: 'm' }, notYet: ['jumps'] },
    ],
    start: '16:30',
    window: 90,
    settings: { energy: 'low', place: 'indoors', mode: 'either', adults: 1 },
    segments: [
      { id: 'r1', kind: 'recipe', ref: recipe.id, minutes: 4, younger: 'c1' },
      { id: 'b1', kind: 'break', minutes: 10, label: 'Flexible break' },
      { id: 'c1', kind: 'custom', minutes: 20, who: 'c2', label: 'Grandma Ruth video call' },
    ],
    notes: 'Theo has a cold; skip the park.',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    ...extra,
  };
}

const payloadOf = (url: string) => url.split('#/s/')[1];

describe('share links', () => {
  const c = fixtureCatalog();

  it('round-trips a plan through a compressed fragment link', async () => {
    const payload = await encodePayload(samplePlan(), DEFAULT_SHARE_OPTIONS);
    expect(payload).toMatch(/^2z\.[A-Za-z0-9_-]+$/);
    const url = shareUrl('https://example.github.io/trunk/#/plan', payload);
    expect(url.startsWith('https://example.github.io/trunk/#/s/2z.')).toBe(true);
    const { plan, dropped } = await importPayload(payloadOf(url), c);
    expect(dropped).toEqual([]);
    expect(plan.start).toBe('16:30');
    expect(plan.kids.map((k) => k.age)).toEqual([
      { value: 6, unit: 'w' },
      { value: 28, unit: 'm' },
    ]);
    expect(plan.segments.map((s) => [s.kind, s.ref, s.minutes])).toEqual([
      ['recipe', recipe.id, 4],
      ['break', undefined, 10],
      ['custom', undefined, 20],
    ]);
    expect(plan.segments[0].younger).toBe('c1');
    expect(plan.id).not.toBe('p-local-1');
  });

  it('leaves out names, custom text, notes, and readiness by default', async () => {
    const compact = toCompact(samplePlan(), DEFAULT_SHARE_OPTIONS);
    const text = JSON.stringify(compact);
    expect(text).not.toMatch(/Maya|Theo|Grandma|cold|jumps/);
    const { plan } = await importPayload(await encodePayload(samplePlan(), DEFAULT_SHARE_OPTIONS), c);
    expect(plan.title).toBe('Shared plan');
    expect(plan.notes).toBe('');
    expect(plan.segments[2].label).toBe('Your own activity');
    expect(plan.kids[1].notYet).toEqual([]);
  });

  it('includes title, custom text, and notes only when chosen', async () => {
    const opts = { includeTitle: true, includeCustomText: true, includeNotes: true };
    const { plan } = await importPayload(await encodePayload(samplePlan(), opts), c);
    expect(plan.title).toBe('Maya and Theo, Tuesday');
    expect(plan.segments[2].label).toBe('Grandma Ruth video call');
    expect(plan.notes).toBe('Theo has a cold; skip the park.');
  });

  it('keeps a typical plan well inside the link budget', async () => {
    const segments = Array.from({ length: 10 }, (_, i) =>
      i % 2 ? { id: `b${i}`, kind: 'break' as const, minutes: 10 } : { id: `r${i}`, kind: 'recipe' as const, ref: recipe.id, minutes: 4, younger: 'c1' as const },
    );
    const url = shareUrl('https://jeisey.github.io/trunk/', await encodePayload(samplePlan({ segments }), DEFAULT_SHARE_OPTIONS));
    expect(url.length).toBeLessThan(MAX_LINK_LENGTH / 2);
  });

  it('keeps a busy v2 plan (routines, alongside, anchors, locks) inside the link budget', async () => {
    const segments: Plan['segments'] = [
      { id: 'f1', kind: 'routine', minutes: 20, who: 'c1', routine: 'milk-feed', at: 0 },
      { id: 'n1', kind: 'routine', minutes: 90, who: 'c1', routine: 'nap', at: 30, settle: 10 },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, kind: 'activity' as const, ref: books.id, minutes: 10, who: 'c2' as const, along: true as const })),
      { id: 'm1', kind: 'routine', minutes: 30, who: 'both', routine: 'meal', at: 130 },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, kind: 'recipe' as const, ref: recipe.id, minutes: 4, younger: 'c1' as const, ...(i % 3 === 0 ? { at: 170 + i * 10, locked: true as const } : {}) })),
      { id: 's1', kind: 'routine', minutes: 15, who: 'c2', routine: 'snack', at: 300, holding: undefined },
    ].map((s) => JSON.parse(JSON.stringify(s)));
    const payload = await encodePayload(samplePlan({ segments, window: 360 }), DEFAULT_SHARE_OPTIONS);
    expect(payload.startsWith('2z.')).toBe(true);
    expect(shareUrl('https://jeisey.github.io/trunk/', payload).length).toBeLessThan(MAX_LINK_LENGTH / 2);
    const { plan } = await importPayload(payload, c);
    expect(plan.segments.filter((s) => s.kind === 'routine').map((s) => [s.routine, s.who, s.at, s.settle])).toEqual([
      ['milk-feed', 'c1', 0, undefined],
      ['nap', 'c1', 30, 10],
      ['meal', 'both', 130, undefined],
      ['snack', 'c2', 300, undefined],
    ]);
    expect(plan.segments.filter((s) => s.along)).toHaveLength(6);
    expect(plan.segments.filter((s) => s.locked).map((s) => s.at)).toEqual([170, 200, 230]);
  });

  it('reports links that exceed the budget so the UI can offer images instead', async () => {
    // Incompressible text at the maximum lengths parents can type.
    const rand = (n: number) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);
    const noisy = Array.from({ length: 24 }, (_, i) => ({ id: `c${i}`, kind: 'custom' as const, minutes: 5, label: rand(80) }));
    const url = shareUrl('https://jeisey.github.io/trunk/', await encodePayload(samplePlan({ segments: noisy, notes: rand(500) }), { includeTitle: true, includeCustomText: true, includeNotes: true }));
    expect(url.length).toBeGreaterThan(MAX_LINK_LENGTH);
  });

  it.each([
    ['garbage', 'hello', 'malformed'],
    ['newer version', '3z.AAAA', 'version'],
    ['much newer version', '12z.AAAA', 'version'],
    ['older version', '0z.AAAA', 'version'],
    ['bad base64', '2z.@@@@', 'malformed'],
    ['unknown codec', '2q.AAAA', 'version'],
    ['not deflate data', '2z.AAAA', 'malformed'],
    ['not deflate data (v1)', '1z.AAAA', 'malformed'],
    ['huge input', `2z.${'A'.repeat(7000)}`, 'too-large'],
  ])('fails gracefully on %s', async (_name, payload, code) => {
    await expect(decodePayload(payload)).rejects.toSatisfy((e: unknown) => e instanceof ShareError && e.code === code);
  });

  it('stops decompression bombs at the size limit', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ s: '10:00', pad: ' '.repeat(200_000) }));
    const stream = new Blob([big]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const z = new Uint8Array(await new Response(stream).arrayBuffer());
    for (const v of ['1', '2']) {
      const payload = `${v}z.${bytesToBase64Url(z)}`;
      expect(payload.length).toBeLessThan(6000);
      await expect(decodePayload(payload)).rejects.toSatisfy((e: unknown) => e instanceof ShareError && e.code === 'too-large');
    }
  });

  it('rejects schema-invalid payloads, including unknown keys', async () => {
    const encode = (obj: unknown, v = 2) => `${v}j.${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)))}`;
    const good = toCompact(samplePlan(), DEFAULT_SHARE_OPTIONS);
    await expect(decodePayload(encode(good))).resolves.toBeTruthy();
    await expect(decodePayload(encode(good, 1))).resolves.toBeTruthy();
    // v2-only entries are not accepted under the v1 format number.
    const routine = { ...good, g: [['n', 'nap', 60, '1', 30, { s: 10 }]] };
    await expect(decodePayload(encode(routine))).resolves.toBeTruthy();
    await expect(decodePayload(encode(routine, 1))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, g: [['n', 'nap', 60, '1', 30, { evil: 1 }]] }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, g: [['n', 'bath', 60, '1', 30]] }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, g: [['a', 'x', 5, { t: 5000 }]] }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, evil: 1 }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, w: 99999 }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, g: [['a', '../../etc', 5]] }))).rejects.toBeInstanceOf(ShareError);
    await expect(decodePayload(encode({ ...good, k: [] }))).rejects.toBeInstanceOf(ShareError);
  });

  it('applies current eligibility: retired, missing, and wrong-age items are dropped, lengths clamped', () => {
    const retired = variant(books, { id: 'act.fixture-retired', retired: { date: '2026-10-01', reason: 'Updated guidance' } });
    const cat = fixtureCatalog({ activities: [retired] });
    const compact = {
      s: '09:00',
      w: 60,
      k: [[30, 'm']] as [number, 'w' | 'm'][],
      o: [2, 0, 0, 1] as [number, number, number, 1],
      g: [
        ['a', 'fixture-board-book-basket', 200],
        ['a', 'fixture-retired', 10],
        ['a', 'no-such-thing', 10],
        ['a', 'fixture-floor-tummy-time', 3],
      ] as ['a', string, number][],
    };
    const r = reconcile(compact, cat);
    expect(r.plan.segments.map((s) => s.ref)).toEqual([books.id]);
    expect(r.plan.segments[0].minutes).toBe(books.duration.max);
    expect(r.adjusted).toBe(1);
    expect(r.dropped).toHaveLength(3);
  });

  it('cleans imported text of control and direction-override characters', async () => {
    const opts = { includeTitle: true, includeCustomText: true, includeNotes: true };
    const nasty = samplePlan({ title: 'Safe‮txt.exe\u0000 <script>alert(1)</script>' });
    const { plan } = await importPayload(await encodePayload(nasty, opts), c);
    expect(plan.title).not.toMatch(/[‮\u0000]/);
    expect(plan.title.length).toBeLessThanOrEqual(60);
    // Markup is kept as inert text; React renders it escaped.
    expect(plan.title).toContain('<script>');
  });

  it('imports a downloaded plan file through the same checks', async () => {
    const file = JSON.stringify({ trunkPlan: 1, plan: toCompact(samplePlan(), DEFAULT_SHARE_OPTIONS) });
    expect(importPlanFile(file, c).plan.segments).toHaveLength(3);
    expect(importPlanFile(planFileText(samplePlan(), DEFAULT_SHARE_OPTIONS), c).plan.segments).toHaveLength(3);
    expect(JSON.parse(planFileText(samplePlan(), DEFAULT_SHARE_OPTIONS)).trunkPlan).toBe(2);
    expect(() => importPlanFile('{"trunkPlan":2,"plan":{}}', c)).toThrow(ShareError);
    expect(() => importPlanFile('nope', c)).toThrow(ShareError);
    try {
      importPlanFile('{"trunkPlan":3,"plan":{}}', c);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShareError);
      expect((e as ShareError).code).toBe('version');
      expect((e as ShareError).message).toMatch(/newer version/);
    }
  });
});

describe('text safety', () => {
  it('normalizes, strips controls, collapses whitespace, and truncates', () => {
    expect(cleanText('  hello \n\t world  ', 50)).toBe('hello world');
    expect(cleanText('a​b‮c\u0007d', 50)).toBe('abcd');
    expect(cleanText('x'.repeat(100), 10)).toBe('x'.repeat(10));
    expect(cleanText('line one\r\n\r\n\r\nline two', 100, { multiline: true })).toBe('line one\n\nline two');
    expect(cleanText(42, 10)).toBe('');
  });
});
