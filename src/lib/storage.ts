/**
 * Saved plans in this browser's localStorage, versioned.
 *
 * - At most MAX_PLANS plans. A full store rejects new plans; it never
 *   overwrites an existing plan to make room.
 * - Corrupt data is backed up under BACKUP_KEY before anything is rewritten,
 *   and readable plans are salvaged.
 * - Blocked storage (private modes, disabled site data) and quota errors are
 *   reported; the current in-memory plan is never discarded.
 * - Data written by a newer version is left untouched (read-only mode).
 */
import * as z from 'zod/mini';
import { Plan } from './plan.ts';

export const STORE_KEY = 'trunk.plans';
export const BACKUP_KEY = 'trunk.plans.backup';
export const STORE_VERSION = 1;
export const MAX_PLANS = 10;

export type StoreStatus = 'ok' | 'unavailable' | 'recovered' | 'newer';

export type SaveResult =
  | { ok: true; plans: Plan[]; action: 'created' | 'updated' }
  | { ok: false; reason: 'limit' | 'quota' | 'unavailable' | 'newer' | 'invalid'; message: string };

interface Envelope {
  version: number;
  plans: unknown[];
}

const EnvelopeV1 = z.strictObject({ version: z.literal(1), plans: z.array(z.unknown()) });

/**
 * Migrations from older envelope versions to the current one. Version 0 is the
 * pre-envelope shape (a bare array of plans) used by early builds; it is kept
 * so the migration path is exercised and tested.
 */
export function migrate(raw: unknown): Envelope | 'newer' | null {
  if (Array.isArray(raw)) return { version: 1, plans: raw };
  if (typeof raw !== 'object' || raw === null) return null;
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > STORE_VERSION) return 'newer';
  const v1 = EnvelopeV1.safeParse(raw);
  return v1.success ? v1.data : null;
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
    const good: Plan[] = [];
    let bad = 0;
    for (const item of env.plans) {
      const p = Plan.safeParse(item);
      if (p.success && good.length < MAX_PLANS && !good.some((g) => g.id === p.data.id)) good.push(p.data);
      else bad++;
    }
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

  /**
   * Re-read what is stored right now, so a write never drops plans another tab
   * saved since this tab loaded. Unreadable or newer data leaves the in-memory
   * list as it is (load() reports those cases).
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
    if (!env || env === 'newer') return;
    const fresh: Plan[] = [];
    for (const item of env.plans) {
      const p = Plan.safeParse(item);
      if (p.success && !fresh.some((x) => x.id === p.data.id)) fresh.push(p.data);
    }
    this.plans = fresh.slice(0, MAX_PLANS);
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
    const parsed = Plan.safeParse(plan);
    if (!parsed.success) return { ok: false, reason: 'invalid', message: 'This plan has invalid data and wasn’t saved.' };
    this.sync();
    const exists = this.plans.some((p) => p.id === plan.id);
    if (!exists && this.plans.length >= MAX_PLANS) {
      return { ok: false, reason: 'limit', message: `You already have ${MAX_PLANS} saved plans. Delete one to save this; nothing was overwritten.` };
    }
    const next = exists ? this.plans.map((p) => (p.id === plan.id ? parsed.data : p)) : [...this.plans, parsed.data];
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
