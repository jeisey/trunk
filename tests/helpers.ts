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
