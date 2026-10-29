/**
 * Timing evaluator. One pure rule engine for the finder, planner, plan editor,
 * shared previews, and image export: given a child's known routine events and
 * when an entry happens, which timing rules apply, and what follows from them?
 *
 * - Events come only from what a parent told Trunk: routine blocks in a plan, or
 *   the finder's momentary "Just fed" / "Nap soon". Nothing is inferred from age
 *   or the clock, and missing events are simply absent.
 * - `after` windows run forward from the event's END and are checked against the
 *   entry's engagement time (when the child is actually doing it).
 * - `before` windows run back from the event's START and are checked against
 *   engagement plus tidy-up (everything that still has to happen first).
 * - Elapsed time is measured directly between the event and the entry, so a break
 *   or another entry in between never resets a post-feed window.
 * - Rules limited to a condition (for example spit-up) are advisory: shown and
 *   ranked lower, never used to exclude, because Trunk never records conditions.
 * - No rule means "no specific timing guidance", never "cleared". Nothing here
 *   produces a "safe after feeding" label.
 */
import type { Activity, MixedAgeRecipe, RoutineEvent, Stimulation, TimingFit, TimingRule } from '../content/schema.ts';
import { days } from './eligibility.ts';

/** A routine event for one child, in minutes on the same axis as the entries being assessed. */
export interface EventSpan {
  event: RoutineEvent;
  start: number;
  end: number;
}

export interface ChildTiming {
  /** Age in days (rules can be limited to an age range). */
  days: number;
  events: readonly EventSpan[];
  /** Finder "Nap soon" with no time given: a nap follows directly after the entry being assessed. */
  napNext?: boolean;
}

/** When an entry happens: setup starts at `start`, the child is engaged from `engageStart` to `engageEnd`, tidy-up ends at `end`. */
export interface Span {
  start: number;
  engageStart: number;
  engageEnd: number;
  end: number;
}

export function spanOf(start: number, setup: number, minutes: number, cleanup: number): Span {
  return { start, engageStart: start + setup, engageEnd: start + setup + minutes, end: start + setup + minutes + cleanup };
}

export interface TimingFinding {
  ruleId: string;
  /** Index of the child (in the children passed in) the rule applied to. */
  child: number;
  event: RoutineEvent;
  when: 'before' | 'after';
  fit: TimingFit;
  /** Condition-limited: shown as advice and ranked lower, never used to exclude. */
  advisory: boolean;
  cue: string;
  reason: string;
  basis: 'source' | 'editorial';
  windowMinutes: number;
  windowBasis: 'source' | 'editorial';
  claims: readonly string[];
}

export type CueTone = 'good' | 'caution' | 'avoid';

export interface TimingCue {
  text: string;
  tone: CueTone;
  finding: TimingFinding;
}

export interface TimingAssessment {
  /** An applicable, non-advisory "avoid": left out of automatic suggestions, flagged when a parent places it. */
  avoid: boolean;
  /** Ranking signal for this moment: positive is a good fit, negative a poorer one. */
  score: number;
  /** Applicable findings, most important first. */
  findings: TimingFinding[];
  /** The one cue worth showing on a card or timeline row, if any. */
  cue: TimingCue | null;
  /** The record's stimulation is "variable" (varies or not assessed): no profile-based preference applies. */
  unassessed: boolean;
}

export const NO_TIMING: TimingAssessment = { avoid: false, score: 0, findings: [], cue: null, unassessed: false };

export interface RulesIndex {
  timingRules: readonly TimingRule[];
  timingRuleById: ReadonlyMap<string, TimingRule>;
}

const ruleCache = new WeakMap<RulesIndex, Map<string, TimingRule[]>>();

