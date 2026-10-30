/**
 * Plan layout and analysis: the one place that turns a plan into times, lanes,
 * timing findings, and conflicts. The editor, shared preview, saved list,
 * planner checks, and image export all read this, so they never disagree.
 *
 * Minutes here are offsets from the plan's start (0 = start time). Add the start
 * clock (and wrap at 1440) only for display, so plans can cross midnight.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import type { Activity } from '../content/schema.ts';
import { monthsToDays, toDays } from './age.ts';
import { activityEligible } from './filters.ts';
import { bounds, lanesOf, overheadFor, ROUTINE_LABEL, routineEvent, type Plan, type PlanSegment } from './plan.ts';
import { isBusyNearbyCompatible } from './supervision.ts';
import { assessActivity, assessRecipe, NO_TIMING, spanOf, type ChildTiming, type EventSpan, type TimingAssessment } from './timing.ts';
import { activityProfile, recipeProfile, timeIssue, type TimeIssue } from './timeRules.ts';
import { parseHHMM } from './time.ts';

export type Lane = 'c1' | 'c2';

export interface LaidOut {
  segment: PlanSegment;
  /** Position in plan.segments. */
  index: number;
  /** Setup begins (offset minutes). */
  start: number;
  engageStart: number;
  engageEnd: number;
  /** Tidy-up ends. */
  end: number;
  setup: number;
  cleanup: number;
  wall: number;
  lanes: Lane[];
  /** Index of the routine block this entry runs alongside, or null for the main sequence. */
  host: number | null;
  anchored: boolean;
  /** Catalog entry no longer exists. */
  missing: boolean;
}

/**
 * What the adult is doing during a routine block, for whoever else is awake.
 * free: available. busy: occupied but in the same place (feeding, settling, holding).
 * undivided: supervising eating. unknown: the parent hasn't said (a nap with no
 * settling time or "staying with them"); never treated as available.
 */
export type AdultState = 'free' | 'busy' | 'undivided' | 'unknown';

export type Repair =
  | { kind: 'shorten'; index: number; minutes: number; label: string }
  | { kind: 'remove'; index: number; label: string }
  | { kind: 'move-after'; index: number; after: number; label: string }
  | { kind: 'shift'; index: number; at: number; label: string }
  | { kind: 'swap'; index: number; label: string };

export type ConflictKind =
  | 'overlap'
  | 'along-overrun'
  | 'along-adult'
  | 'uncovered'
  | 'timing'
  | 'eligibility'
  | 'routine-age'
  | 'missing';

export interface Conflict {
  kind: ConflictKind;
  /** Entry the conflict is shown on. */
  index: number;
  /** Related entry, if any. */
  other?: number;
  minutes?: number;
  /** conflict: the plan doesn't work as written. caution: worth a look, not wrong. */
  severity: 'conflict' | 'caution';
  message: string;
  repairs: Repair[];
}

export interface EntryAnalysis {
  item: LaidOut;
  /** 0/1 for one-child entries in two-child plans (and 0 in one-child plans); null for shared entries. */
  child: 0 | 1 | null;
  timing: TimingAssessment;
  timeIssue: TimeIssue | null;
  conflicts: Conflict[];
}

export interface Gap {
  start: number;
  end: number;
  /** 'all': nothing planned for anyone. A lane: that child has nothing planned while the other has a routine. */
  who: 'all' | Lane;
  /** For a child's gap during the other child's routine: what you're doing then. */
  adult?: AdultState;
  host?: number;
}

export interface PlanAnalysis {
  entries: EntryAnalysis[];
  gaps: Gap[];
  /** Offset where the last entry ends. */
  end: number;
  /** Minutes covered by at least one entry (union, so alongside tracks count once). */
  busy: number;
  /** Unplanned minutes inside the window. */
  open: number;
  /** Minutes the plan runs past its window. */
  overrun: number;
  conflicts: Conflict[];
  /** Per-child routine events (offset minutes), as fed to the timing evaluator. */
  events: [EventSpan[], EventSpan[]];
}

const ROUTINE_ADULT = { 'milk-feed': 'busy', meal: 'undivided', snack: 'undivided' } as const;

