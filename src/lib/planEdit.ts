/**
 * Pure plan-editing operations shared by the editor UI, starter plans, and the
 * planner. Every function returns a new plan; none touches storage.
 *
 * A "group" is a main-sequence entry plus the alongside entries that follow it
 * (only routine blocks have alongside entries). Groups move, duplicate, and
 * reorder together, so a toddler's activities stay with the baby's nap.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import type { RoutineType } from '../content/schema.ts';
import { layoutPlan, type Repair } from './layout.ts';
import { bounds, MAX_SEGMENTS, newId, newPlanId, PLAN_VERSION, type Plan, type PlanKid, type PlanSegment, type PlanSettings } from './plan.ts';
import { parseHHMM } from './time.ts';

const touch = (plan: Plan, segments: PlanSegment[]): Plan => ({ ...plan, segments, updatedAt: new Date().toISOString() });

export function makePlan(kids: PlanKid[], settings: PlanSettings, start: string, window: number, segments: PlanSegment[] = [], title = ''): Plan {
  const stamp = new Date().toISOString();
  return { v: PLAN_VERSION, id: newPlanId(), title, kids, start, window, settings, segments, notes: '', createdAt: stamp, updatedAt: stamp };
}

/** [first, end) indexes of the group that contains `index`. */
export function groupRange(segments: readonly PlanSegment[], index: number): [number, number] {
  let first = index;
  while (first > 0 && segments[first].along) first--;
  let end = first + 1;
  while (end < segments.length && segments[end].along) end++;
  return [first, end];
}

/** Offset (minutes after the plan start) for a clock time, wrapping past midnight. */
export function offsetForClock(plan: Pick<Plan, 'start'>, clock: number): number {
  return (((clock - parseHHMM(plan.start)) % 1440) + 1440) % 1440;
}

/** Latest offset a routine may start at: the longest window a plan can have. */
export const MAX_ANCHOR = 720;

/**
 * Why a clock time can't hold a routine block in this plan, or null if it can.
 * Times more than 12 hours after the start are almost always meant to be earlier
 * the same day, so Trunk asks instead of wrapping them to tomorrow.
 */
export function clockProblem(plan: Pick<Plan, 'start'>, clock: number): string | null {
  return offsetForClock(plan, clock) > MAX_ANCHOR ? 'That’s before this plan starts. Change the plan’s start time to include it.' : null;
}

/**
 * Put the group starting at `index` (an anchored main entry) where its time belongs:
 * before the first main entry that starts at or after it, using the layout of the
 * plan without this group.
 */
export function placeAnchored(plan: Plan, index: number, c: IndexedCatalog): Plan {
  const [first, end] = groupRange(plan.segments, index);
  const group = plan.segments.slice(first, end);
  const at = group[0].at;
  if (at === undefined) return plan;
  const rest = [...plan.segments.slice(0, first), ...plan.segments.slice(end)];
  const items = layoutPlan({ kids: plan.kids, segments: rest }, c);
  let insert = rest.length;
  for (const it of items) {
    if (it.host !== null) continue;
    if (it.start >= at || (it.anchored && (it.segment.at ?? 0) >= at)) {
      insert = it.index;
      break;
    }
  }
  return touch(plan, [...rest.slice(0, insert), ...group, ...rest.slice(insert)]);
}

export interface RoutineInput {
  routine: RoutineType;
  who: 'c1' | 'c2' | 'both';
  minutes: number;
  /** Clock minutes since midnight. Omitted: right after everything already planned. */
  clock?: number;
  settle?: number;
  holding?: boolean;
}

/**
 * Add a routine block at the parent's chosen time. In a two-child plan, a
 * one-child block whose time falls inside the other child's routine is placed
 * alongside it (for example a toddler's lunch during the baby's nap).
 */
