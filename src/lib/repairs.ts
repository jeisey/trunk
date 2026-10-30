/**
 * Which of a conflict's repairs actually help. Each repair is tried on a copy of
 * the plan and kept only if it leaves fewer hard conflicts and creates none that
 * weren't there before, so a fix never quietly causes a new problem elsewhere.
 * "swap" is kept as offered (the caller picks the replacement with optionsForSlot).
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import { analyzePlan, type Conflict, type Repair } from './layout.ts';
import type { Plan } from './plan.ts';
import { applyRepair } from './planEdit.ts';

const key = (cf: Conflict, plan: Plan) => `${cf.kind}|${plan.segments[cf.index]?.id}|${cf.other === undefined ? '' : plan.segments[cf.other]?.id}`;

function hardKeys(plan: Plan, c: IndexedCatalog): Set<string> {
  return new Set(analyzePlan(plan, c).conflicts.filter((x) => x.severity === 'conflict').map((x) => key(x, plan)));
}

export function usefulRepairs(plan: Plan, conflict: Conflict, c: IndexedCatalog): Repair[] {
  const before = hardKeys(plan, c);
  const seen = new Set<string>();
  const out: Repair[] = [];
  for (const r of conflict.repairs) {
    const sig = `${r.kind}|${r.index}|${'minutes' in r ? r.minutes : ''}|${'at' in r ? r.at : ''}|${'after' in r ? r.after : ''}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (r.kind === 'swap' || r.kind === 'remove') {
      out.push(r);
      continue;
    }
    const after = hardKeys(applyRepair(plan, r, c), c);
    const fewer = after.size < before.size;
    const noNew = [...after].every((k) => before.has(k));
    if (fewer && noNew) out.push(r);
  }
  return out;
}

/** All repairs for one entry's conflicts, de-duplicated, each checked with usefulRepairs. */
export function repairsForEntry(plan: Plan, conflicts: Conflict[], c: IndexedCatalog): Repair[] {
  const seen = new Set<string>();
  const out: Repair[] = [];
  for (const cf of conflicts) {
    for (const r of usefulRepairs(plan, cf, c)) {
      const sig = `${r.kind}|${r.index}|${'minutes' in r ? r.minutes : ''}|${'at' in r ? r.at : ''}|${'after' in r ? r.after : ''}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(r);
    }
  }
  return out;
}
