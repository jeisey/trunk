/**
 * Coverage report: samples every age-slider stop (plus age pairs for two
 * children) to find content gaps. Age is never broadened to fill a gap;
 * gaps are reported for editors to address with new, appropriate records.
 */
import { AGE_STOPS, formatAgeShort, toDays, type EnteredAge } from '../lib/age.ts';
import { activityFitsAge, recipeAssignment } from '../lib/eligibility.ts';
import { isBusyNearbyCompatible } from '../lib/supervision.ts';
import { INTENTS, STIMULATION, type Activity, type Intent, type MixedAgeRecipe, type Stimulation, type TimingRule } from './schema.ts';
import type { Catalog } from './validate.ts';

export interface StopCoverage {
  age: string;
  days: number;
  total: number;
  lowEffort: number;
  busyNearby: number;
  indoors: number;
  outdoors: number;
  noMaterials: number;
  media: number;
  byIntent: Record<Intent, number>;
}

export interface PairCoverage {
  younger: string;
  older: string;
  together: number;
  parallel: number;
}

/** Reviewed stimulation of the age-eligible, non-retired activities at one slider stop. */
export interface TimingStop {
  age: string;
  days: number;
  settling: number;
  gentle: number;
  lively: number;
  variable: number;
}

export interface TimingRuleSummary {
  id: string;
  event: TimingRule['event'];
  when: TimingRule['when'];
  minutes: number;
  windowBasis: TimingRule['window']['basis'];
  fit: TimingRule['fit'];
  basis: TimingRule['basis'];
  /** "ageMin–ageMax", or null when the rule covers the activity's own ages. */
  ages: string | null;
  condition: string | null;
  /** Policy rules apply by stimulation profile; the others are listed on records. */
  policy: Stimulation[] | null;
  /** Non-retired activities that list the rule (0 for policy rules). */
  listedBy: number;
}

export interface TimingCoverage {
  activities: Record<Stimulation, number>;
  recipes: Record<Stimulation, number>;
  stops: TimingStop[];
  rules: TimingRuleSummary[];
  /** Activities listing a milk-feed or meal rule. */
  feedRules: { id: string; title: string; rules: string[] }[];
  /** Condition-limited (advisory) rules and the activities that list them. */
  advisory: { rule: string; cue: string; ages: string | null; condition: string; records: string[] }[];
  recipesByStimulation: Record<Stimulation, string[]>;
  /** Records marked `variable`: deliberately unresolved, explained in docs/research/timing.md. */
  unresolved: { id: string; title: string; kind: 'activity' | 'recipe'; reason: string }[];
}

export interface Coverage {
  stops: StopCoverage[];
  pairs: PairCoverage[];
  gaps: string[];
  thresholds: Record<string, number>;
  timing: TimingCoverage;
}

const THRESHOLDS = { total: 6, lowEffort: 2, indoors: 4, outdoors: 1, pairOptions: 2, settling: 2 };

const PAIR_SAMPLES: [EnteredAge, EnteredAge][] = [
  [{ value: 3, unit: 'w' }, { value: 24, unit: 'm' }],
  [{ value: 6, unit: 'w' }, { value: 36, unit: 'm' }],
  [{ value: 10, unit: 'w' }, { value: 20, unit: 'm' }],
  [{ value: 4, unit: 'm' }, { value: 28, unit: 'm' }],
  [{ value: 5, unit: 'm' }, { value: 42, unit: 'm' }],
  [{ value: 7, unit: 'm' }, { value: 30, unit: 'm' }],
  [{ value: 9, unit: 'm' }, { value: 48, unit: 'm' }],
  [{ value: 11, unit: 'm' }, { value: 26, unit: 'm' }],
  [{ value: 14, unit: 'm' }, { value: 38, unit: 'm' }],
  [{ value: 18, unit: 'm' }, { value: 40, unit: 'm' }],
  [{ value: 20, unit: 'm' }, { value: 54, unit: 'm' }],
  [{ value: 26, unit: 'm' }, { value: 50, unit: 'm' }],
  [{ value: 30, unit: 'm' }, { value: 58, unit: 'm' }],
  [{ value: 15, unit: 'm' }, { value: 16, unit: 'm' }],
  [{ value: 37, unit: 'm' }, { value: 37, unit: 'm' }],
];