export function addRoutine(plan: Plan, input: RoutineInput, c: IndexedCatalog): Plan {
  if (plan.segments.length >= MAX_SEGMENTS) return plan;
  const { min, max } = bounds({ id: 'x', kind: 'routine', routine: input.routine, who: input.who, minutes: 1, at: 0 }, c);
  const items = layoutPlan(plan, c);
  if (input.clock !== undefined && clockProblem(plan, input.clock)) return plan;
  const at = Math.min(1439, input.clock === undefined ? items.reduce((m, it) => Math.max(m, it.end), 0) : offsetForClock(plan, input.clock));
  const seg: PlanSegment = {
    id: newId('n'),
    kind: 'routine',
    routine: input.routine,
    who: plan.kids.length === 1 ? 'c1' : input.who,
    minutes: Math.max(min, Math.min(max, Math.round(input.minutes))),
    at,
  };
  if (input.routine === 'nap' && input.holding) seg.holding = true;
  else if (input.routine === 'nap' && input.settle !== undefined) seg.settle = Math.max(0, Math.min(60, Math.round(input.settle)));
  if (plan.kids.length === 2 && seg.who !== 'both') {
    const host = items.find((it) => it.host === null && it.segment.kind === 'routine' && it.segment.who !== 'both' && it.segment.who !== seg.who && it.start <= at && at < it.end);
    if (host) {
      const [, end] = groupRange(plan.segments, host.index);
      return touch(plan, [...plan.segments.slice(0, end), { ...seg, along: true }, ...plan.segments.slice(end)]);
    }
  }
  const appended = touch(plan, [...plan.segments, seg]);
  return placeAnchored(appended, appended.segments.length - 1, c);
}

/**
 * Add any entry: to the main sequence (end), or alongside the routine group at `host`.
 * An alongside entry is always for the other child; a host that isn't a one-child
 * routine in a two-child plan can't take one, and the plan is returned unchanged.
 */
export function addEntry(plan: Plan, seg: PlanSegment, opts: { host?: number } = {}): Plan {
  if (plan.segments.length >= MAX_SEGMENTS) return plan;
  if (opts.host !== undefined) {
    const [first, end] = groupRange(plan.segments, opts.host);
    const host = plan.segments[first];
    if (plan.kids.length !== 2 || host.kind !== 'routine' || (host.who !== 'c1' && host.who !== 'c2')) return plan;
    if (seg.kind !== 'activity' && seg.kind !== 'custom' && seg.kind !== 'routine') return plan;
    const who = host.who === 'c1' ? 'c2' : 'c1';
    return touch(plan, [...plan.segments.slice(0, end), { ...seg, who, along: true }, ...plan.segments.slice(end)]);
  }
  const { along: _drop, ...main } = seg;
  void _drop;
  return touch(plan, [...plan.segments, main]);
}

/** Set or clear an entry's anchored time (offset minutes) and move it to where that time belongs. */
export function setAnchor(plan: Plan, index: number, at: number | undefined, c: IndexedCatalog): Plan {
  const seg = plan.segments[index];
  if (!seg) return plan;
  if (seg.kind === 'routine' && at === undefined) return plan;
  const next: PlanSegment = { ...seg };
  if (at === undefined) {
    delete next.at;
    delete next.locked;
  } else next.at = Math.max(0, Math.min(1439, Math.round(at)));
  const updated = touch(plan, plan.segments.map((s, i) => (i === index ? next : s)));
  return seg.along || at === undefined ? updated : placeAnchored(updated, index, c);
}

/** Lock keeps an entry (and its time) when filling around blocks; unlocking lets it flow again. */
export function setLocked(plan: Plan, index: number, locked: boolean, c: IndexedCatalog): Plan {
  const seg = plan.segments[index];
  if (!seg) return plan;
  const next: PlanSegment = { ...seg };
  if (locked) {
    next.locked = true;
    next.at = seg.at ?? layoutPlan(plan, c)[index].start;
  } else {
    delete next.locked;
    if (seg.kind !== 'routine') delete next.at;
  }
  return touch(plan, plan.segments.map((s, i) => (i === index ? next : s)));
}

export function setMinutes(plan: Plan, index: number, minutes: number, c: IndexedCatalog): Plan {
  const seg = plan.segments[index];
  if (!seg) return plan;
  const { min, max } = bounds(seg, c);
  const clamped = Math.max(min, Math.min(max, Math.round(minutes)));
  return clamped === seg.minutes ? plan : touch(plan, plan.segments.map((s, i) => (i === index ? { ...s, minutes: clamped } : s)));
}

export function updateEntry(plan: Plan, index: number, patch: Partial<PlanSegment>): Plan {
  const seg = plan.segments[index];
  if (!seg) return plan;
  const next = { ...seg, ...patch } as PlanSegment;
  for (const k of Object.keys(next) as (keyof PlanSegment)[]) if (next[k] === undefined) delete next[k];
  return touch(plan, plan.segments.map((s, i) => (i === index ? next : s)));
}

