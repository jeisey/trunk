// Verbatim copy of src/lib/plan.ts at b9cec90 (the last v1 build), the dependency of v1-storage.ts.
// Only change: import paths now point at today's helper modules. Do not edit.
/**
 * Plan model (runtime, parent-owned). Stored locally and shared by link.
 *
 * Wall-clock time and child participation time are different things: a
 * parallel recipe's two 10-minute tracks occupy 10 wall-clock minutes, and
 * setup/cleanup are counted once per segment.
 */
import * as z from 'zod/mini';
import { ABILITIES } from '../../../src/content/vocab.ts';
import type { IndexedCatalog } from '../../../src/content/catalog.ts';
import { HHMM, parseHHMM } from '../../../src/lib/time.ts';
import { LIMITS } from '../../../src/lib/text.ts';
import { recipeAssignment } from '../../../src/lib/eligibility.ts';
import { toDays } from '../../../src/lib/age.ts';

export const PLAN_VERSION = 1 as const;
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

export const SegmentKind = z.enum(['activity', 'recipe', 'break', 'custom']);

export const PlanSegment = z.strictObject({
  id: z.string().check(z.regex(/^[a-z0-9]{1,12}$/)),
  kind: SegmentKind,
  /** Catalog ID for activity/recipe segments. */
  ref: z.optional(text(80)),
  /** Engagement minutes (activity time), excluding setup/cleanup. */
  minutes: int(1, 240),
  /** Parent-written text for custom entries and optional break labels. */
  label: z.optional(text(LIMITS.custom)),
  /** Which child a custom entry is for. */
  who: z.optional(z.enum(['both', 'c1', 'c2'])),
  /** Which child takes the younger role in a recipe. */
  younger: z.optional(z.enum(['c1', 'c2'])),
  note: z.optional(text(LIMITS.segmentNote)),
});

export const PlanSettings = z.strictObject({
  energy: z.enum(['busy', 'low', 'some', 'plenty']),
  place: z.enum(['any', 'indoors', 'outdoors']),
  mode: z.enum(['either', 'together', 'parallel']),
  adults: z.union([z.literal(1), z.literal(2)]),
});

export const Plan = z.strictObject({
  v: z.literal(PLAN_VERSION),
  id: z.string().check(z.regex(/^[a-z0-9-]{4,40}$/)),
  title: text(LIMITS.title),
  kids: z.array(PlanKid).check(z.minLength(1), z.maxLength(2)),
  start: z.string().check(z.regex(HHMM)),
  window: int(10, 720),
  settings: PlanSettings,
  segments: z.array(PlanSegment).check(z.maxLength(MAX_SEGMENTS)),
  notes: z._default(text(LIMITS.notes), ''),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

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

export interface TimedSegment {
  segment: PlanSegment;
  start: number;
  end: number;
  setup: number;
  cleanup: number;
  /** Wall-clock minutes = setup + minutes + cleanup (shared tracks counted once). */
  wall: number;
  missing: boolean;
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

export function timeline(plan: Pick<Plan, 'start' | 'segments'>, c: IndexedCatalog): TimedSegment[] {
  let cursor = parseHHMM(plan.start);
  return plan.segments.map((segment) => {
    const { setup, cleanup, missing } = overheadFor(segment, c);
    const wall = setup + segment.minutes + cleanup;
    const item = { segment, start: cursor, end: cursor + wall, setup, cleanup, wall, missing };
    cursor += wall;
    return item;
  });
}

export function totalWallMinutes(plan: Pick<Plan, 'start' | 'segments'>, c: IndexedCatalog): number {
  return timeline(plan, c).reduce((sum, t) => sum + t.wall, 0);
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