export function buildCoverage(catalog: Catalog): Coverage {
  const live = catalog.activities.filter((a) => !a.retired);
  const recipes = catalog.recipes.filter((r) => !r.retired);
  const gaps: string[] = [];

  const stops: StopCoverage[] = AGE_STOPS.map((age) => {
    const d = toDays(age);
    const fit = live.filter((a) => activityFitsAge(a, d));
    const play = fit.filter((a) => a.kind !== 'media');
    const byIntent = Object.fromEntries(INTENTS.map((i) => [i, fit.filter((a) => a.intents.includes(i)).length])) as Record<Intent, number>;
    const row: StopCoverage = {
      age: formatAgeShort(age),
      days: d,
      total: fit.length,
      lowEffort: play.filter((a) => a.effort === 'low').length,
      busyNearby: play.filter(isBusyNearbyCompatible).length,
      indoors: fit.filter((a) => a.places.includes('indoors')).length,
      outdoors: fit.filter((a) => a.places.includes('outdoors')).length,
      noMaterials: fit.filter((a) => a.materials.level === 'none').length,
      media: fit.filter((a) => a.kind === 'media').length,
      byIntent,
    };
    if (row.total < THRESHOLDS.total) gaps.push(`${row.age}: only ${row.total} activities (want ${THRESHOLDS.total}+)`);
    if (row.lowEffort < THRESHOLDS.lowEffort) gaps.push(`${row.age}: only ${row.lowEffort} low-effort activities`);
    if (row.indoors < THRESHOLDS.indoors) gaps.push(`${row.age}: only ${row.indoors} indoor activities`);
    if (row.outdoors < THRESHOLDS.outdoors) gaps.push(`${row.age}: no outdoor activities`);
    return row;
  });

  const pairs: PairCoverage[] = PAIR_SAMPLES.map(([y, o]) => {
    const a = { days: toDays(y), notYet: [] };
    const b = { days: toDays(o), notYet: [] };
    const fit = recipes.filter((r) => recipeAssignment(r, a, b) !== null);
    const row = {
      younger: formatAgeShort(y),
      older: formatAgeShort(o),
      together: fit.filter((r) => r.mode === 'together').length,
      parallel: fit.filter((r) => r.mode === 'parallel').length,
    };
    if (row.together + row.parallel < THRESHOLDS.pairOptions) {
      gaps.push(`pair ${row.younger} + ${row.older}: only ${row.together + row.parallel} curated recipes`);
    }
    return row;
  });

  const timing = buildTimingCoverage(live, recipes, catalog.timingRules);
  gaps.push(...settlingGaps(timing.stops));

  return { stops, pairs, gaps, thresholds: THRESHOLDS, timing };
}

const countBy = <T>(items: readonly T[], stim: (x: T) => Stimulation) =>
  Object.fromEntries(STIMULATION.map((s) => [s, items.filter((x) => stim(x) === s).length])) as Record<Stimulation, number>;

function unresolvedReason(a: Activity): string {
  if (a.kind === 'media') return 'Screen: depends on the show';
  if (a.outing) return 'Outing: depends on the place or session';
  return 'Depends on how it is done';
}

