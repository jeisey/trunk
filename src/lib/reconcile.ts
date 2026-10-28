/**
 * Re-check a plan's segments against today's catalog and the plan's children.
 * Used for share imports, starter plans, and opening saved plans, so incoming
 * or stale data never bypasses current age, readiness, adult, or pairing rules.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import { activityEligible, recipeEligible } from './filters.ts';
import { bounds, kidInputs, youngerFor, type PlanKid, type PlanSegment, type PlanSettings } from './plan.ts';

export interface ReconcileResult {
  segments: PlanSegment[];
  dropped: { label: string; reason: string }[];
  adjusted: number;
}

export function reconcileSegments(kids: PlanKid[], settings: PlanSettings, segments: PlanSegment[], c: IndexedCatalog): ReconcileResult {
  const inputs = kidInputs({ kids });
  const dropped: ReconcileResult['dropped'] = [];
  let adjusted = 0;
  const out: PlanSegment[] = [];
  for (const seg of segments) {
    let keep: PlanSegment | null = seg;
    if (seg.kind === 'activity') {
      const a = seg.ref ? c.activityById.get(seg.ref) : undefined;
      if (!a) {
        dropped.push({ label: seg.ref ?? 'Activity', reason: 'no longer in Trunk' });
        keep = null;
      } else if (a.retired) {
        dropped.push({ label: a.title, reason: 'retired from Trunk' });
        keep = null;
      } else if (kids.length !== 1) {
        dropped.push({ label: a.title, reason: 'single-child activity in a two-child plan' });
        keep = null;
      } else if (!activityEligible(a, inputs[0], settings.adults)) {
        dropped.push({ label: a.title, reason: 'not suitable for this age or readiness' });
        keep = null;
      }
    } else if (seg.kind === 'recipe') {
      const r = seg.ref ? c.recipeById.get(seg.ref) : undefined;
      if (!r) {
        dropped.push({ label: seg.ref ?? 'Pairing', reason: 'no longer in Trunk' });
        keep = null;
      } else if (r.retired) {
        dropped.push({ label: r.title, reason: 'retired from Trunk' });
        keep = null;
      } else if (kids.length !== 2 || !recipeEligible(r, [inputs[0], inputs[1]], settings.adults)) {
        dropped.push({ label: r.title, reason: 'doesn’t fit these ages' });
        keep = null;
      } else {
        keep = { ...seg, younger: youngerFor(r.id, { kids }, c) };
      }
    } else if (seg.kind === 'custom' && kids.length === 1 && seg.who === 'c2') {
      keep = { ...seg, who: 'c1' };
    }
    if (keep) {
      const { min, max } = bounds(keep, c);
      const clamped = Math.max(min, Math.min(max, keep.minutes));
      if (clamped !== keep.minutes) adjusted++;
      out.push({ ...keep, minutes: clamped });
    }
  }
  return { segments: out, dropped, adjusted };
}