/**
 * Move an entry one step earlier or later. Main entries move with their group
 * past the neighbouring group; alongside entries move within their track.
 * Anchored entries keep their time; two entries that both have set times are
 * never swapped (that would put them out of time order): the plan is returned
 * unchanged and the caller can suggest changing a time instead.
 */
export function moveEntry(plan: Plan, index: number, dir: -1 | 1): Plan {
  const segs = plan.segments;
  if (segs[index]?.along) {
    const j = index + dir;
    if (j < 0 || j >= segs.length || !segs[j].along) return plan;
    const next = [...segs];
    [next[index], next[j]] = [next[j], next[index]];
    return touch(plan, next);
  }
  const [a0, a1] = groupRange(segs, index);
  // Two entries with set times keep their time order; change a time to reorder them.
  const fixedPair = (x: PlanSegment, y: PlanSegment) => x.at !== undefined && y.at !== undefined;
  if (dir < 0) {
    if (a0 === 0) return plan;
    const [b0] = groupRange(segs, a0 - 1);
    if (fixedPair(segs[a0], segs[b0])) return plan;
    return touch(plan, [...segs.slice(0, b0), ...segs.slice(a0, a1), ...segs.slice(b0, a0), ...segs.slice(a1)]);
  }
  if (a1 >= segs.length) return plan;
  const [, b1] = groupRange(segs, a1);
  if (fixedPair(segs[a0], segs[a1])) return plan;
  return touch(plan, [...segs.slice(0, a0), ...segs.slice(a1, b1), ...segs.slice(a0, a1), ...segs.slice(b1)]);
}

/**
 * Remove one entry. Removing a routine block keeps whatever ran alongside it:
 * those entries rejoin the main sequence (and are flagged if the other child
 * then has nothing planned), so nothing the parent added disappears silently.
 */
export function removeEntry(plan: Plan, index: number): Plan {
  const segs = plan.segments;
  if (!segs[index]) return plan;
  const [, end] = groupRange(segs, index);
  const isHost = !segs[index].along && end > index + 1;
  return touch(
    plan,
    segs.flatMap((s, i) => {
      if (i === index) return [];
      if (isHost && i > index && i < end) {
        // Rejoin the main sequence. Routines and locked entries stay anchored (both need a time).
        const { along: _a, at: _t, ...rest } = s;
        void _a;
        void _t;
        return [s.kind === 'routine' || s.locked ? { ...rest, at: s.at ?? 0 } : rest];
      }
      return [s];
    }),
  );
}

/** Duplicate an entry right after its group (a routine copy starts where the original ends). */
export function duplicateEntry(plan: Plan, index: number, c: IndexedCatalog): Plan {
  const seg = plan.segments[index];
  if (!seg || plan.segments.length >= MAX_SEGMENTS) return plan;
  const copy: PlanSegment = { ...seg, id: newId(seg.id.slice(0, 1)) };
  delete copy.locked;
  if (seg.along) {
    delete copy.at;
    return touch(plan, [...plan.segments.slice(0, index + 1), copy, ...plan.segments.slice(index + 1)]);
  }
  const [, end] = groupRange(plan.segments, index);
  if (seg.kind === 'routine') copy.at = Math.min(1439, layoutPlan(plan, c)[index].end);
  else delete copy.at;
  const next = touch(plan, [...plan.segments.slice(0, end), copy, ...plan.segments.slice(end)]);
  return copy.at !== undefined ? placeAnchored(next, end, c) : next;
}

/** Apply one of the local repairs offered with a conflict. "swap" is handled by the caller (it needs the planner). */
export function applyRepair(plan: Plan, repair: Repair, c: IndexedCatalog): Plan {
  switch (repair.kind) {
    case 'shorten':
      return setMinutes(plan, repair.index, repair.minutes, c);
    case 'remove':
      return removeEntry(plan, repair.index);
    case 'shift':
      return setAnchor(plan, repair.index, repair.at, c);
    case 'move-after': {
      const [a0, a1] = groupRange(plan.segments, repair.index);
      const [, b1] = groupRange(plan.segments, repair.after);
      if (b1 <= a0) return plan;
      const segs = plan.segments;
      return touch(plan, [...segs.slice(0, a0), ...segs.slice(a1, b1), ...segs.slice(a0, a1), ...segs.slice(b1)]);
    }
    case 'swap':
      return plan;
  }
}
