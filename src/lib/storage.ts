/**
 * Saved plans in this browser's localStorage, versioned.
 *
 * - At most MAX_PLANS plans. A full store rejects new plans; it never
 *   overwrites an existing plan to make room.
 * - Corrupt data is backed up under BACKUP_KEY before anything is rewritten,
 *   and readable plans are salvaged.
 * - Blocked storage (private modes, disabled site data) and quota errors are
 *   reported; the current in-memory plan is never discarded.
 * - Data written by a newer version (a newer envelope or any newer plan) is
 *   left untouched (read-only mode).
 * - Envelope v2 holds plan v2. Older envelopes (v1 `{version: 1, plans}` and the
 *   pre-envelope bare array) are read and migrated in memory with migratePlan;
 *   before the first v2 write over them, the original text is copied once to
 *   LEGACY_KEY (never overwritten), so an older build's data is never lost.
 */
import * as z from 'zod/mini';
import { isNewerPlan, migratePlan, type Plan } from './plan.ts';

export const STORE_KEY = 'trunk.plans';
export const BACKUP_KEY = 'trunk.plans.backup';
/** One-time copy of the v1 (or pre-envelope) text, taken before the first v2 write. */
export const LEGACY_KEY = 'trunk.plans.v1';
export const STORE_VERSION = 2;
export const MAX_PLANS = 10;

export type StoreStatus = 'ok' | 'unavailable' | 'recovered' | 'newer';

export type SaveResult =
  | { ok: true; plans: Plan[]; action: 'created' | 'updated' }
  | { ok: false; reason: 'limit' | 'quota' | 'unavailable' | 'newer' | 'invalid'; message: string };

interface Envelope {
  /** The envelope version as stored: 0 for the pre-envelope bare array, then 1 or 2. */
  version: number;
  plans: unknown[];
}

const Stored = z.strictObject({ version: z.union([z.literal(1), z.literal(2)]), plans: z.array(z.unknown()) });

/**
 * Read any known envelope. Version 0 is the pre-envelope shape (a bare array of
 * plans) used by early builds; it is kept so the migration path is exercised
 * and tested. Plans inside are migrated separately (readPlans).
 */
export function migrate(raw: unknown): Envelope | 'newer' | null {
  if (Array.isArray(raw)) return raw.some(isNewerPlan) ? 'newer' : { version: 0, plans: raw };
  if (typeof raw !== 'object' || raw === null) return null;
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > STORE_VERSION) return 'newer';
  const env = Stored.safeParse(raw);
  if (!env.success) return null;
  if (env.data.plans.some(isNewerPlan)) return 'newer';
  return env.data;
}

/** Migrate every plan; `bad` counts unreadable entries, duplicates, and entries past the limit. */
function readPlans(env: Envelope, limit = MAX_PLANS): { plans: Plan[]; bad: number } {
  const plans: Plan[] = [];
  let bad = 0;
  for (const item of env.plans) {
    const m = migratePlan(item);
    if (m && plans.length < limit && !plans.some((p) => p.id === m.plan.id)) plans.push(m.plan);
    else bad++;
  }
  return { plans, bad };
}

export interface LoadResult {
  plans: Plan[];
  status: StoreStatus;
  message?: string;
}

function safeStorage(getStorage: () => Storage | null): Storage | null {
  try {
    const s = getStorage();
    if (!s) return null;
    const probe = '__trunk_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
  );
}

export class PlanStore {
  private storage: Storage | null;
  private status: StoreStatus = 'ok';
  private plans: Plan[] = [];

  constructor(getStorage: () => Storage | null = () => (typeof window === 'undefined' ? null : window.localStorage)) {
    this.storage = safeStorage(getStorage);
  }

  load(): LoadResult {
    if (!this.storage) {
      this.status = 'unavailable';
      return { plans: [], status: 'unavailable', message: 'This browser isn’t letting Trunk save plans (private mode or blocked site data). You can still make and share plans.' };
    }
    let text: string | null;
    try {
      text = this.storage.getItem(STORE_KEY);
    } catch {
      this.status = 'unavailable';
      return { plans: [], status: 'unavailable', message: 'Saved plans couldn’t be read in this browser.' };
    }
    if (text === null) {
      this.plans = [];
      this.status = 'ok';
      return { plans: [], status: 'ok' };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.recover(text, []);
    }
    const env = migrate(parsed);
    if (env === 'newer') {
      this.status = 'newer';
      return { plans: [], status: 'newer', message: 'Your saved plans were made by a newer version of Trunk. Refresh to update; they haven’t been changed.' };
    }
    if (!env) return this.recover(text, []);
    const { plans: good, bad } = readPlans(env);
    if (bad > 0) return this.recover(text, good);
    this.plans = good;
    this.status = 'ok';
    return { plans: good, status: 'ok' };
  }