function buildTimingCoverage(live: Activity[], recipes: MixedAgeRecipe[], rules: readonly TimingRule[]): TimingCoverage {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const ages = (r: TimingRule) => (r.ageMin && r.ageMax ? `${r.ageMin}–${r.ageMax}` : null);
  const stops: TimingStop[] = AGE_STOPS.map((age) => {
    const d = toDays(age);
    const fit = live.filter((a) => activityFitsAge(a, d));
    const n = countBy(fit, (a) => a.timing.stimulation);
    return { age: formatAgeShort(age), days: d, ...n };
  });
  const feedRules = live
    .map((a) => ({ id: a.id, title: a.title, rules: a.timing.rules.filter((id) => ['milk-feed', 'meal'].includes(ruleById.get(id)?.event ?? '')) }))
    .filter((x) => x.rules.length > 0);
  const advisory = rules
    .filter((r) => r.condition)
    .map((r) => ({
      rule: r.id,
      cue: r.cue,
      ages: ages(r),
      condition: r.condition!,
      records: live.filter((a) => a.timing.rules.includes(r.id)).map((a) => a.id),
    }));
  const recipesByStimulation = Object.fromEntries(
    STIMULATION.map((s) => [s, recipes.filter((r) => r.timing.stimulation === s).map((r) => r.id)]),
  ) as Record<Stimulation, string[]>;
  const unresolved = [
    ...live.filter((a) => a.timing.stimulation === 'variable').map((a) => ({ id: a.id, title: a.title, kind: 'activity' as const, reason: unresolvedReason(a) })),
    ...recipes.filter((r) => r.timing.stimulation === 'variable').map((r) => ({ id: r.id, title: r.title, kind: 'recipe' as const, reason: 'Shared space varies' })),
  ];
  return {
    activities: countBy(live, (a) => a.timing.stimulation),
    recipes: countBy(recipes, (r) => r.timing.stimulation),
    stops,
    rules: rules.map((r) => ({
      id: r.id,
      event: r.event,
      when: r.when,
      minutes: r.window.minutes,
      windowBasis: r.window.basis,
      fit: r.fit,
      basis: r.basis,
      ages: ages(r),
      condition: r.condition ?? null,
      policy: r.match ? [...r.match.stimulation] : null,
      listedBy: live.filter((a) => a.timing.rules.includes(r.id)).length,
    })),
    feedRules,
    advisory,
    recipesByStimulation,
    unresolved,
  };
}

/** One gap line per run of consecutive stops with the same too-low settling count. */
function settlingGaps(stops: TimingStop[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < stops.length) {
    const n = stops[i].settling;
    if (n >= THRESHOLDS.settling) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < stops.length && stops[j + 1].settling === n) j++;
    const where = i === j ? stops[i].age : `${stops[i].age} to ${stops[j].age}`;
    const what = n === 0 ? 'no settling (wind-down) activities' : `only ${n} settling (wind-down) ${n === 1 ? 'activity' : 'activities'}`;
    out.push(`${where}: ${what} (want ${THRESHOLDS.settling}+)`);
    i = j + 1;
  }
  return out;
}

export function coverageMarkdown(c: Coverage, counts: string, version: string): string {
  const lines: string[] = [];
  lines.push('# Content coverage report', '');
  lines.push(`Generated by \`npm run content\` (content version ${version}). ${counts}.`, '');
  lines.push(
    'Every age-slider stop is sampled (1–12 weeks weekly, then 3–59 months monthly). Counts are age-eligible, non-retired activities before any optional filter. "Busy nearby" counts activities a parent can supervise from the same room while doing a task such as cooking. Age ranges are never widened to fill gaps.',
    '',
  );
  lines.push(`Thresholds: ${Object.entries(c.thresholds).map(([k, v]) => `${k} ≥ ${v}`).join(', ')}.`, '');
  lines.push('## Gaps', '');
  lines.push(c.gaps.length ? c.gaps.map((g) => `- ${g}`).join('\n') : '- None at current thresholds.', '');
  lines.push('## Two-child pairs (curated recipes)', '');
  lines.push('| Younger | Older | Together | Parallel |', '|---|---|---|---|');
  for (const p of c.pairs) lines.push(`| ${p.younger} | ${p.older} | ${p.together} | ${p.parallel} |`);
  lines.push('', '## Every slider stop', '');
  lines.push('| Age | Days | Total | Low effort | Busy nearby | Indoors | Outdoors | No materials | Media | Move | Calm | Connect | Fresh air |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of c.stops) {
    lines.push(
      `| ${s.age} | ${s.days} | ${s.total} | ${s.lowEffort} | ${s.busyNearby} | ${s.indoors} | ${s.outdoors} | ${s.noMaterials} | ${s.media} | ${s.byIntent.move} | ${s.byIntent.calm} | ${s.byIntent.connect} | ${s.byIntent['fresh-air']} |`,
    );
  }
  lines.push('');
  lines.push(...timingMarkdown(c.timing));
  return lines.join('\n');
}