/** Rules written for a record plus every policy rule (`match`) that selects its stimulation profile. */
export function rulesFor(c: RulesIndex, stimulation: Stimulation, listed: readonly string[] = []): TimingRule[] {
  let cache = ruleCache.get(c);
  if (!cache) {
    cache = new Map();
    ruleCache.set(c, cache);
  }
  const key = `${stimulation}|${listed.join(',')}`;
  let rules = cache.get(key);
  if (!rules) {
    const explicit = listed.map((id) => c.timingRuleById.get(id)).filter((r): r is TimingRule => Boolean(r));
    const policy = c.timingRules.filter((r) => r.match?.stimulation.includes(stimulation));
    rules = [...explicit, ...policy.filter((p) => !explicit.includes(p))];
    cache.set(key, rules);
  }
  return rules;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

function inScope(rule: TimingRule, childDays: number): boolean {
  if (!rule.ageMin || !rule.ageMax) return true;
  return childDays >= days(rule.ageMin) && childDays < days(rule.ageMax);
}

/** Which rules apply to this child for an entry at `span`. */
export function findingsFor(rules: readonly TimingRule[], span: Span, child: ChildTiming, childIndex = 0): TimingFinding[] {
  const out: TimingFinding[] = [];
  for (const rule of rules) {
    if (!inScope(rule, child.days)) continue;
    const w = rule.window.minutes;
    let hit = false;
    for (const e of child.events) {
      if (e.event !== rule.event) continue;
      if (rule.when === 'after' ? overlaps(span.engageStart, span.engageEnd, e.end, e.end + w) : overlaps(span.engageStart, span.end, e.start - w, e.start)) {
        hit = true;
        break;
      }
    }
    if (!hit && child.napNext && rule.event === 'nap' && rule.when === 'before') hit = true;
    if (!hit) continue;
    out.push({
      ruleId: rule.id,
      child: childIndex,
      event: rule.event,
      when: rule.when,
      fit: rule.fit,
      advisory: Boolean(rule.condition),
      cue: rule.cue,
      reason: rule.reason,
      basis: rule.basis,
      windowMinutes: w,
      windowBasis: rule.window.basis,
      claims: rule.claims,
    });
  }
  return out;
}

const rank = (f: TimingFinding) =>
  f.fit === 'avoid' ? (f.advisory ? 2 : 0) : f.fit === 'later' ? (f.advisory ? 4 : 3) : f.fit === 'preferred' ? 5 : 6;

/** Combine findings into one assessment. Any concern outweighs any preference. */
export function summarize(findings: TimingFinding[], unassessed = false): TimingAssessment {
  if (findings.length === 0) return unassessed ? { ...NO_TIMING, unassessed } : NO_TIMING;
  const sorted = [...findings].sort((a, b) => rank(a) - rank(b) || (a.basis === b.basis ? 0 : a.basis === 'source' ? -1 : 1));
  const avoid = sorted.some((f) => f.fit === 'avoid' && !f.advisory);
  let penalty = 0;
  for (const f of sorted) {
    if (f.fit === 'avoid') penalty += f.advisory ? 14 : 50;
    else if (f.fit === 'later') penalty += f.advisory ? 6 : 10;
  }
  const score = penalty > 0 ? -Math.min(60, penalty) : sorted.some((f) => f.fit === 'preferred') ? 10 : 0;
  const top = sorted.find((f) => f.fit !== 'neutral');
  const cue: TimingCue | null = top
    ? { text: top.cue, tone: top.fit === 'preferred' ? 'good' : top.fit === 'avoid' && !top.advisory ? 'avoid' : 'caution', finding: top }
    : null;
  return { avoid, score, findings: sorted, cue, unassessed };
}

export function assessActivity(c: RulesIndex, a: Pick<Activity, 'timing'>, span: Span, child: ChildTiming, childIndex = 0): TimingAssessment {
  const rules = rulesFor(c, a.timing.stimulation, a.timing.rules);
  return summarize(findingsFor(rules, span, child, childIndex), a.timing.stimulation === 'variable');
}

const STIM_ORDER: Record<Stimulation, number> = { settling: 0, gentle: 1, lively: 2, variable: 3 };

/**
 * A recipe is assessed per child: each child's own role activity against that
 * child's events, plus the policy rules for the shared space's stimulation.
 * A rule written for the baby's role never lands on the older child, or vice versa.
 */
export function assessRecipe(
  c: RulesIndex & { activityById: ReadonlyMap<string, Activity> },
  r: Pick<MixedAgeRecipe, 'younger' | 'older' | 'timing'>,
  span: Span,
  children: readonly [ChildTiming, ChildTiming],
  younger: 0 | 1,
): TimingAssessment {
  const findings: TimingFinding[] = [];
  let unassessed = r.timing.stimulation === 'variable';
  for (const [role, idx] of [
    [r.younger, younger],
    [r.older, younger === 0 ? 1 : 0],
  ] as const) {
    const act = c.activityById.get(role.activity);
    if (!act) continue;
    // Shared space more stimulating than the child's own role? Its profile applies to them too.
    const shared = STIM_ORDER[r.timing.stimulation] > STIM_ORDER[act.timing.stimulation] && r.timing.stimulation !== 'variable';
    const rules = [...rulesFor(c, act.timing.stimulation, act.timing.rules)];
    if (shared) for (const extra of rulesFor(c, r.timing.stimulation)) if (!rules.includes(extra)) rules.push(extra);
    if (act.timing.stimulation === 'variable') unassessed = true;
    findings.push(...findingsFor(rules, span, children[idx], idx));
  }
  // A preference for one child doesn't cancel a concern for the other.
  return summarize(findings, unassessed);
}

// ---------- Momentary context (finder) ----------

/** "Right now" for one child. Kept in memory only: never saved, shared, or restored. */
export interface MomentContext {
  fed: boolean;
  /** Minutes since the feed or meal ended, if the parent gave it. Unknown means "just now". */
  fedAgo?: number | null;
  nap: boolean;
  /** Minutes until the nap, if the parent gave it. Unknown means "right after this". */
  napIn?: number | null;
}

export const NO_MOMENT: MomentContext = { fed: false, nap: false };

export function hasMoment(m: MomentContext | undefined): boolean {
  return Boolean(m && (m.fed || m.nap));
}

/**
 * Events for the finder, on an axis where 0 is now. "Just fed" covers a milk feed
 * or a meal (rules for each are age-limited where it matters).
 */
export function momentTiming(childDays: number, m: MomentContext | undefined): ChildTiming {
  const events: EventSpan[] = [];
  if (m?.fed) {
    const end = -Math.max(0, m.fedAgo ?? 0);
    events.push({ event: 'milk-feed', start: end, end }, { event: 'meal', start: end, end });
  }
  let napNext = false;
  if (m?.nap) {
    if (m.napIn != null && m.napIn >= 0) events.push({ event: 'nap', start: m.napIn, end: m.napIn + 1 });
    else napNext = true;
  }
  return { days: childDays, events, napNext };
}
