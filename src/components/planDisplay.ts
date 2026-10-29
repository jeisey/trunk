/**
 * Plain display helpers (no React) shared by the plan editor, saved list,
 * shared preview, share dialog, and the image export, so every surface labels
 * children, routines, and roles the same way. All timing and conflict facts
 * come from analyzePlan(); nothing here computes its own schedule.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import type { RoutineType } from '../content/schema.ts';
import { formatAge, formatAgeShort } from '../lib/age.ts';
import { adultText } from '../lib/labels.ts';
import { adultStateAt, childLabel, layoutPlan, segmentName, type EntryAnalysis, type Gap, type Lane, type PlanAnalysis } from '../lib/layout.ts';
import { BREAK_HINT, ROUTINE_LABEL, type Plan, type PlanSegment } from '../lib/plan.ts';
import { defaultPlanTitle } from '../lib/planTitle.ts';
import type { MomentContext } from '../lib/timing.ts';
import { formatClock, parseHHMM } from '../lib/time.ts';

/** The plan's own title, or the generated default (never "Untitled plan"). */
export function planTitle(plan: Plan): string {
  return plan.title.trim() || defaultPlanTitle(plan);
}

export function kidsText(plan: Pick<Plan, 'kids'>): string {
  return plan.kids.map((k) => formatAge(k.age)).join(' + ');
}

/** Clock text for an offset from the plan's start. */
export function clockAt(plan: Pick<Plan, 'start'>, offset: number): string {
  return formatClock(parseHHMM(plan.start) + offset);
}

/** "Nap 1:00 PM", "Child 2 meal 12:15 PM": routines in plan order. */
export function routineSummary(plan: Plan, c: IndexedCatalog): string[] {
  const two = plan.kids.length === 2;
  return layoutPlan(plan, c)
    .filter((it) => it.segment.kind === 'routine' && it.segment.routine)
    .map((it) => {
      const s = it.segment;
      const name = ROUTINE_LABEL[s.routine!];
      const who = two && s.who !== 'both' ? `${childLabel(s.who === 'c2' ? 'c2' : 'c1')} ${name.toLowerCase()}` : name;
      return `${who} ${clockAt(plan, it.start)}`;
    });
}

/** Who a one-child entry is for, in a two-child plan ("Child 2"), or "Both"; null when it doesn't need saying. */
export function whoText(seg: PlanSegment, kidCount: number): string | null {
  if (kidCount === 1 || seg.kind === 'recipe' || seg.kind === 'break') return null;
  if (seg.who === 'c1' || seg.who === 'c2') return childLabel(seg.who);
  if (seg.kind === 'activity') return 'Child 1';
  return 'Both';
}

const ROUTINE_ADULT_WORD: Record<RoutineType, string> = { nap: 'settle', 'milk-feed': 'feed', meal: 'help with the meal for', snack: 'help with the snack for' };

/** What the adult does during a nap, for the other child: the parent's own choice, never inferred. */
export function napAdultText(seg: PlanSegment): string {
  if (seg.holding) return 'You’re staying with them while they sleep.';
  if (seg.settle !== undefined) return `You’re settling them for about ${seg.settle} min, then free.`;
  return 'Not sure when you’ll be free, so Trunk treats you as busy.';
}

export interface RoleLine {
  who: string;
  text: string;
}

/** Who does what in an entry, with the correct Child 1 / Child 2 labels and ages. */
export function entryRoles(plan: Plan, c: IndexedCatalog, e: Pick<EntryAnalysis, 'child'> & { item: { segment: PlanSegment } }, opts: { customText?: boolean } = {}): RoleLine[] {
  const seg = e.item.segment;
  const two = plan.kids.length === 2;
  const ages = plan.kids.map((k) => formatAgeShort(k.age));
  if (seg.kind === 'activity') {
    const a = c.activityById.get(seg.ref ?? '');
    if (!a) return [];
    const child = e.child ?? (seg.who === 'c2' ? 1 : 0);
    return [
      { who: two ? `${childLabel(child)} (${ages[child]})` : 'Child 1', text: a.summary },
      { who: 'You', text: adultText(a.supervision) },
    ];
  }
  if (seg.kind === 'recipe') {
    const r = c.recipeById.get(seg.ref ?? '');
    if (!r) return [];
    const y = seg.younger === 'c2' ? 1 : 0;
    const o = y === 0 ? 1 : 0;
    return [
      { who: `${childLabel(y)} (${ages[y] ?? ''})`, text: r.younger.does },
      { who: `${childLabel(o)} (${ages[o] ?? ''})`, text: r.older.does },
      { who: 'You', text: r.adult.does },
    ];
  }
  if (seg.kind === 'break') return [{ who: two ? 'Everyone' : 'Child 1', text: BREAK_HINT }];
  if (seg.kind === 'custom') {
    const who = whoText(seg, plan.kids.length) ?? 'Child 1';
    return [{ who, text: opts.customText === false ? 'Your own entry' : 'Your own entry (no sources attached)' }];
  }
  if (seg.kind === 'routine' && seg.routine === 'nap' && two && seg.who !== 'both') return [{ who: 'You', text: napAdultText(seg) }];
  return [];
}

/** Entry title; custom text only when allowed (shares and images leave it out by default). */
export function entryTitle(seg: PlanSegment, c: IndexedCatalog, opts: { customText?: boolean } = {}): string {
  if (seg.kind === 'custom' && opts.customText === false) return 'Your own activity';
  return segmentName(seg, c);
}

