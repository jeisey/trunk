/**
 * Cross-record validation for the Trunk catalog.
 *
 * Zod (schema.ts) checks each record's shape. This module checks everything that
 * needs more than one record or encodes a safety rule: duplicate IDs, dangling
 * references, age bounds, duration compatibility, provenance, and hazard rules.
 */
import { ContentFile, type Activity, type Claim, type ContentFile as ContentFileT, type MixedAgeRecipe, type Source, type StarterPlan, type TimingRule } from './schema.ts';
import { ageStringToDays, MAX_SUPPORTED_DAYS_EXCLUSIVE, MIN_SUPPORTED_DAYS, monthsToDays } from '../lib/age.ts';
import { checkParallel } from '../lib/supervision.ts';

export interface Issue {
  file: string;
  id?: string;
  message: string;
}

export interface Catalog {
  sources: Source[];
  claims: Claim[];
  timingRules: TimingRule[];
  activities: Activity[];
  recipes: MixedAgeRecipe[];
  starterPlans: StarterPlan[];
}

export interface ValidationResult {
  catalog: Catalog;
  errors: Issue[];
  warnings: Issue[];
}

/** Materials and ideas Trunk never suggests. Scanned in instructional text only (not safety notes). */
export const BANNED_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /water[\s-]?beads?/i, label: 'water beads' },
  { pattern: /button[\s-]?batter(y|ies)|coin[\s-]?cell/i, label: 'button/coin batteries' },
  { pattern: /magnet/i, label: 'magnets' },
  { pattern: /balloon/i, label: 'balloons' },
  { pattern: /\bmarbles?\b/i, label: 'marbles' },
  { pattern: /\bpopcorn\b|whole grapes?|\bnuts\b|hard candy/i, label: 'high-risk choking foods' },
  { pattern: /plastic bag/i, label: 'plastic bags' },
];

/** Movement words that should never appear in instructions for babies and young toddlers. */
const ROUGH_HANDLING = /\bbounc|\btoss|\bthrow (the|your) (baby|child)|\bswing (the|your) baby|\bjiggl|\bshake (the|your) (baby|child)/i;

/** Wording that brings a second child into a single-child activity. */
const SECOND_CHILD = /\b(two children|baby nearby|baby too|toddler and baby|older child|older sibling|younger sibling|big kid|big sibling|sibling)\b/i;

const SERIOUS_HAZARDS = new Set(['water', 'food', 'suffocation', 'heat', 'traffic', 'falls', 'small-parts']);

interface Located<T> {
  file: string;
  record: T;
}

export function parseFile(file: string, raw: unknown): { data?: ContentFileT; errors: Issue[] } {
  const result = ContentFile.safeParse(raw);
  if (result.success) return { data: result.data, errors: [] };
  return {
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      const id = idAtPath(raw, issue.path as (string | number)[]);
      return { file, id, message: `${path ? path + ': ' : ''}${issue.message}` };
    }),
  };
}

function idAtPath(raw: unknown, path: (string | number)[]): string | undefined {
  if (path.length < 2 || typeof raw !== 'object' || raw === null) return undefined;
  const list = (raw as Record<string, unknown>)[path[0] as string];
  if (!Array.isArray(list)) return undefined;
  const item = list[path[1] as number] as { id?: unknown } | undefined;
  return typeof item?.id === 'string' ? item.id : undefined;
}

