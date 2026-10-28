import { describe, expect, it } from 'vitest';
import { PLAN_VERSION, type Plan } from '../src/lib/plan.ts';
import { BACKUP_KEY, MAX_PLANS, migrate, PlanStore, STORE_KEY } from '../src/lib/storage.ts';
import { MemoryStorage } from './helpers.ts';

function plan(n: number, extra: Partial<Plan> = {}): Plan {
  return {
    v: PLAN_VERSION,
    id: `p-test-${n}`,
    title: `Plan ${n}`,
    kids: [{ age: { value: 4, unit: 'm' }, notYet: [] }],
    start: '16:00',
    window: 90,
    settings: { energy: 'some', place: 'any', mode: 'either', adults: 1 },
    segments: [{ id: 'b1', kind: 'break', minutes: 10, label: 'Flexible break' }],
    notes: '',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    ...extra,
  };
}

const fresh = () => {
  const mem = new MemoryStorage();
  const store = new PlanStore(() => mem);
  store.load();
  return { mem, store };
};

describe('saved plans', () => {
  it('saves ten plans and rejects an eleventh without overwriting anything', () => {
    const { mem, store } = fresh();
    for (let i = 1; i <= MAX_PLANS; i++) expect(store.save(plan(i)).ok).toBe(true);
    const before = mem.getItem(STORE_KEY);
    const r = store.save(plan(11));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('limit');
    expect(mem.getItem(STORE_KEY)).toBe(before);
    expect(store.list().map((p) => p.id)).toEqual(Array.from({ length: 10 }, (_, i) => `p-test-${i + 1}`));
  });

  it('still allows updating an existing plan when full', () => {
    const { store } = fresh();
    for (let i = 1; i <= MAX_PLANS; i++) store.save(plan(i));
    const r = store.save(plan(3, { title: 'Renamed' }));
    expect(r.ok && r.action).toBe('updated');
    expect(store.list().find((p) => p.id === 'p-test-3')?.title).toBe('Renamed');
  });

  it('persists across reloads and supports delete with undo at the same position', () => {
    const { mem, store } = fresh();
    [1, 2, 3].forEach((i) => store.save(plan(i)));
    const r = store.remove('p-test-2');
    expect(r.ok && r.removed?.id).toBe('p-test-2');
    const reloaded = new PlanStore(() => mem);
    expect(reloaded.load().plans.map((p) => p.id)).toEqual(['p-test-1', 'p-test-3']);
    reloaded.restore(r.ok ? r.removed! : plan(2), r.ok ? r.index! : 1);
    expect(new PlanStore(() => mem).load().plans.map((p) => p.id)).toEqual(['p-test-1', 'p-test-2', 'p-test-3']);
  });

  it('rejects malformed plans instead of storing them', () => {
    const { store } = fresh();
    const r = store.save({ ...plan(1), window: -5 } as Plan);
    expect(r.ok).toBe(false);
  });

  it('backs up corrupt JSON and keeps working', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, '{not json');
    const store = new PlanStore(() => mem);
    const r = store.load();
    expect(r.status).toBe('recovered');
    expect(r.plans).toEqual([]);
    expect(mem.getItem(BACKUP_KEY)).toBe('{not json');
    expect(store.save(plan(1)).ok).toBe(true);
    // The backup is never overwritten by later saves.
    expect(mem.getItem(BACKUP_KEY)).toBe('{not json');
  });

  it('salvages readable plans when some are invalid', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, JSON.stringify({ version: 1, plans: [plan(1), { id: 'broken' }, plan(2)] }));
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('recovered');
    expect(r.plans.map((p) => p.id)).toEqual(['p-test-1', 'p-test-2']);
    expect(r.message).toMatch(/Some saved plans/);
  });

  it('migrates the pre-envelope (version 0) array format', () => {
    expect(migrate([plan(1)])).toEqual({ version: 1, plans: [plan(1)] });
    const mem = new MemoryStorage();
    mem.setItem(STORE_KEY, JSON.stringify([plan(1), plan(2)]));
    const r = new PlanStore(() => mem).load();
    expect(r.status).toBe('ok');
    expect(r.plans).toHaveLength(2);
  });

  it('leaves data from a newer version untouched', () => {
    const mem = new MemoryStorage();
    const newer = JSON.stringify({ version: 9, plans: [{ anything: true }] });
    mem.setItem(STORE_KEY, newer);
    const store = new PlanStore(() => mem);
    expect(store.load().status).toBe('newer');
    const r = store.save(plan(1));
    expect(r.ok).toBe(false);
    expect(mem.getItem(STORE_KEY)).toBe(newer);
  });

  it('reports blocked storage without throwing', () => {
    const store = new PlanStore(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(store.load().status).toBe('unavailable');
    const r = store.save(plan(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unavailable');
  });

  it('reports a quota error and keeps the previous saved list', () => {
    const { mem, store } = fresh();
    store.save(plan(1));
    mem.failWrites = 'quota';
    const r = store.save(plan(2));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('quota');
    expect(store.list().map((p) => p.id)).toEqual(['p-test-1']);
  });
});