/** A routine's heading with its child in two-child plans: "Nap · Child 1". */
export function entryHeading(seg: PlanSegment, plan: Plan, c: IndexedCatalog, opts: { customText?: boolean } = {}): string {
  const title = entryTitle(seg, c, opts);
  const who = whoText(seg, plan.kids.length);
  return who && seg.kind !== 'custom' ? `${title} · ${who}` : title;
}

/** The text for a child's unplanned time during the other child's routine. */
export function childGapText(gap: Gap, plan: Plan): string {
  const lane = gap.who === 'all' ? 'c1' : gap.who;
  const other = childLabel(lane);
  const host = gap.host !== undefined ? plan.segments[gap.host] : undefined;
  const hostChild = childLabel(lane === 'c1' ? 'c2' : 'c1');
  const routine = host?.routine ?? 'nap';
  if (gap.adult === 'free') return `${other}: unplanned time while ${hostChild} sleeps. You’re free to be with them.`;
  if (gap.adult === 'undivided') return `${other} has nothing planned while you ${ROUTINE_ADULT_WORD[routine]} ${hostChild}. They need to be safe and in view.`;
  if (routine === 'nap') return `${other} stays near you while you ${host?.holding ? 'stay with' : 'settle'} ${hostChild}.`;
  return `${other} stays near you while you ${ROUTINE_ADULT_WORD[routine]} ${hostChild}.`;
}

/** One compact line for momentary context a plan was made with ("Child 1 just fed, nap soon"). */
export function momentText(moments: readonly (MomentContext | undefined)[], labels: string[]): string | null {
  const parts: string[] = [];
  moments.forEach((m, i) => {
    if (!m || (!m.fed && !m.nap)) return;
    const bits: string[] = [];
    if (m.fed) bits.push(m.fedAgo ? `fed about ${m.fedAgo} min ago` : 'just fed');
    if (m.nap) bits.push(m.napIn != null ? `nap in about ${m.napIn} min` : 'nap soon');
    parts.push(`${labels[i] ?? childLabel(i === 1 ? 1 : 0)} ${bits.join(', ')}`);
  });
  return parts.length ? parts.join('; ') : null;
}

// ---------- Chronological rows ----------

export type TrackItem = { kind: 'entry'; entry: EntryAnalysis } | { kind: 'gap'; gap: Gap };

export type PlanRow =
  | TrackItem
  | {
      kind: 'track';
      host: EntryAnalysis;
      hostLane: Lane;
      otherLane: Lane;
      /** "naps", "feeds", "eats", "has a snack" */
      verb: string;
      items: TrackItem[];
    };

/**
 * A child's unplanned time during a nap can span "you're settling them" and
 * "you're free"; show the two parts separately so the adult state is right for each.
 */
function splitAtSettle(gap: Gap, host: PlanSegment, hostStart: number): Gap[] {
  if (host.routine !== 'nap' || host.holding || host.settle === undefined) return [gap];
  const t = hostStart + host.settle;
  if (t <= gap.start || t >= gap.end) return [{ ...gap, adult: adultStateAt(host, hostStart, gap.start) }];
  return [
    { ...gap, end: t, adult: adultStateAt(host, hostStart, gap.start) },
    { ...gap, start: t, adult: adultStateAt(host, hostStart, t) },
  ];
}

const VERB: Record<RoutineType, string> = { nap: 'naps', 'milk-feed': 'feeds', meal: 'eats', snack: 'has a snack' };

/**
 * The plan as a chronological list: main entries in order with open time
 * between them; after a one-child routine in a two-child plan, a track with the
 * other child's alongside entries and unplanned time (with the adult state).
 */
export function planRows(plan: Pick<Plan, 'kids' | 'segments'>, analysis: PlanAnalysis): PlanRow[] {
  const two = plan.kids.length === 2;
  const groups: { host: EntryAnalysis; along: EntryAnalysis[] }[] = [];
  for (const e of analysis.entries) {
    if (e.item.host !== null && groups.length) groups[groups.length - 1].along.push(e);
    else groups.push({ host: e, along: [] });
  }
  const open = analysis.gaps.filter((g) => g.who === 'all');
  const rows: PlanRow[] = [];
  let k = 0;
  for (const g of groups) {
    while (k < open.length && open[k].end <= g.host.item.start) rows.push({ kind: 'gap', gap: open[k++] });
    rows.push({ kind: 'entry', entry: g.host });
    const hs = g.host.item.segment;
    if (!two || hs.kind !== 'routine' || hs.who === 'both' || !hs.routine) continue;
    const hostLane: Lane = hs.who === 'c2' ? 'c2' : 'c1';
    const items: (TrackItem & { at: number })[] = [
      ...g.along.map((entry) => ({ kind: 'entry' as const, entry, at: entry.item.start })),
      ...analysis.gaps
        .filter((gap) => gap.who !== 'all' && gap.host === g.host.item.index)
        .flatMap((gap) => splitAtSettle(gap, hs, g.host.item.start))
        .map((gap) => ({ kind: 'gap' as const, gap, at: gap.start - 0.5 })),
    ].sort((a, b) => a.at - b.at);
    rows.push({ kind: 'track', host: g.host, hostLane, otherLane: hostLane === 'c1' ? 'c2' : 'c1', verb: VERB[hs.routine], items: items.map(({ at: _at, ...rest }) => (void _at, rest as TrackItem)) });
  }
  while (k < open.length) rows.push({ kind: 'gap', gap: open[k++] });
  return rows;
}