export function validateCatalog(files: { file: string; data: ContentFileT }[], today = new Date()): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (file: string, id: string | undefined, message: string) => errors.push({ file, id, message });
  const warn = (file: string, id: string | undefined, message: string) => warnings.push({ file, id, message });

  const sources: Located<Source>[] = [];
  const claims: Located<Claim>[] = [];
  const activities: Located<Activity>[] = [];
  const recipes: Located<MixedAgeRecipe>[] = [];
  const plans: Located<StarterPlan>[] = [];
  const rules: Located<TimingRule>[] = [];
  for (const { file, data } of files) {
    data.sources.forEach((record) => sources.push({ file, record }));
    data.claims.forEach((record) => claims.push({ file, record }));
    data.timingRules.forEach((record) => rules.push({ file, record }));
    data.activities.forEach((record) => activities.push({ file, record }));
    data.recipes.forEach((record) => recipes.push({ file, record }));
    data.starterPlans.forEach((record) => plans.push({ file, record }));
  }

  // ---- Duplicate IDs (all families share one namespace) and duplicate URLs ----
  const seen = new Map<string, string>();
  for (const { file, record } of [...sources, ...claims, ...rules, ...activities, ...recipes, ...plans] as Located<{ id: string }>[]) {
    const prior = seen.get(record.id);
    if (prior) err(file, record.id, `duplicate id (also in ${prior})`);
    else seen.set(record.id, file);
  }
  const urls = new Map<string, string>();
  for (const { file, record } of sources) {
    const key = record.url.replace(/\/$/, '').toLowerCase();
    const prior = urls.get(key);
    if (prior) err(file, record.id, `duplicate source URL (already registered as ${prior}); reuse that source id`);
    else urls.set(key, record.id);
  }

  const sourceById = new Map(sources.map((s) => [s.record.id, s.record]));
  const claimById = new Map(claims.map((c) => [c.record.id, c.record]));
  const activityById = new Map(activities.map((a) => [a.record.id, a.record]));
  const recipeById = new Map(recipes.map((r) => [r.record.id, r.record]));
  const ruleById = new Map(rules.map((r) => [r.record.id, r.record]));
  const usedRules = new Set<string>();
  const usedSources = new Set<string>();
  const usedClaims = new Set<string>();
  const todayIso = today.toISOString().slice(0, 10);

  const checkDate = (file: string, id: string, date: string, label: string) => {
    if (date > todayIso) err(file, id, `${label} ${date} is in the future`);
  };

  // ---- Sources ----
  for (const { file, record } of sources) {
    checkDate(file, record.id, record.checked, 'checked date');
  }

  // ---- Claims ----
  for (const { file, record } of claims) {
    for (const s of record.sources) {
      if (!sourceById.has(s)) err(file, record.id, `unknown source ${s}`);
      usedSources.add(s);
    }
  }

  const refClaims = (file: string, id: string, refs: string[], label: string) => {
    for (const c of refs) {
      if (!claimById.has(c)) err(file, id, `${label}: unknown claim ${c}`);
      usedClaims.add(c);
    }
  };

  const ageRange = (file: string, id: string, minText: string, maxText: string, label = 'age') => {
    const min = ageStringToDays(minText);
    const max = ageStringToDays(maxText);
    if (min < MIN_SUPPORTED_DAYS) err(file, id, `${label} minimum ${minText} is below 1 week`);
    if (max > MAX_SUPPORTED_DAYS_EXCLUSIVE) err(file, id, `${label} maximum ${maxText} is past the fifth birthday (max 60m)`);
    if (min >= max) err(file, id, `${label} minimum ${minText} must be below maximum ${maxText}`);
    return { min, max };
  };

  // ---- Timing rules ----
  for (const { file, record: t } of rules) {
    checkDate(file, t.id, t.checked, 'checked date');
    refClaims(file, t.id, t.claims, 'timing claims');
    if (t.basis === 'source' && t.claims.length === 0) err(file, t.id, 'a source-based timing rule needs at least one claim');
    if (t.window.basis === 'source' && t.basis !== 'source') err(file, t.id, 'a source-based window needs a source-based rule');
    if ((t.ageMin === undefined) !== (t.ageMax === undefined)) err(file, t.id, 'give both ageMin and ageMax, or neither');
    if (t.ageMin && t.ageMax) ageRange(file, t.id, t.ageMin, t.ageMax, 'timing rule age');
    if (t.condition && t.fit !== 'avoid' && t.fit !== 'later') err(file, t.id, 'a condition-limited rule must be "avoid" or "later"');
    if (t.match && t.basis === 'source' && t.fit === 'avoid' && !t.condition) {
      // Blanket exclusions by profile are too broad to attribute to a source; list the records instead.
      err(file, t.id, 'a policy (match) rule cannot be a source-based "avoid"; reference it from the specific activities');
    }
    if (t.match) usedRules.add(t.id);
  }

  const policyRules = rules.map((r) => r.record).filter((r) => r.match);
  const effectiveRules = (listed: readonly string[], stimulation: string) => [
    ...listed.map((id) => ruleById.get(id)).filter((r): r is TimingRule => Boolean(r)),
    ...policyRules.filter((r) => r.match!.stimulation.includes(stimulation as never)),
  ];

  // ---- Activities ----
  for (const { file, record: a } of activities) {
    const { min } = ageRange(file, a.id, a.ageMin, a.ageMax);
    checkDate(file, a.id, a.checked, 'checked date');
    refClaims(file, a.id, a.evidence.claims, 'evidence');
    if (a.why) refClaims(file, a.id, a.why.claims, 'why');
    for (const note of a.safety) refClaims(file, a.id, note.claims, 'safety');

    if (a.evidence.type !== 'practical' && a.evidence.claims.length === 0) {
      err(file, a.id, `evidence type "${a.evidence.type}" needs at least one claim`);
    }
    if (a.goals.length > 0 && a.evidence.claims.length === 0) {
      err(file, a.id, 'developmental goals need at least one supporting claim (or leave goals empty for a practical routine)');
    }

    const serious = a.hazards.filter((h) => SERIOUS_HAZARDS.has(h));
    if (serious.length > 0) {
      const citesSafety = a.safety.some((n) => n.claims.some((c) => claimById.get(c)?.kind === 'safety'));
      if (!citesSafety) err(file, a.id, `hazards [${serious.join(', ')}] need a safety note citing a safety claim`);
      // Cards and exported images show the first note, so it must be the sourced, most critical one.
      else if (!a.safety[0].claims.some((c) => claimById.get(c)?.kind === 'safety')) {
        err(file, a.id, 'with serious hazards, the first safety note must cite a safety claim (it is the one shown on cards and images)');
      }
    }
    if (a.hazards.includes('water')) {
      if (a.supervision.shareable) err(file, a.id, 'water activities must not be shareable');
      if (a.supervision.proximity === 'same-room') err(file, a.id, 'water activities need holding or arms-reach supervision');
      if (a.intents.includes('parent-moment')) err(file, a.id, 'water activities can never be a parent-moment option');
    }
    if (a.hazards.includes('heat') && a.supervision.shareable) err(file, a.id, 'heat activities must not be shareable');
    if (a.hazards.includes('food')) {
      if (!a.readiness.abilities.includes('eats-solids')) err(file, a.id, 'food activities need the eats-solids readiness ability');
      if (a.supervision.proximity === 'same-room') err(file, a.id, 'food activities need arms-reach supervision');
      if (a.supervision.shareable) err(file, a.id, 'food activities must not be shareable');
      if (min < monthsToDays(6)) err(file, a.id, 'food activities cannot start before 6 months');
      if (a.intents.includes('parent-moment')) err(file, a.id, 'a snack is not a hands-free distraction (remove parent-moment)');
    }
    if (a.hazards.includes('small-parts') && min < monthsToDays(36)) {
      err(file, a.id, 'small-parts hazards are not allowed for activities open to children under 3 years');
    }
    if (a.kind === 'media') {
      if (min < monthsToDays(18)) err(file, a.id, 'media activities cannot start before 18 months');
      if (a.evidence.claims.length === 0) err(file, a.id, 'media activities must cite media guidance');
      if (a.duration.max > 60) err(file, a.id, 'media activities must not exceed 60 minutes');
      if (a.goals.length > 0) err(file, a.id, 'media activities must not claim developmental goals');
    }
    if (a.tummyTime) {
      if (a.tummyTime.flatSurface !== (a.tummyTime.position === 'floor')) {
        err(file, a.id, 'only floor tummy time may be marked flatSurface: true');
      }
      if (ageStringToDays(a.ageMax) > monthsToDays(12)) err(file, a.id, 'tummy-time records must end by 12 months');
      if (!a.safety.some((n) => n.claims.some((c) => claimById.get(c)?.kind === 'safety'))) {
        err(file, a.id, 'tummy-time records need a safety note citing an awake-and-supervised safety claim');
      }
    }
    if (a.kind === 'outing' && !a.outing) err(file, a.id, 'kind "outing" requires outing: true');

    // Timing profile
    const listed = new Set<string>();
    for (const id of a.timing.rules) {
      const rule = ruleById.get(id);
      if (listed.has(id)) err(file, a.id, `timing rule ${id} listed twice`);
      listed.add(id);
      usedRules.add(id);
      if (!rule) {
        err(file, a.id, `unknown timing rule ${id}`);
        continue;
      }
      if (rule.match) err(file, a.id, `${id} is a policy rule (it has match); it applies automatically and must not be listed`);
      if (rule.ageMin && rule.ageMax) {
        const lo = ageStringToDays(rule.ageMin);
        const hi = ageStringToDays(rule.ageMax);
        if (hi <= min || lo >= ageStringToDays(a.ageMax)) err(file, a.id, `${id} covers ${rule.ageMin}–${rule.ageMax}, which doesn't overlap this activity's ages`);
      }
    }
    if (a.timing.stimulation === 'settling' && (a.noise !== 'quiet' || a.mess === 'medium' || a.mess === 'high')) {
      err(file, a.id, 'stimulation "settling" needs quiet noise and little or no mess');
    }
    if ((a.noise === 'loud' || a.mess === 'high') && (a.timing.stimulation === 'settling' || a.timing.stimulation === 'gentle')) {
      err(file, a.id, 'loud or very messy activities must be "lively" (or "variable")');
    }
    if (a.tummyTime) {
      const eff = effectiveRules(a.timing.rules, a.timing.stimulation);
      for (const when of ['before', 'after'] as const) {
        if (!eff.some((r) => r.event === 'milk-feed' && r.when === when && r.fit === 'avoid' && !r.condition)) {
          err(file, a.id, `tummy-time records need an "avoid" milk-feed rule for ${when} a feed (HSE advice applies to every position)`);
        }
      }
    }
    if (a.supervision.proximity === 'holding' && a.supervision.handsOn === 'none') {
      err(file, a.id, 'holding proximity implies hands-on supervision');
    }

    // Two-child setups belong in curated mixed-age recipes, which are feasibility-checked;
    // a single-child record may only point to them.
    for (const x of a.adaptations) {
      if (SECOND_CHILD.test(x) && !x.startsWith('Two children? Use')) {
        err(file, a.id, `adaptation adds a second child ("${x.slice(0, 40)}…"); use a mixed-age recipe instead`);
      }
    }

    const instructional = [a.title, a.summary, ...a.materials.items, ...a.steps, ...a.adaptations].join(' \n ');
    for (const { pattern, label } of BANNED_PATTERNS) {
      if (pattern.test(instructional)) err(file, a.id, `mentions ${label}, which Trunk never suggests`);
    }
    if (min < monthsToDays(24) && ROUGH_HANDLING.test(instructional)) {
      err(file, a.id, 'instructions for babies/young toddlers must not include bouncing, tossing, swinging, or shaking');
    }
    if (a.retired) warn(file, a.id, 'retired (kept for old share links; hidden from results)');
  }

  // ---- Mixed-age recipes ----
  for (const { file, record: r } of recipes) {
    checkDate(file, r.id, r.checked, 'checked date');
    refClaims(file, r.id, r.claims, 'claims');
    for (const note of r.safety) refClaims(file, r.id, note.claims, 'safety');
    const y = ageRange(file, r.id, r.younger.ageMin, r.younger.ageMax, 'younger role age');
    const o = ageRange(file, r.id, r.older.ageMin, r.older.ageMax, 'older role age');
    if (y.min > o.min) err(file, r.id, 'younger role must not start older than the older role');

    const roleActs: Activity[] = [];
    for (const [key, role] of [
      ['younger', r.younger],
      ['older', r.older],
    ] as const) {
      const act = activityById.get(role.activity);
      if (!act) {
        err(file, r.id, `${key} role: unknown activity ${role.activity}`);
        continue;
      }
      if (act.retired) err(file, r.id, `${key} role uses retired activity ${act.id}`);
      roleActs.push(act);
      const aMin = ageStringToDays(act.ageMin);
      const aMax = ageStringToDays(act.ageMax);
      const rMin = ageStringToDays(role.ageMin);
      const rMax = ageStringToDays(role.ageMax);
      if (rMin < aMin || rMax > aMax) {
        err(file, r.id, `${key} role ages ${role.ageMin}–${role.ageMax} must sit inside ${act.id} ages ${act.ageMin}–${act.ageMax}`);
      }
      if (act.supervision.minAdults > r.adult.minAdults) err(file, r.id, `${act.id} needs more adults than the recipe allows`);
      if (act.supervision.handsOn === 'continuous' && r.adult.handsOnFor !== key && r.adult.handsOnFor !== 'both') {
        err(file, r.id, `${act.id} needs continuous hands-on help; adult.handsOnFor must include ${key}`);
      }
      if (!r.places.every((p) => act.places.includes(p))) err(file, r.id, `recipe places must be allowed by ${act.id}`);
      const missing = act.readiness.abilities.filter((ab) => !role.abilities.includes(ab));
      if (missing.length) err(file, r.id, `${key} role must list readiness abilities required by ${act.id}: ${missing.join(', ')}`);
    }
    if (roleActs.length === 2) {
      const [ya, oa] = roleActs;
      const cap = Math.min(ya.duration.max, oa.duration.max);
      if (r.duration.max > cap) err(file, r.id, `duration max ${r.duration.max} exceeds what both activities support (${cap})`);
      if (r.mode === 'parallel' && r.adult.minAdults === 1) {
        const result = checkParallel(ya, oa, 1);
        if (!result.ok) err(file, r.id, `parallel recipe is not feasible for one adult: ${result.reasons.join(' ')}`);
      }
      const undivided = [...ya.hazards, ...oa.hazards].filter((h) => h === 'water' || h === 'heat' || h === 'food' || h === 'traffic');
      if (r.mode === 'together' && undivided.length && r.adult.handsOnFor !== 'both') {
        err(file, r.id, `together recipe with ${[...new Set(undivided)].join(', ')} needs adult.handsOnFor "both" (full attention on both children)`);
      }
      if (r.mode === 'parallel' && ya.id === oa.id) err(file, r.id, 'parallel recipes need two different activities');
      if (oa.hazards.includes('small-parts') && y.min < monthsToDays(36)) {
        err(file, r.id, 'older child’s activity has small parts and the younger child is under 3');
      }
    }
  }

  // ---- Starter plans ----
  for (const { file, record: p } of plans) {
    checkDate(file, p.id, p.checked, 'checked date');
    const ages = p.ages.map(ageStringToDays);
    const distinct = new Set<string>();
    let host: { who: 'c1' | 'c2' | 'both' } | null = null;
    for (const seg of p.segments) {
      if (seg.kind === 'routine') {
        if (seg.who !== 'both' && ages.length === 1 && seg.who === 'c2') err(file, p.id, 'a one-child plan has no c2');
        if ((seg.routine === 'meal' || seg.routine === 'snack') && seg.who !== 'both') {
          const d = seg.who === 'c2' ? ages[1] : ages[0];
          if (d !== undefined && d < monthsToDays(6)) err(file, p.id, 'meal/snack blocks are not for babies under 6 months');
        }
        if ((seg.routine === 'meal' || seg.routine === 'snack') && seg.who === 'both' && ages.some((d) => d < monthsToDays(6))) {
          err(file, p.id, 'meal/snack blocks are not for babies under 6 months');
        }
        host = { who: seg.who };
        continue;
      }
      if (seg.kind === 'activity') {
        distinct.add(seg.ref);
        const act = activityById.get(seg.ref);
        if (!act) {
          err(file, p.id, `unknown activity ${seg.ref}`);
          continue;
        }
        let childAges = ages;
        if (ages.length === 2) {
          if (!seg.along || !seg.who) {
            err(file, p.id, `two-child plans use recipes, or a single activity alongside the other child's routine block (${seg.ref})`);
          } else if (!host || host.who === 'both' || host.who === seg.who) {
            err(file, p.id, `${seg.ref} runs alongside a routine block, which must be for the other child`);
          }
          childAges = seg.who === 'c2' ? [ages[1]] : [ages[0]];
        } else if (seg.along || seg.who === 'c2') {
          err(file, p.id, `one-child plans can't use along/who on ${seg.ref}`);
        }
        if (seg.minutes < act.duration.min || seg.minutes > act.duration.max) {
          err(file, p.id, `${seg.ref} minutes ${seg.minutes} outside ${act.duration.min}–${act.duration.max}`);
        }
        const aMin = ageStringToDays(act.ageMin);
        const aMax = ageStringToDays(act.ageMax);
        if (!childAges.every((d) => d >= aMin && d < aMax)) err(file, p.id, `${seg.ref} is not age-eligible for ${p.ages.join(', ')}`);
        if (!seg.along) host = null;
      } else if (seg.kind === 'recipe') {
        host = null;
        distinct.add(seg.ref);
        const rec = recipeById.get(seg.ref);
        if (!rec) {
          err(file, p.id, `unknown recipe ${seg.ref}`);
          continue;
        }
        if (ages.length !== 2) err(file, p.id, `single-child plans cannot use recipe ${seg.ref}`);
        if (seg.minutes < rec.duration.min || seg.minutes > rec.duration.max) {
          err(file, p.id, `${seg.ref} minutes ${seg.minutes} outside ${rec.duration.min}–${rec.duration.max}`);
        }
        if (ages.length === 2) {
          const [a, b] = [...ages].sort((m, n) => m - n);
          const fits = (role: MixedAgeRecipe['younger'], d: number) =>
            d >= ageStringToDays(role.ageMin) && d < ageStringToDays(role.ageMax);
          if (!(fits(rec.younger, a) && fits(rec.older, b))) err(file, p.id, `${seg.ref} roles do not fit ages ${p.ages.join(', ')}`);
        }
      } else {
        host = null;
      }
    }
    if (distinct.size < 2) err(file, p.id, 'a starter plan must be a sequence of at least two different activities or recipes');
  }

  // ---- Unused provenance (warnings) ----
  for (const { file, record } of claims) {
    if (!usedClaims.has(record.id)) warn(file, record.id, 'claim is not referenced by any record');
  }
  for (const { file, record } of sources) {
    if (!usedSources.has(record.id)) warn(file, record.id, 'source is not referenced by any claim');
  }
  for (const { file, record } of rules) {
    if (!usedRules.has(record.id)) warn(file, record.id, 'timing rule is not referenced by any activity');
  }

  return {
    catalog: {
      sources: sources.map((s) => s.record),
      claims: claims.map((c) => c.record),
      timingRules: rules.map((r) => r.record),
      activities: activities.map((a) => a.record),
      recipes: recipes.map((r) => r.record),
      starterPlans: plans.map((p) => p.record),
    },
    errors,
    warnings,
  };
}
