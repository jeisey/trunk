/**
 * The plan open in this tab, kept in sessionStorage so a reload or a discarded
 * tab doesn't lose it. Shape: { plan, snapshot }, where `snapshot` is the JSON of
 * the plan as last saved (null when never saved), used for the dirty check.
 *
 * Reads v1 and v2 plans. The plan and the snapshot are both migrated with
 * migratePlan and the snapshot is re-serialized with the same JSON.stringify,
 * so a draft that was clean before an upgrade is still clean after it.
 * Unknown, newer, or damaged drafts read as null; nothing here throws.
 * Momentary timing context ("Just fed", "Nap soon") is never part of a plan.
 */
import { migratePlan, type Plan } from './plan.ts';

export const DRAFT_KEY = 'trunk.draft';

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(storage?: Storage | null): { plan: Plan; snapshot: string | null } | null {
  try {
    const s = storage === undefined ? sessionStore() : storage;
    if (!s) return null;
    const raw = s.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { plan, snapshot } = parsed as { plan?: unknown; snapshot?: unknown };
    const current = migratePlan(plan);
    if (!current) return null;
    let snap: string | null = null;
    if (typeof snapshot === 'string') {
      try {
        const saved = migratePlan(JSON.parse(snapshot));
        snap = saved ? JSON.stringify(saved.plan) : null;
      } catch {
        snap = null;
      }
    }
    return { plan: current.plan, snapshot: snap };
  } catch {
    return null;
  }
}

export function writeDraft(plan: Plan | null, snapshot: string | null, storage?: Storage | null): void {
  try {
    const s = storage === undefined ? sessionStore() : storage;
    if (!s) return;
    if (plan) s.setItem(DRAFT_KEY, JSON.stringify({ plan, snapshot }));
    else s.removeItem(DRAFT_KEY);
  } catch {
    /* a convenience only */
  }
}
