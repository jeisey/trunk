/**
 * Plan model (runtime, parent-owned). Stored locally and shared by link.
 *
 * Version 2 (2026-10-29) adds routine blocks (nap, milk feed, meal, snack),
 * anchored start times, locked entries, and alongside tracks. Version 1 plans
 * migrate without changes to their entries or timeline: a v1 plan is a v2 plan
 * with no anchors, routines, or alongside entries.
 *
 * Timeline rules (see layout.ts):
 * - Entries run in array order. An entry without `at` starts when the previous
 *   entry ends. An entry with `at` (minutes after the plan's start) is anchored:
 *   it stays put when earlier entries change, and anything that runs into it is
 *   reported as a conflict instead of moving it.
 * - Overlap is explicit only: an entry with `along: true` runs alongside the
 *   nearest preceding routine block, for the other child (for example a toddler's
 *   activity during the baby's nap). Nothing else ever overlaps.
 * - Setup and tidy-up are counted once per entry. Wall-clock time is the union
 *   of occupied intervals, so alongside tracks are never double-counted.
 */
import * as z from 'zod/mini';
import { ABILITIES, ROUTINE_TYPES } from '../content/vocab.ts';
import type { RoutineType } from '../content/schema.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { HHMM } from './time.ts';
import { LIMITS } from './text.ts';
import { recipeAssignment } from './eligibility.ts';
import { toDays } from './age.ts';

export const PLAN_VERSION = 2 as const;
export const MAX_SEGMENTS = 24;

const int = (min: number, max: number) => z.number().check(z.int(), z.minimum(min), z.maximum(max));
const text = (max: number) => z.string().check(z.maxLength(max));

export const KidAge = z.strictObject({
  value: int(1, 59),
  unit: z.enum(['w', 'm']),
});

export const PlanKid = z.strictObject({
  age: KidAge,
  notYet: z._default(z.array(z.enum(ABILITIES)).check(z.maxLength(ABILITIES.length)), []),
});

export const SegmentKind = z.enum(['activity', 'recipe', 'break', 'custom', 'routine']);

const SegmentId = z.string().check(z.regex(/^[a-z0-9]{1,12}$/));
// Field order matches v1 so parsed plans serialize identically (dirty-state checks compare JSON).
const SegmentFields = {
  /** Catalog ID for activity/recipe segments. */
  ref: z.optional(text(80)),
  /** Engagement minutes (activity time), excluding setup/cleanup. For routines, the parent's estimate. */
  minutes: int(1, 240),
  /** Parent-written text for custom entries and optional break labels. */
  label: z.optional(text(LIMITS.custom)),
  /** Which child an entry is for. Required for routines and for activities in two-child plans. */
  who: z.optional(z.enum(['both', 'c1', 'c2'])),
  /** Which child takes the younger role in a recipe. */
  younger: z.optional(z.enum(['c1', 'c2'])),
  note: z.optional(text(LIMITS.segmentNote)),
};

/** v1 segment, kept to read old saved plans, drafts, and files. */
export const PlanSegmentV1 = z.strictObject({ id: SegmentId, kind: z.enum(['activity', 'recipe', 'break', 'custom']), ...SegmentFields });

export const PlanSegment = z
  .strictObject({
    id: SegmentId,
    kind: SegmentKind,
    ...SegmentFields,
    /** Routine type, for routine blocks only. */
    routine: z.optional(z.enum(ROUTINE_TYPES)),
    /** Anchored start: minutes after the plan's start. Routine blocks are always anchored. */
    at: z.optional(int(0, 1439)),
    /** Kept in place by "Fill around these blocks". Locked entries are anchored. */
    locked: z.optional(z.literal(true)),
    /** Runs alongside the nearest preceding routine block, for the other child. */
    along: z.optional(z.literal(true)),
    /** Nap only: minutes the parent expects to spend settling the child (an estimate). */
    settle: z.optional(int(0, 60)),
    /** Nap only: the parent stays with the sleeping child (for example a contact nap). */
    holding: z.optional(z.literal(true)),
  })
  .check(
    z.refine((s) => (s.kind === 'routine') === (s.routine !== undefined), 'routine type is required on routine blocks only'),
    z.refine((s) => s.kind !== 'routine' || (s.at !== undefined && s.who !== undefined), 'routine blocks need a time and a child'),
    z.refine((s) => (s.settle === undefined && s.holding === undefined) || s.routine === 'nap', 'settle/holding apply to naps only'),
    z.refine((s) => !s.locked || s.at !== undefined, 'locked entries are anchored'),
    z.refine((s) => !s.along || ((s.kind === 'activity' || s.kind === 'custom' || s.kind === 'routine') && (s.who === 'c1' || s.who === 'c2')), 'alongside entries are for one child'),
    z.refine((s) => (s.kind === 'activity' || s.kind === 'recipe') === (s.ref !== undefined), 'catalog entries need a ref'),
  );

