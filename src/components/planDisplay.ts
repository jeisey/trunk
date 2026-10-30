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
import { childLabel, layoutPlan, segmentName, type EntryAnalysis, type Gap, type Lane, type PlanAnalysis } from '../lib/layout.ts';
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

/** The label for a child in a plan. A one-child plan has no number (it may be either of the parent's children). */
export function kidLabel(plan: Pick<Plan, 'kids'>, i: number): string {
  return plan.kids.length === 1 ? 'Your child' : childLabel(i === 1 ? 1 : 0);
}

/** "Child 1: about 4 months · Child 2: about 2 years" or "Your child: about 4 months". */
export function kidsAboutText(plan: Pick<Plan, 'kids'>, sep = ' · '): string {
  return plan.kids.map((k, i) => `${kidLabel(plan, i)}: about ${formatAge(k.age)}`).join(sep);
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
  return 'Not sure yet when you’ll be free, so Trunk doesn’t plan the other child’s time during it.';
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
      { who: two ? `${childLabel(child)} (${ages[child]})` : 'Your child', text: a.summary },
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
  if (seg.kind === 'break') return [{ who: two ? 'Everyone' : 'Your child', text: BREAK_HINT }];
  if (seg.kind === 'custom') {
    const who = whoText(seg, plan.kids.length) ?? 'Your child';
    return [{ who, text: opts.customText === false ? 'Your own entry' : 'Your own entry (no sources attached)' }];
  }
  if (seg.kind === 'routine' && seg.routine === 'nap' && two && seg.who !== 'both') return [{ who: 'You', text: napAdultText(seg) }];
  return [];
}

/** Hazards serious enough that an entry shows its two leading safety notes instead of one. */
export const SERIOUS_HAZARDS: ReadonlySet<string> = new Set(['water', 'food', 'suffocation', 'heat', 'traffic', 'falls', 'small-parts']);

/**
 * The safety line(s) shown with a plan entry everywhere (editor, shared preview,
 * image): the entry's leading sourced safety note, or its first two when the
 * activity (or either role in a pairing) carries a serious hazard.
 */
export function entrySafety(seg: PlanSegment, c: IndexedCatalog): string[] {
  if (seg.kind === 'activity') {
    const a = c.activityById.get(seg.ref ?? '');
    if (!a) return [];
    return a.safety.slice(0, a.hazards.some((h) => SERIOUS_HAZARDS.has(h)) ? 2 : 1).map((n) => n.text);
  }
  if (seg.kind === 'recipe') {
    const r = c.recipeById.get(seg.ref ?? '');
    if (!r) return [];
    const hazards = [r.younger.activity, r.older.activity].flatMap((id) => c.activityById.get(id)?.hazards ?? []);
    return r.safety.slice(0, hazards.some((h) => SERIOUS_HAZARDS.has(h)) ? 2 : 1).map((n) => n.text);
  }
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
  if (gap.adult === 'unknown') return `${other}: nothing planned yet. Add your settling time to ${hostChild}’s nap to plan this.`;
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
    const label = moments.length === 1 ? '' : `${labels[i] ?? childLabel(i === 1 ? 1 : 0)} `;
    parts.push(`${label}${bits.join(', ')}`);
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
      /** The second part of a track split by a main entry that starts inside it. */
      continued: boolean;
      /** The last part of this routine's track (where "+ Add for…" goes). */
      last: boolean;
    };

const VERB: Record<RoutineType, string> = { nap: 'naps', 'milk-feed': 'feeds', meal: 'eats', snack: 'has a snack' };

/**
 * The plan as a chronological list. Main entries and open time are ordered by
 * start time. After a one-child routine in a two-child plan come the other
 * child's alongside entries and unplanned time (with the adult state), as a
 * track. If a main entry starts in the middle of a track, the track is split
 * around it and the second part is marked as continued, so rows always read in
 * time order.
 */
export function planRows(plan: Pick<Plan, 'kids' | 'segments'>, analysis: PlanAnalysis): PlanRow[] {
  const two = plan.kids.length === 2;
  type Unit = { at: number; order: number; seq: number } & ({ kind: 'entry'; entry: EntryAnalysis } | { kind: 'gap'; gap: Gap } | { kind: 'item'; host: number; item: TrackItem });
  const units: Unit[] = [];
  let seq = 0;
  const trackHosts = new Set<number>();
  for (const e of analysis.entries) {
    const s = e.item.segment;
    if (e.item.host === null) {
      units.push({ kind: 'entry', entry: e, at: e.item.start, order: 0, seq: seq++ });
      if (two && s.kind === 'routine' && s.routine && s.who !== 'both') trackHosts.add(e.item.index);
    }
  }
  for (const e of analysis.entries) {
    if (e.item.host !== null && trackHosts.has(e.item.host)) units.push({ kind: 'item', host: e.item.host, item: { kind: 'entry', entry: e }, at: e.item.start, order: 2, seq: seq++ });
  }
  for (const g of analysis.gaps) {
    if (g.who === 'all') units.push({ kind: 'gap', gap: g, at: g.start, order: 1, seq: seq++ });
    else if (g.host !== undefined && trackHosts.has(g.host)) units.push({ kind: 'item', host: g.host, item: { kind: 'gap', gap: g }, at: g.start, order: 1.5, seq: seq++ });
  }
  units.sort((a, b) => a.at - b.at || a.order - b.order || a.seq - b.seq);

  const rows: PlanRow[] = [];
  const opened = new Set<number>();
  for (const u of units) {
    if (u.kind === 'entry') {
      rows.push({ kind: 'entry', entry: u.entry });
      const s = u.entry.item.segment;
      // A track always follows its routine, even when it's empty (it holds "+ Add for…").
      if (trackHosts.has(u.entry.item.index) && s.routine) {
        const hostLane: Lane = s.who === 'c2' ? 'c2' : 'c1';
        rows.push({ kind: 'track', host: u.entry, hostLane, otherLane: hostLane === 'c1' ? 'c2' : 'c1', verb: VERB[s.routine], items: [], continued: false, last: true });
        opened.add(u.entry.item.index);
      }
      continue;
    }
    if (u.kind === 'gap') {
      rows.push({ kind: 'gap', gap: u.gap });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last?.kind === 'track' && last.host.item.index === u.host) {
      last.items.push(u.item);
      continue;
    }
    const host = analysis.entries[u.host];
    const hs = host.item.segment;
    const hostLane: Lane = hs.who === 'c2' ? 'c2' : 'c1';
    rows.push({ kind: 'track', host, hostLane, otherLane: hostLane === 'c1' ? 'c2' : 'c1', verb: VERB[hs.routine ?? 'nap'], items: [u.item], continued: opened.has(u.host), last: true });
    opened.add(u.host);
  }
  // A split track: drop an empty first part, and keep "+ Add for…" on the last part only.
  const out = rows.filter((r, i) => !(r.kind === 'track' && !r.continued && r.items.length === 0 && rows.slice(i + 1).some((x) => x.kind === 'track' && x.host === r.host)));
  const seen = new Set<number>();
  for (let i = out.length - 1; i >= 0; i--) {
    const r = out[i];
    if (r.kind !== 'track') continue;
    r.last = !seen.has(r.host.item.index);
    seen.add(r.host.item.index);
  }
  for (const r of out) if (r.kind === 'track' && r.continued && !out.some((x) => x !== r && x.kind === 'track' && x.host === r.host && out.indexOf(x) < out.indexOf(r))) r.continued = false;
  return out;
}