  private recover(rawText: string, salvaged: Plan[]): LoadResult {
    try {
      if (this.storage && this.storage.getItem(BACKUP_KEY) === null) this.storage.setItem(BACKUP_KEY, rawText);
    } catch {
      /* best effort; the original text is still in STORE_KEY until the next successful save */
    }
    this.plans = salvaged;
    this.status = 'recovered';
    const lost = salvaged.length ? 'Some saved plans couldn’t be read' : 'Saved plans couldn’t be read';
    return { plans: salvaged, status: 'recovered', message: `${lost}. A copy was set aside in this browser; everything readable is below.` };
  }

  private write(plans: Plan[]): SaveResult | null {
    if (this.status === 'newer') return { ok: false, reason: 'newer', message: 'Saving is paused because your saved plans came from a newer version of Trunk.' };
    if (!this.storage) return { ok: false, reason: 'unavailable', message: 'Saving isn’t available in this browser. Share the plan or keep this tab open.' };
    this.keepLegacyCopy();
    try {
      this.storage.setItem(STORE_KEY, JSON.stringify({ version: STORE_VERSION, plans }));
    } catch (e) {
      if (isQuotaError(e)) return { ok: false, reason: 'quota', message: 'This browser’s storage is full, so the plan wasn’t saved. Your plan is still open here.' };
      return { ok: false, reason: 'unavailable', message: 'The browser blocked saving. Your plan is still open here.' };
    }
    this.plans = plans;
    if (this.status === 'recovered') this.status = 'ok';
    return null;
  }

  /** Before the first v2 write over older data, copy the original text once (never overwriting an earlier copy). */
  private keepLegacyCopy(): void {
    if (!this.storage) return;
    try {
      const text = this.storage.getItem(STORE_KEY);
      if (text === null || this.storage.getItem(LEGACY_KEY) !== null) return;
      const env = migrate(JSON.parse(text));
      if (env && env !== 'newer' && env.version < STORE_VERSION) this.storage.setItem(LEGACY_KEY, text);
    } catch {
      /* best effort: unreadable text is covered by BACKUP_KEY, and the plans themselves were migrated */
    }
  }

  /**
   * Re-read what is stored right now, so a write never drops plans another tab
   * saved since this tab loaded. Unreadable data leaves the in-memory list as
   * it is (load() reports it); data from a newer version switches this tab to
   * read-only, so it never overwrites what the newer version wrote.
   */
  private sync(): void {
    if (!this.storage || this.status === 'newer') return;
    let text: string | null;
    try {
      text = this.storage.getItem(STORE_KEY);
    } catch {
      return;
    }
    if (text === null) {
      this.plans = [];
      return;
    }
    let env: ReturnType<typeof migrate>;
    try {
      env = migrate(JSON.parse(text));
    } catch {
      return;
    }
    if (env === 'newer') {
      // Another tab running a newer version wrote here: stop writing.
      this.status = 'newer';
      return;
    }
    if (!env) return;
    this.plans = readPlans(env, Infinity).plans.slice(0, MAX_PLANS);
  }

  /** Pick up changes made in another tab (call on the window "storage" event). */
  refresh(): Plan[] {
    this.sync();
    return this.plans;
  }

  list(): Plan[] {
    return this.plans;
  }

  getStatus(): StoreStatus {
    return this.status;
  }

  /** Create or update. Never evicts an existing plan. */
  save(plan: Plan): SaveResult {
    const parsed = migratePlan(plan);
    if (!parsed || parsed.from !== 2) return { ok: false, reason: 'invalid', message: 'This plan has invalid data and wasn’t saved.' };
    this.sync();
    const exists = this.plans.some((p) => p.id === plan.id);
    if (!exists && this.plans.length >= MAX_PLANS) {
      return { ok: false, reason: 'limit', message: `You already have ${MAX_PLANS} saved plans. Delete one to save this; nothing was overwritten.` };
    }
    const next = exists ? this.plans.map((p) => (p.id === plan.id ? parsed.plan : p)) : [...this.plans, parsed.plan];
    const err = this.write(next);
    return err ?? { ok: true, plans: next, action: exists ? 'updated' : 'created' };
  }

  remove(id: string): SaveResult & { removed?: Plan; index?: number } {
    this.sync();
    const index = this.plans.findIndex((p) => p.id === id);
    if (index === -1) return { ok: true, plans: this.plans, action: 'updated' };
    const removed = this.plans[index];
    const next = this.plans.filter((p) => p.id !== id);
    const err = this.write(next);
    return err ?? { ok: true, plans: next, action: 'updated', removed, index };
  }

  /** Undo a delete, restoring the plan at its old position if there is room. */
  restore(plan: Plan, index: number): SaveResult {
    this.sync();
    if (this.plans.some((p) => p.id === plan.id)) return { ok: true, plans: this.plans, action: 'updated' };
    if (this.plans.length >= MAX_PLANS) return { ok: false, reason: 'limit', message: 'There’s no room to restore that plan.' };
    const next = [...this.plans];
    next.splice(Math.min(index, next.length), 0, plan);
    const err = this.write(next);
    return err ?? { ok: true, plans: next, action: 'created' };
  }
}