export const PlanSettings = z.strictObject({
  energy: z.enum(['busy', 'low', 'some', 'plenty']),
  place: z.enum(['any', 'indoors', 'outdoors']),
  mode: z.enum(['either', 'together', 'parallel']),
  adults: z.union([z.literal(1), z.literal(2)]),
});

const PlanHead = {
  id: z.string().check(z.regex(/^[a-z0-9-]{4,40}$/)),
  title: text(LIMITS.title),
  kids: z.array(PlanKid).check(z.minLength(1), z.maxLength(2)),
  start: z.string().check(z.regex(HHMM)),
  window: int(10, 720),
  settings: PlanSettings,
};
const PlanTail = {
  notes: z._default(text(LIMITS.notes), ''),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const PlanV1 = z.strictObject({ v: z.literal(1), ...PlanHead, segments: z.array(PlanSegmentV1).check(z.maxLength(MAX_SEGMENTS)), ...PlanTail });

export const Plan = z
  .strictObject({ v: z.literal(PLAN_VERSION), ...PlanHead, segments: z.array(PlanSegment).check(z.maxLength(MAX_SEGMENTS)), ...PlanTail })
  .check(z.refine((p) => structureIssues(p).length === 0, 'plan structure is invalid'));

export type Plan = z.infer<typeof Plan>;
export type PlanSegment = z.infer<typeof PlanSegment>;
export type PlanKid = z.infer<typeof PlanKid>;
export type PlanSettings = z.infer<typeof PlanSettings>;

export const BREAK_LABEL = 'Flexible break';
export const BREAK_HINT = 'Feed, change, snack, drink, cuddle, or rest—whatever is needed.';

export function newId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`.slice(0, 12);
}

export function newPlanId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function overheadFor(seg: PlanSegment, c: IndexedCatalog): { setup: number; cleanup: number; missing: boolean } {
  if (seg.kind === 'activity') {
    const a = seg.ref ? c.activityById.get(seg.ref) : undefined;
    return a ? { setup: a.setupMinutes, cleanup: a.cleanupMinutes, missing: false } : { setup: 0, cleanup: 0, missing: true };
  }
  if (seg.kind === 'recipe') {
    const r = seg.ref ? c.recipeById.get(seg.ref) : undefined;
    return r ? { setup: r.setupMinutes, cleanup: r.cleanupMinutes, missing: false } : { setup: 0, cleanup: 0, missing: true };
  }
  return { setup: 0, cleanup: 0, missing: false };
}

/** Minimum and maximum engagement minutes a segment may be resized to. */
export function bounds(seg: PlanSegment, c: IndexedCatalog): { min: number; max: number } {
  if (seg.kind === 'activity') {
    const a = seg.ref ? c.activityById.get(seg.ref) : undefined;
    if (a) return { min: a.duration.min, max: a.duration.max };
  }
  if (seg.kind === 'recipe') {
    const r = seg.ref ? c.recipeById.get(seg.ref) : undefined;
    if (r) return { min: r.duration.min, max: r.duration.max };
  }
  if (seg.kind === 'break') return { min: 5, max: 45 };
  if (seg.kind === 'routine' && seg.routine) return ROUTINE_BOUNDS[seg.routine];
  return { min: 1, max: 120 };
}

/** Resize within bounds: 1-minute steps up to 10 minutes, then 5-minute steps. */
export function resize(seg: PlanSegment, direction: 1 | -1, c: IndexedCatalog): PlanSegment {
  const { min, max } = bounds(seg, c);
  const step = direction > 0 ? (seg.minutes < 10 ? 1 : 5) : seg.minutes <= 10 ? 1 : 5;
  const clamped = Math.max(min, Math.min(max, seg.minutes + direction * step));
  return clamped === seg.minutes ? seg : { ...seg, minutes: clamped };
}

export function kidInputs(plan: Pick<Plan, 'kids'>) {
  return plan.kids.map((k) => ({ days: toDays(k.age), notYet: k.notYet }));
}

/** Which child (c1/c2) takes the younger role in a recipe, or undefined if the pair doesn't fit. */
export function youngerFor(recipeId: string, plan: Pick<Plan, 'kids'>, c: IndexedCatalog): 'c1' | 'c2' | undefined {
  const r = c.recipeById.get(recipeId);
  if (!r || plan.kids.length !== 2) return undefined;
  const [a, b] = kidInputs(plan);
  const idx = recipeAssignment(r, a, b);
  return idx === null ? undefined : idx === 0 ? 'c1' : 'c2';
}

// ---------- Routine blocks ----------

export const ROUTINE_LABEL: Record<RoutineType, string> = {
  nap: 'Nap',
  'milk-feed': 'Milk feed',
  meal: 'Meal',
  snack: 'Snack',
};

/** Resize limits for parent-entered estimates. Trunk never suggests a length. */
export const ROUTINE_BOUNDS: Record<RoutineType, { min: number; max: number }> = {
  nap: { min: 5, max: 240 },
  'milk-feed': { min: 5, max: 90 },
  meal: { min: 5, max: 90 },
  snack: { min: 5, max: 45 },
};

/** The timing event a routine block creates. A snack is a meal for timing purposes. */
export function routineEvent(r: RoutineType): 'nap' | 'milk-feed' | 'meal' {
  return r === 'snack' ? 'meal' : r;
}

/** Children an entry occupies. Single-child plans only have c1. */
export function lanesOf(seg: PlanSegment, kidCount: number): ('c1' | 'c2')[] {
  if (kidCount === 1) return ['c1'];
  if (seg.kind === 'recipe' || seg.kind === 'break') return ['c1', 'c2'];
  if (seg.who === 'c1' || seg.who === 'c2') return [seg.who];
  return ['c1', 'c2'];
}

/**
 * Rules that need more than one segment. Returns plain messages; an empty list means valid.
 * - c2 only exists in two-child plans.
 * - An alongside entry follows a routine block (possibly after other alongside entries)
 *   for the other child, in a two-child plan.
 */
export function structureIssues(p: { kids: unknown[]; segments: PlanSegment[] }): string[] {
  const issues: string[] = [];
  const two = p.kids.length === 2;
  let host: PlanSegment | null = null;
  p.segments.forEach((s, i) => {
    if (!two && (s.who === 'c2' || s.younger === 'c2')) issues.push(`entry ${i + 1} is for a second child`);
    if (s.along) {
      if (!two) issues.push(`entry ${i + 1} runs alongside in a one-child plan`);
      else if (!host || host.who === 'both' || host.who === s.who) issues.push(`entry ${i + 1} has no routine block for the other child to run alongside`);
    } else {
      host = s.kind === 'routine' ? s : null;
    }
  });
  return issues;
}

/**
 * Read a stored, drafted, or exported plan of any known version. Returns the
 * current-version plan, or null if it can't be read. Never invents routines or
 * reinterprets custom text: a v1 plan's entries carry over unchanged.
 */
export function migratePlan(raw: unknown): { plan: Plan; from: 1 | 2 } | null {
  const v = typeof raw === 'object' && raw !== null ? (raw as { v?: unknown }).v : undefined;
  if (v === PLAN_VERSION) {
    const r = Plan.safeParse(raw);
    return r.success ? { plan: r.data, from: 2 } : null;
  }
  if (v === 1) {
    const r = PlanV1.safeParse(raw);
    if (!r.success) return null;
    const next = Plan.safeParse({ ...r.data, v: PLAN_VERSION });
    return next.success ? { plan: next.data, from: 1 } : null;
  }
  return null;
}

/** Is this a plan version newer than this build understands? */
export function isNewerPlan(raw: unknown): boolean {
  const v = typeof raw === 'object' && raw !== null ? (raw as { v?: unknown }).v : undefined;
  return typeof v === 'number' && v > PLAN_VERSION;
}