function timingMarkdown(t: TimingCoverage): string[] {
  const lines: string[] = [];
  const counts = (r: Record<Stimulation, number>) => STIMULATION.map((s) => `${s} ${r[s]}`).join(', ');
  lines.push('## Timing classification', '');
  lines.push(
    'Every activity and recipe has a reviewed stimulation profile (`settling`, `gentle`, `lively`, or `variable` = deliberately unresolved). Rules are agent-reviewed public guidance or Trunk conventions, not clinical review; method and per-record rationale are in `docs/research/timing.md`. A record with no rule for an event has no specific guidance; it is not "cleared".',
    '',
  );
  lines.push(`- Activities: ${counts(t.activities)}.`);
  lines.push(`- Recipes (shared space): ${counts(t.recipes)}.`, '');
  lines.push('### Timing rules', '');
  lines.push('| Rule | Event | When | Window | Fit | Ages | Condition | Basis | Applies to |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of t.rules) {
    const applies = r.policy ? `policy: ${r.policy.join(', ')}` : `${r.listedBy} listed`;
    lines.push(
      `| \`${r.id}\` | ${r.event} | ${r.when} | ${r.minutes} min (${r.windowBasis}) | ${r.fit} | ${r.ages ?? 'activity ages'} | ${r.condition ? `${r.condition} (advisory)` : '—'} | ${r.basis} | ${applies} |`,
    );
  }
  lines.push('', '### Records with feed rules', '');
  lines.push(t.feedRules.length ? t.feedRules.map((x) => `- \`${x.id}\` (${x.title}): ${x.rules.map((r) => `\`${r}\``).join(', ')}`).join('\n') : '- None.', '');
  lines.push('### Advisory (condition-limited) rules', '');
  lines.push(
    t.advisory.length
      ? t.advisory.map((a) => `- \`${a.rule}\` (${a.condition}; ${a.ages ?? 'activity ages'}; "${a.cue}"): ${a.records.length} records: ${a.records.map((r) => `\`${r}\``).join(', ')}`).join('\n')
      : '- None.',
    '',
  );
  lines.push('### Recipes by shared stimulation', '');
  for (const s of STIMULATION) {
    const ids = t.recipesByStimulation[s];
    lines.push(`- ${s} (${ids.length}): ${ids.length ? ids.map((id) => `\`${id}\``).join(', ') : 'none'}`);
  }
  lines.push('', '### Unresolved (`variable`) records', '');
  lines.push(t.unresolved.length ? t.unresolved.map((u) => `- \`${u.id}\` (${u.title}): ${u.reason}`).join('\n') : '- None.', '');
  lines.push('### Stimulation at every slider stop', '');
  lines.push(`Settling options are what the planner can offer for winding down before a known nap; a stop with fewer than ${THRESHOLDS.settling} is listed under Gaps.`, '');
  lines.push('| Age | Settling | Gentle | Lively | Variable |', '|---|---|---|---|---|');
  for (const s of t.stops) lines.push(`| ${s.age} | ${s.settling} | ${s.gentle} | ${s.lively} | ${s.variable} |`);
  lines.push('');
  return lines;
}
