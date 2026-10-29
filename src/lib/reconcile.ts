/**
 * Re-check a plan's segments against today's catalog and the plan's children.
 * Used for share imports, starter plans, and opening saved plans, so incoming
 * or stale data never bypasses current age, readiness, adult, or pairing rules.
 *
 * Plan v2 entries:
 * - Routine blocks are always kept (they are the parent's own times). `who` is
 *   checked against the number of children (c2 becomes c1 in a one-child plan).
 * - Activities in two-child plans need `who`, and must suit THAT child's age,
 *   readiness, and the adult count. Without `who` they are dropped, as in v1.
 * - Recipes get their younger-role child re-assigned.
 * - Alongside entries are validated with the plan's structure rules; an entry
 *   that can't run alongside keeps its place in the plan but loses `along`, and
 *   the change is reported in `changed` (never silently).
 * - Lengths are clamped to today's bounds (counted in `adjusted`).
 * - Custom text is never reinterpreted (a custom "Nap" stays a custom entry).
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import { activityEligible, recipeEligible } from './filters.ts';
import { bounds, kidInputs, ROUTINE_LABEL, youngerFor, type PlanKid, type PlanSegment, type PlanSettings } from './plan.ts';

export interface ReconcileResult {
  segments: PlanSegment[];
  /** Entries left out, with a plain reason. */
  dropped: { label: string; reason: string }[];
  /** Entries kept with a visible change (for example no longer alongside a routine block). */
  changed: { label: string; reason: string }[];
  /** Entries whose length was clamped to today's bounds. */
  adjusted: number;
}

const childName = (who: 'c1' | 'c2') => (who === 'c1' ? 'Child 1' : 'Child 2');

function labelOf(seg: PlanSegment, c: IndexedCatalog): string {
  if (seg.kind === 'activity') return c.activityById.get(seg.ref ?? '')?.title ?? seg.ref ?? 'Activity';
  if (seg.kind === 'recipe') return c.recipeById.get(seg.ref ?? '')?.title ?? seg.ref ?? 'Pairing';
  if (seg.kind === 'routine') return seg.routine ? ROUTINE_LABEL[seg.routine] : 'Routine';
  if (seg.kind === 'break') return seg.label || 'Flexible break';
  return seg.label || 'Your own activity';
}

export function reconcileSegments(kids: PlanKid[], settings: PlanSettings, segments: PlanSegment[], c: IndexedCatalog): ReconcileResult {
  const inputs = kidInputs({ kids });
  const two = kids.length === 2;
  const dropped: ReconcileResult['dropped'] = [];
  const changed: ReconcileResult['changed'] = [];
  let adjusted = 0;
  const kept: PlanSegment[] = [];
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
      } else if (two) {
        if (seg.who !== 'c1' && seg.who !== 'c2') {
          dropped.push({ label: a.title, reason: 'single-child activity in a two-child plan' });
          keep = null;
        } else if (!activityEligible(a, inputs[seg.who === 'c1' ? 0 : 1], settings.adults)) {
          dropped.push({ label: a.title, reason: `not suitable for ${childName(seg.who)}’s age or readiness` });
          keep = null;
        }
      } else if (!activityEligible(a, inputs[0], settings.adults)) {
        dropped.push({ label: a.title, reason: 'not suitable for this age or readiness' });
        keep = null;
      } else if (seg.who === 'c2') {
        keep = { ...seg, who: 'c1' };
      }
    } else if (seg.kind === 'recipe') {
      const r = seg.ref ? c.recipeById.get(seg.ref) : undefined;
      if (!r) {
        dropped.push({ label: seg.ref ?? 'Pairing', reason: 'no longer in Trunk' });
        keep = null;
      } else if (r.retired) {
        dropped.push({ label: r.title, reason: 'retired from Trunk' });
        keep = null;
      } else if (!two || !recipeEligible(r, [inputs[0], inputs[1]], settings.adults)) {
        dropped.push({ label: r.title, reason: 'doesn’t fit these ages' });
        keep = null;
      } else {
        keep = { ...seg, younger: youngerFor(r.id, { kids }, c) };
      }
    } else if ((seg.kind === 'custom' || seg.kind === 'routine') && !two && seg.who === 'c2') {
      keep = { ...seg, who: 'c1' };
    }
    if (keep) {
      const { min, max } = bounds(keep, c);
      const clamped = Math.max(min, Math.min(max, keep.minutes));
      if (clamped !== keep.minutes) {
        adjusted++;
        keep = { ...keep, minutes: clamped };
      }
      kept.push(keep);
    }
  }

  // Structure: an alongside entry follows a routine block for the other child (see structureIssues).
  const out: PlanSegment[] = [];
  let host: PlanSegment | null = null;
  for (const seg of kept) {
    let s = seg;
    if (s.along) {
      const forOne = (s.kind === 'activity' || s.kind === 'custom' || s.kind === 'routine') && (s.who === 'c1' || s.who === 'c2');
      const ok = two && forOne && host !== null && host.who !== 'both' && host.who !== s.who;
      if (!ok) {
        const { along: _along, ...rest } = s;
        void _along;
        s = rest;
        changed.push({ label: labelOf(s, c), reason: 'can’t run alongside here, so it’s back in the main plan' });
      }
    }
    if (!s.along) host = s.kind === 'routine' ? s : null;
    out.push(s);
  }
  return { segments: out, dropped, changed, adjusted };
}