/** What the adult is doing at offset `t` during a routine block. */
export function adultStateAt(host: PlanSegment, hostStart: number, t: number): AdultState {
  if (host.routine === 'nap') {
    if (host.holding) return 'busy';
    if (host.settle === undefined) return 'unknown';
    return t < hostStart + host.settle ? 'busy' : 'free';
  }
  return host.routine ? ROUTINE_ADULT[host.routine] : 'busy';
}

const ADULT_WORDS: Record<string, string> = {
  nap: 'settling or staying with',
  'milk-feed': 'feeding',
  meal: 'helping with the meal for',
  snack: 'helping with the snack for',
};

export function childLabel(lane: Lane | 0 | 1): string {
  return lane === 'c1' || lane === 0 ? 'Child 1' : 'Child 2';
}

/**
 * Can one entry for child B run while child A has a routine block?
 * `ok: false` is a conflict; `caution` is a note (for parent-written entries Trunk can't assess).
 */
export function alongFeasible(
  seg: PlanSegment,
  act: Activity | undefined,
  host: PlanSegment,
  state: AdultState,
  adults: 1 | 2,
): { ok: boolean; reason?: string; caution?: string } {
  const hostChild = childLabel(host.who === 'c2' ? 'c2' : 'c1');
  if (adults >= 2) {
    if (act && act.supervision.minAdults >= 2) return { ok: false, reason: `${act.title} needs two adults, and one is with ${hostChild}.` };
    return { ok: true };
  }
  const doing = `${ADULT_WORDS[host.routine ?? 'nap']} ${hostChild}`;
  const unknownNote = `Trunk doesn’t know when you’ll be free during ${hostChild}’s nap. Set your settling time on the nap so Trunk can check this.`;
  if (seg.kind === 'routine') {
    if (state === 'free') return { ok: true };
    return { ok: false, reason: state === 'unknown' ? unknownNote : `You’re ${doing}, so a second routine can’t start yet with one adult.` };
  }
  if (seg.kind === 'custom') {
    return state === 'free' ? { ok: true } : { ok: true, caution: state === 'unknown' ? unknownNote : `Check you can manage this while you’re ${doing}.` };
  }
  if (!act) return { ok: false, reason: 'This activity is no longer in Trunk.' };
  if (state === 'undivided') return { ok: false, reason: `You’re ${doing}, which needs your full attention with one adult.` };
  if (act.outing || !act.places.includes('indoors')) return { ok: false, reason: `${hostChild} is at home, so with one adult this needs to happen indoors.` };
  if (state !== 'free' && !isBusyNearbyCompatible(act)) {
    return { ok: false, reason: state === 'unknown' ? unknownNote : `This needs more of you than you can give while ${doing}.` };
  }
  // Something they can do with you nearby, but Trunk doesn't know where you'll be: the parent decides.
  if (state === 'unknown') return { ok: true, caution: `${unknownNote} This works only if you can keep watch from the same room.` };
  return { ok: true };
}

/** Lay out a plan's entries on the minute axis. Pure; no catalog checks beyond overhead. */
export function layoutPlan(plan: Pick<Plan, 'kids' | 'segments'>, c: IndexedCatalog): LaidOut[] {
  const kidCount = plan.kids.length;
  const items: LaidOut[] = [];
  let cursor = 0;
  let host: { index: number; cursor: number } | null = null;
  plan.segments.forEach((segment, index) => {
    const { setup, cleanup, missing } = overheadFor(segment, c);
    const wall = setup + segment.minutes + cleanup;
    let start: number;
    let hostIndex: number | null = null;
    if (segment.along && host) {
      hostIndex = host.index;
      start = segment.at ?? host.cursor;
      host.cursor = Math.max(host.cursor, start + wall);
    } else {
      if (host) {
        // The next shared entry waits for whatever ran alongside the routine.
        cursor = Math.max(cursor, host.cursor);
        host = null;
      }
      start = segment.at ?? cursor;
      cursor = Math.max(cursor, start + wall);
      if (segment.kind === 'routine') {
        const settle = segment.routine === 'nap' && !segment.holding ? (segment.settle ?? 0) : 0;
        host = { index, cursor: start + settle };
      }
    }
    items.push({
      segment,
      index,
      start,
      engageStart: start + setup,
      engageEnd: start + setup + segment.minutes,
      end: start + wall,
      setup,
      cleanup,
      wall,
      lanes: lanesOf(segment, kidCount),
      host: hostIndex,
      anchored: segment.at !== undefined,
      missing,
    });
  });
  return items;
}

