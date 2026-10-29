import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentFile, type Activity, type ContentFile as ContentFileT } from '../src/content/schema.ts';
import { validateCatalog } from '../src/content/validate.ts';
import { indexCatalog, type IndexedCatalog } from '../src/content/catalog.ts';

export const root = join(import.meta.dirname, '..');

export function loadFixture(): ContentFileT {
  return ContentFile.parse(JSON.parse(readFileSync(join(root, 'tests/fixtures/valid/fixture.json'), 'utf8')));
}

export function rawFixture(): Record<string, unknown> & { activities: Record<string, unknown>[]; recipes: Record<string, unknown>[]; claims: Record<string, unknown>[]; sources: Record<string, unknown>[] } {
  return JSON.parse(readFileSync(join(root, 'tests/fixtures/valid/fixture.json'), 'utf8'));
}

export function fixtureCatalog(extra: Partial<ContentFileT> = {}): IndexedCatalog {
  const f = loadFixture();
  const merged = {
    ...f,
    activities: [...f.activities, ...(extra.activities ?? [])],
    recipes: [...f.recipes, ...(extra.recipes ?? [])],
    claims: [...f.claims, ...(extra.claims ?? [])],
    timingRules: [...f.timingRules, ...(extra.timingRules ?? [])],
    starterPlans: [...f.starterPlans, ...(extra.starterPlans ?? [])],
  };
  const r = validateCatalog([{ file: 'fixture', data: merged }]);
  if (r.errors.length) throw new Error(r.errors.map((e) => `${e.id}: ${e.message}`).join('\n'));
  return indexCatalog(r.catalog);
}

/** A deep copy of a fixture activity with overrides. */
export function variant(base: Activity, patch: Partial<Activity> & { id: string }): Activity {
  return { ...structuredClone(base), ...patch };
}

/** In-memory Storage double with optional failure modes. */
export class MemoryStorage implements Storage {
  data = new Map<string, string>();
  failWrites: 'quota' | 'blocked' | null = null;
  quotaBytes: number | null = null;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites === 'blocked') throw new DOMException('blocked', 'SecurityError');
    if (this.failWrites === 'quota' || (this.quotaBytes !== null && value.length > this.quotaBytes && !key.startsWith('__'))) {
      throw new DOMException('full', 'QuotaExceededError');
    }
    this.data.set(key, value);
  }
}

// ---------- Timing fixtures (additive; deterministic, explicit stimulation) ----------

import type { TimingRule } from '../src/content/schema.ts';

export const timingRule = (id: string, patch: Partial<TimingRule>): TimingRule => ({
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

/** Fixture copies of Trunk's core nap policies, plus an infant-only after-feed rule. */
export const fixturePolicies: TimingRule[] = [
  timingRule('tim.core.fixture-wind-down', { match: { stimulation: ['settling'] }, cue: 'Good for winding down' }),
  timingRule('tim.core.fixture-lively-earlier', { match: { stimulation: ['lively'] }, fit: 'later', cue: 'Better earlier' }),
  timingRule('tim.core.fixture-gentle-start', { when: 'after', window: { minutes: 15, basis: 'editorial' }, match: { stimulation: ['settling', 'gentle'] }, cue: 'Gentle start after waking' }),
  timingRule('tim.core.fixture-ease-in', { when: 'after', window: { minutes: 15, basis: 'editorial' }, match: { stimulation: ['lively'] }, fit: 'later', cue: 'Ease in after waking' }),
  timingRule('tim.core.fixture-infant-only', { event: 'milk-feed', when: 'after', fit: 'avoid', ageMin: '1w', ageMax: '12m', cue: 'Infant-only rule' }),
];

/**
 * A small catalog with rated records for an infant (1w–12m) and a toddler (12m–60m):
 * tummy time with both feed rules, settling/gentle/lively ideas for each, and the
 * fixture pairing. Everything is a variant of the two fixture activities.
 */
export function timingFixture(): { c: IndexedCatalog; ids: Record<string, string> } {
  const f = loadFixture();
  const tummy = f.activities.find((a) => a.id === 'act.fixture-floor-tummy-time')!;
  const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;
  const infant = (id: string, title: string, patch: Partial<Activity>): Activity =>
    variant(tummy, { id, title, ageMin: '1w', ageMax: '12m', tummyTime: undefined, hazards: [], timing: { stimulation: 'gentle', rules: [] }, ...patch });
  const toddler = (id: string, title: string, patch: Partial<Activity>): Activity =>
    variant(books, { id, title, ageMin: '12m', ageMax: '60m', timing: { stimulation: 'gentle', rules: [] }, ...patch });
  const activities: Activity[] = [
    variant(tummy, { id: 'act.fixture-tummy-mat', title: 'Tummy mat', ageMax: '12m', duration: { min: 2, default: 5, max: 10 }, timing: { stimulation: 'gentle', rules: ['tim.core.fixture-tummy-after-feed', 'tim.core.fixture-tummy-before-feed'] } }),
    infant('act.fixture-lullaby', 'Lullaby', { intents: ['calm'], setupMinutes: 0, cleanupMinutes: 0, duration: { min: 3, default: 8, max: 12 }, timing: { stimulation: 'settling', rules: [] } }),
    infant('act.fixture-cards', 'Contrast cards', { intents: ['explore'], duration: { min: 3, default: 6, max: 10 } }),
    infant('act.fixture-kick-gym', 'Kick gym', { intents: ['move'], noise: 'moderate', cleanupMinutes: 1, duration: { min: 5, default: 10, max: 15 }, timing: { stimulation: 'lively', rules: [] } }),
    infant('act.fixture-rattles', 'Rattles', { intents: ['explore', 'move'], noise: 'loud', cleanupMinutes: 2, duration: { min: 4, default: 8, max: 12 }, timing: { stimulation: 'lively', rules: [] } }),
    toddler('act.fixture-quiet-books', 'Quiet books', { timing: { stimulation: 'settling', rules: [] } }),
    toddler('act.fixture-dance', 'Dance party', { intents: ['move'], noise: 'loud', ageMin: '1w', timing: { stimulation: 'lively', rules: ['tim.core.fixture-infant-only'] } }),
    toddler('act.fixture-busy-blocks', 'Busy blocks', {
      intents: ['explore'],
      ageMin: '18m',
      supervision: { participation: 'watches', proximity: 'same-room', handsOn: 'none', minAdults: 1, shareable: true, space: 'Near you on the floor.' },
    }),
    toddler('act.fixture-led-books', 'Read together', {
      intents: ['connect'],
      supervision: { participation: 'leads', proximity: 'arms-reach', handsOn: 'intermittent', minAdults: 1, shareable: true, space: 'Next to you.' },
    }),
    toddler('act.fixture-ball-run', 'Ball run', { intents: ['move'], noise: 'moderate', timing: { stimulation: 'lively', rules: [] } }),
    toddler('act.fixture-unrated', 'Unrated idea', { intents: ['create'], timing: { stimulation: 'variable', rules: [] } }),
  ];
  const c = fixtureCatalog({ timingRules: fixturePolicies, activities });
  return { c, ids: Object.fromEntries(activities.map((a) => [a.title, a.id])) };
}