/** Measure of the union of intervals, clipped to [from, to). */
function unionLength(intervals: { start: number; end: number }[], from = -Infinity, to = Infinity): number {
  const sorted = intervals
    .map((i) => ({ start: Math.max(from, i.start), end: Math.min(to, i.end) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const i of sorted) {
    if (i.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = i.start;
      curEnd = i.end;
    } else curEnd = Math.max(curEnd, i.end);
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/** Free sub-intervals of [from, to) not covered by `busy`. */
function freeIntervals(from: number, to: number, busy: { start: number; end: number }[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let t = from;
  for (const b of [...busy].sort((x, y) => x.start - y.start)) {
    if (b.end <= t) continue;
    if (b.start >= to) break;
    if (b.start > t) out.push({ start: t, end: Math.min(b.start, to) });
    t = Math.max(t, b.end);
  }
  if (t < to) out.push({ start: t, end: to });
  return out;
}

export function segmentName(seg: PlanSegment, c: IndexedCatalog): string {
  if (seg.kind === 'activity') return c.activityById.get(seg.ref ?? '')?.title ?? 'Unavailable activity';
  if (seg.kind === 'recipe') return c.recipeById.get(seg.ref ?? '')?.title ?? 'Unavailable pairing';
  if (seg.kind === 'routine') return seg.routine ? ROUTINE_LABEL[seg.routine] : 'Routine';
  if (seg.kind === 'break') return seg.label || 'Flexible break';
  return seg.label || 'Your own activity';
}

/** Per-child timing context for a laid-out plan. */
export function childTimings(plan: Pick<Plan, 'kids'>, items: LaidOut[]): ChildTiming[] {
  const events: [EventSpan[], EventSpan[]] = [[], []];
  for (const it of items) {
    const s = it.segment;
    if (s.kind !== 'routine' || !s.routine) continue;
    const e: EventSpan = { event: routineEvent(s.routine), start: it.start, end: it.end };
    for (const lane of it.lanes) events[lane === 'c1' ? 0 : 1].push(e);
  }
  return plan.kids.map((k, i) => ({ days: toDays(k.age), events: events[i] }));
}

/**
 * Full analysis. `extra` adds momentary context (for example "Just fed" when the
 * plan was made) without storing it in the plan.
 */
export function analyzePlan(plan: Plan, c: IndexedCatalog, extra?: ChildTiming[]): PlanAnalysis {
  const items = layoutPlan(plan, c);
  const two = plan.kids.length === 2;
  const base = childTimings(plan, items);
  const timings: ChildTiming[] = base.map((t, i) => (extra?.[i] ? { ...t, events: [...t.events, ...extra[i].events], napNext: false } : t));
  const startClock = parseHHMM(plan.start);
  const kidDays = plan.kids.map((k) => toDays(k.age));
  const conflicts: Conflict[] = [];
  const name = (i: number) => segmentName(plan.segments[i], c);

  const entries: EntryAnalysis[] = items.map((item) => {
    const seg = item.segment;
    const list: Conflict[] = [];
    let timing: TimingAssessment = NO_TIMING;
    let issue: TimeIssue | null = null;
    let child: 0 | 1 | null = null;
    if (seg.kind === 'activity') {
      child = two ? (seg.who === 'c2' ? 1 : 0) : 0;
      const a = c.activityById.get(seg.ref ?? '');
      if (a) {
        const span = spanOf(item.start, item.setup, seg.minutes, item.cleanup);
        timing = assessActivity(c, a, span, timings[child], child);
        issue = timeIssue(activityProfile(a), startClock + item.start, item.wall, kidDays[child], plan.settings.place);
        if (a.retired || !activityEligible(a, { days: kidDays[child], notYet: plan.kids[child].notYet }, plan.settings.adults)) {
          list.push({ kind: 'eligibility', index: item.index, severity: 'conflict', message: `${a.title} isn’t suitable for ${two ? childLabel(child) + '’s' : 'this'} age or readiness.`, repairs: [{ kind: 'swap', index: item.index, label: 'Swap it' }, { kind: 'remove', index: item.index, label: 'Remove it' }] });
        }
      }
    } else if (seg.kind === 'recipe') {
      const r = c.recipeById.get(seg.ref ?? '');
      if (r && two) {
        const span = spanOf(item.start, item.setup, seg.minutes, item.cleanup);
        timing = assessRecipe(c, r, span, [timings[0], timings[1]], seg.younger === 'c2' ? 1 : 0);
        issue = timeIssue(recipeProfile(r, c.activityById.get(r.younger.activity)), startClock + item.start, item.wall, Math.min(...kidDays), plan.settings.place);
      }
    } else if (seg.kind === 'routine' && (seg.routine === 'meal' || seg.routine === 'snack')) {
      const young = item.lanes.filter((l) => kidDays[l === 'c1' ? 0 : 1] < monthsToDays(6));
      if (young.length) {
        list.push({ kind: 'routine-age', index: item.index, severity: 'caution', message: `Meals and snacks are for children already eating solid foods; ${young.map(childLabel).join(' and ')} is under 6 months.`, repairs: [{ kind: 'remove', index: item.index, label: 'Remove it' }] });
      }
    }
    if (item.missing) {
      list.push({ kind: 'missing', index: item.index, severity: 'conflict', message: 'This is no longer in Trunk.', repairs: [{ kind: 'swap', index: item.index, label: 'Swap it' }, { kind: 'remove', index: item.index, label: 'Remove it' }] });
    }
    if (timing.avoid && timing.cue) {
      list.push({ kind: 'timing', index: item.index, severity: 'caution', message: timing.cue.text, repairs: [{ kind: 'swap', index: item.index, label: 'Swap for something else' }] });
    }
    return { item, child, timing, timeIssue: issue, conflicts: list };
  });

  // ---- Main sequence: entries running into an anchored entry ----
  const main = items.filter((it) => it.host === null);
  for (let k = 1; k < main.length; k++) {
    const it = main[k];
    if (!it.anchored) continue;
    // Latest end among earlier main-sequence entries (and what ran alongside them).
    let prev: LaidOut | null = null;
    for (const p of items) {
      if (p.index >= it.index) break;
      if (!prev || p.end > prev.end) prev = p;
    }
    if (!prev || prev.end <= it.start) continue;
    const by = prev.end - it.start;
    const culprit = prev.index;
    const seg = plan.segments[culprit];
    const { min } = bounds(seg, c);
    const repairs: Repair[] = [];
    if (seg.kind !== 'routine' && seg.minutes - by >= min) repairs.push({ kind: 'shorten', index: culprit, minutes: seg.minutes - by, label: `Shorten ${name(culprit)} by ${by} min` });
    if (!plan.segments[culprit].at && plan.segments[culprit].kind !== 'routine' && prev.host === null) {
      repairs.push({ kind: 'move-after', index: culprit, after: it.index, label: `Move ${name(culprit)} after ${name(it.index)}` });
    }
    repairs.push({ kind: 'shift', index: it.index, at: it.start + by, label: `Move ${name(it.index)} ${by} min later` });
    if (seg.kind !== 'routine') repairs.push({ kind: 'remove', index: culprit, label: `Remove ${name(culprit)}` });
    const sameChild = prev.lanes.some((l) => it.lanes.includes(l));
    conflicts.push({
      kind: 'overlap',
      index: culprit,
      other: it.index,
      minutes: by,
      severity: 'conflict',
      message:
        sameChild || !two
          ? `Runs ${by} min into ${name(it.index)} at its set time.`
          : plan.settings.adults === 1
            ? `Runs ${by} min into ${name(it.index)}; one adult can’t do both.`
            : `Runs ${by} min into ${name(it.index)}. To do both at once, move one alongside the other.`,
      repairs,
    });
  }

  // ---- Alongside tracks ----
  const gaps: Gap[] = [];
  for (const h of items) {
    const hs = h.segment;
    if (hs.kind !== 'routine' || h.host !== null) continue;
    const along = items.filter((x) => x.host === h.index);
    if (two && hs.who !== 'both') {
      const other: Lane = hs.who === 'c2' ? 'c1' : 'c2';
      for (let k = 0; k < along.length; k++) {
        const x = along[k];
        const act = x.segment.kind === 'activity' ? c.activityById.get(x.segment.ref ?? '') : undefined;
        const state = adultStateAt(hs, h.start, x.start);
        const f = alongFeasible(x.segment, act, hs, state, plan.settings.adults);
        const fixes: Repair[] =
          x.segment.kind === 'routine'
            ? [{ kind: 'shift', index: x.index, at: h.end, label: `Move it after ${name(h.index).toLowerCase()}` }, { kind: 'remove', index: x.index, label: 'Remove it' }]
            : [{ kind: 'swap', index: x.index, label: 'Swap for something that fits' }, { kind: 'remove', index: x.index, label: 'Remove it' }];
        if (!f.ok) conflicts.push({ kind: 'along-adult', index: x.index, other: h.index, severity: 'conflict', message: f.reason!, repairs: fixes });
        else if (f.caution) conflicts.push({ kind: 'along-adult', index: x.index, other: h.index, severity: 'caution', message: f.caution, repairs: [] });
        // Two entries for the same child at once inside the track.
        const prev = along.slice(0, k).reduce<LaidOut | null>((m, p) => (!m || p.end > m.end ? p : m), null);
        if (prev && prev.end > x.start) {
          const by = prev.end - x.start;
          const { min } = bounds(prev.segment, c);
          const repairs: Repair[] = [];
          if (prev.segment.kind !== 'routine' && prev.segment.minutes - by >= min) repairs.push({ kind: 'shorten', index: prev.index, minutes: prev.segment.minutes - by, label: `Shorten ${name(prev.index)} by ${by} min` });
          if (x.anchored) repairs.push({ kind: 'shift', index: x.index, at: prev.end, label: `Move ${name(x.index)} ${by} min later` });
          repairs.push({ kind: 'remove', index: prev.index, label: `Remove ${name(prev.index)}` });
          conflicts.push({ kind: 'overlap', index: prev.index, other: x.index, minutes: by, severity: 'conflict', message: `${childLabel(other)} would be doing ${name(prev.index)} and ${name(x.index)} at once for ${by} min.`, repairs });
        }
        if (x.end > h.end) {
          const by = x.end - h.end;
          const { min } = bounds(x.segment, c);
          const repairs: Repair[] = [];
          if (x.segment.minutes - by >= min && x.segment.kind !== 'routine') repairs.push({ kind: 'shorten', index: x.index, minutes: x.segment.minutes - by, label: `Shorten it by ${by} min` });
          if (x.segment.kind === 'routine') repairs.push({ kind: 'shift', index: x.index, at: h.end, label: `Move it after ${name(h.index).toLowerCase()}` });
          repairs.push({ kind: 'remove', index: x.index, label: 'Remove it' });
          conflicts.push({ kind: 'along-overrun', index: x.index, other: h.index, minutes: by, severity: 'conflict', message: `Runs ${by} min past the end of ${childLabel(hs.who === 'c2' ? 'c2' : 'c1')}’s ${name(h.index).toLowerCase()}.`, repairs });
        }
      }
      // Split the other child's free time where your availability changes (end of settling).
      const cut = hs.routine === 'nap' && !hs.holding && hs.settle !== undefined ? h.start + hs.settle : null;
      for (const g of freeIntervals(h.start, h.end, along)) {
        const parts = cut !== null && g.start < cut && cut < g.end ? [{ start: g.start, end: cut }, { start: cut, end: g.end }] : [g];
        for (const part of parts) gaps.push({ start: part.start, end: part.end, who: other, adult: adultStateAt(hs, h.start, part.start), host: h.index });
      }
    } else {
      for (const x of along) {
        conflicts.push({ kind: 'along-adult', index: x.index, other: h.index, severity: 'conflict', message: 'Both children are in this routine already.', repairs: [{ kind: 'remove', index: x.index, label: 'Remove it' }] });
      }
    }
  }

  // ---- Two children, one-child entry outside a routine: the other child has nothing planned ----
  if (two) {
    for (const it of main) {
      const s = it.segment;
      if (s.kind === 'activity' || ((s.kind === 'custom' || s.kind === 'routine') && (s.who === 'c1' || s.who === 'c2'))) {
        if (s.kind === 'routine') continue;
        const other = s.who === 'c2' ? 'Child 1' : 'Child 2';
        conflicts.push({
          kind: 'uncovered',
          index: it.index,
          severity: s.kind === 'activity' && plan.settings.adults === 1 ? 'conflict' : 'caution',
          message:
            plan.settings.adults === 2
              ? `${other} has nothing planned during this; make sure the other adult is with them.`
              : s.kind === 'custom'
                ? `${other} has nothing planned during this. Check who’s with them.`
                : `${other} has nothing planned during this. Put it alongside ${other}’s nap or feed, or choose a pairing for both.`,
          repairs: [{ kind: 'remove', index: it.index, label: 'Remove it' }],
        });
      }
    }
  }

  // ---- Totals and main-sequence gaps ----
  const end = items.reduce((m, it) => Math.max(m, it.end), 0);
  const busy = unionLength(items);
  const open = Math.max(0, plan.window - unionLength(items, 0, plan.window));
  const overrun = Math.max(0, end - plan.window);
  let t = 0;
  for (const it of main) {
    if (it.start > t) gaps.push({ start: t, end: it.start, who: 'all' });
    t = Math.max(t, it.end, ...items.filter((x) => x.host === it.index).map((x) => x.end));
  }
  if (t < plan.window) gaps.push({ start: t, end: plan.window, who: 'all' });
  gaps.sort((a, b) => a.start - b.start || (a.who === 'all' ? -1 : 1));

  const all = [...entries.flatMap((e) => e.conflicts), ...conflicts];
  // Show each conflict on its entry, and an overlap on both entries involved (listed once in `all`).
  for (const cf of conflicts) {
    entries[cf.index]?.conflicts.push(cf);
    if (cf.other !== undefined && cf.other !== cf.index && (cf.kind === 'overlap' || cf.kind === 'along-overrun')) entries[cf.other]?.conflicts.push(cf);
  }
  const events: [EventSpan[], EventSpan[]] = [base[0]?.events.slice() ?? [], base[1]?.events.slice() ?? []];
  return { entries, gaps, end, busy, open, overrun, conflicts: all, events };
}

// ---------- Compatibility helpers ----------

const ONE_KID: Plan['kids'][number] = { age: { value: 6, unit: 'm' }, notYet: [] };

/** One row per entry in plan order, with clock minutes (start time + offset; may pass 1440). */
export interface TimedSegment {
  segment: PlanSegment;
  index: number;
  start: number;
  end: number;
  setup: number;
  cleanup: number;
  wall: number;
  missing: boolean;
  host: number | null;
  lanes: Lane[];
}

export function timeline(plan: Pick<Plan, 'start' | 'segments'> & { kids?: Plan['kids'] }, c: IndexedCatalog): TimedSegment[] {
  const clock = parseHHMM(plan.start);
  return layoutPlan({ kids: plan.kids ?? [ONE_KID], segments: plan.segments }, c).map((it) => ({
    segment: it.segment,
    index: it.index,
    start: clock + it.start,
    end: clock + it.end,
    setup: it.setup,
    cleanup: it.cleanup,
    wall: it.wall,
    missing: it.missing,
    host: it.host,
    lanes: it.lanes,
  }));
}

/** Wall-clock minutes covered by the plan (union of intervals; alongside tracks count once). */
export function totalWallMinutes(plan: Pick<Plan, 'segments'> & { kids?: Plan['kids'] }, c: IndexedCatalog): number {
  return unionLength(layoutPlan({ kids: plan.kids ?? [ONE_KID], segments: plan.segments }, c));
}
