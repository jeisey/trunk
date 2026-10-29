/**
 * Before/after view of the planner on a small, explicit scenario.
 *
 *   node scripts/planner-sequence.ts            write reports/planner-sequence.md
 *
 * Reads tests/fixtures/planner/feed-nap.json (fixture-style records with explicit
 * stimulation, plus the parent's blocks), runs planWindow with timing off and on,
 * and lists each sequence with clock times and the rule each choice satisfied.
 * tests/timing-planner.test.ts asserts the same rules for every seed.
 *
 * The catalog is built from the fixture with validateCatalog (not from
 * src/content/catalog.ts, which imports the generated JSON bundle).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IndexedCatalog } from '../src/content/catalog.ts';
import { parseFile, validateCatalog, type Catalog } from '../src/content/validate.ts';
import { analyzePlan, segmentName, type PlanAnalysis } from '../src/lib/layout.ts';
import { PLAN_VERSION, type Plan, type PlanKid, type PlanSegment, type PlanSettings } from '../src/lib/plan.ts';
import { planWindow } from '../src/lib/planner.ts';
import { sequenceNote } from '../src/lib/sequence.ts';
import { formatClock, parseHHMM } from '../src/lib/time.ts';

const root = join(import.meta.dirname, '..');
const fixturePath = join(root, 'tests/fixtures/planner/feed-nap.json');

interface Scenario {
  description: string;
  kids: PlanKid[];
  settings: PlanSettings;
  start: string;
  window: number;
  keep: PlanSegment[];
  seeds: number[];
  reportSeed: number;
}

function indexCatalog(c: Catalog): IndexedCatalog {
  return {
    ...c,
    activityById: new Map(c.activities.map((a) => [a.id, a])),
    recipeById: new Map(c.recipes.map((r) => [r.id, r])),
    claimById: new Map(c.claims.map((x) => [x.id, x])),
    sourceById: new Map(c.sources.map((s) => [s.id, s])),
    planById: new Map(c.starterPlans.map((p) => [p.id, p])),
    timingRuleById: new Map(c.timingRules.map((t) => [t.id, t])),
  };
}

export function loadScenario(): { scenario: Scenario; c: IndexedCatalog } {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as { scenario: Scenario; content: unknown };
  const parsed = parseFile('feed-nap.json', raw.content);
  if (!parsed.data) throw new Error(parsed.errors.map((e) => e.message).join('\n'));
  const v = validateCatalog([{ file: 'feed-nap.json', data: parsed.data }]);
  if (v.errors.length) throw new Error(v.errors.map((e) => `${e.id}: ${e.message}`).join('\n'));
  return { scenario: raw.scenario, c: indexCatalog(v.catalog) };
}

function planFor(s: Scenario, segments: PlanSegment[]): Plan {
  const stamp = '2026-10-29T09:00:00.000Z';
  return { v: PLAN_VERSION, id: 'p-feed-nap', title: '', kids: s.kids, start: s.start, window: s.window, settings: s.settings, segments, notes: '', createdAt: stamp, updatedAt: stamp };
}

/** Why an entry is where it is, in the words of the rule it satisfies (or breaks). */
function explain(plan: Plan, a: PlanAnalysis, i: number, c: IndexedCatalog): string {
  const e = a.entries[i];
  const seg = e.item.segment;
  if (seg.kind === 'routine') return 'Your block, kept at its time';
  if (seg.kind === 'break') return 'Flexible break at the age cadence';
  const parts: string[] = [];
  if (e.timing.avoid && e.timing.cue) parts.push(`breaks a rule: “${e.timing.cue.text}”`);
  else if (e.timing.cue) parts.push(`${e.timing.cue.tone === 'good' ? 'fits' : 'caution'}: “${e.timing.cue.text}”`);
  const note = sequenceNote(plan, a, i, c);
  if (note && note !== e.timing.cue?.text) parts.push(note);
  const act = seg.kind === 'activity' ? c.activityById.get(seg.ref ?? '') : undefined;
  if (act?.tummyTime && !e.timing.avoid) parts.push('outside the feed windows (30 min after, 15 min before)');
  if (!parts.length) parts.push('variety: different from the idea before it');
  return parts.join('; ');
}

function table(plan: Plan, a: PlanAnalysis, c: IndexedCatalog): string {
  const clock = parseHHMM(plan.start);
  const rows = a.entries.map((e, i) => {
    const s = e.item.segment;
    const stim = s.kind === 'activity' ? (c.activityById.get(s.ref ?? '')?.timing.stimulation ?? '') : s.kind === 'routine' ? '—' : '';
    return `| ${formatClock(clock + e.item.start)}–${formatClock(clock + e.item.end)} | ${segmentName(s, c)} | ${stim} | ${explain(plan, a, i, c)} |`;
  });
  return ['| Time | Entry | Stimulation | Rule it satisfied |', '|---|---|---|---|', ...rows].join('\n');
}

/** Rule checks the test also makes: avoided entries, tummy after the feed, the idea before the nap, the first idea after it. */
export function checkRules(plan: Plan, a: PlanAnalysis, c: IndexedCatalog): string[] {
  const problems: string[] = [];
  const play = a.entries.filter((e) => e.item.segment.kind === 'activity');
  const stim = (e: (typeof play)[number]) => c.activityById.get(e.item.segment.ref ?? '')?.timing.stimulation;
  for (const e of play) if (e.timing.avoid) problems.push(`${segmentName(e.item.segment, c)} at +${e.item.start} min: ${e.timing.cue?.text}`);
  const nap = a.entries.find((e) => e.item.segment.routine === 'nap')?.item;
  if (nap) {
    const before = play.filter((e) => e.item.end <= nap.start).at(-1);
    if (before && nap.start - before.item.end <= 30 && stim(before) === 'lively') problems.push(`lively ${segmentName(before.item.segment, c)} right before the nap`);
    const after = play.find((e) => e.item.start >= nap.end);
    if (after && after.item.start - nap.end <= 20 && stim(after) === 'lively') problems.push(`lively ${segmentName(after.item.segment, c)} right after waking`);
  }
  return problems;
}

function run(): string {
  const { scenario: s, c } = loadScenario();
  const out: string[] = [];
  out.push('# Planner sequence: feed and nap (before/after)', '');
  out.push(`Generated by \`node scripts/planner-sequence.ts\` from \`tests/fixtures/planner/feed-nap.json\`. ${s.description}`, '');
  out.push(`Window: ${s.window} min from ${s.start}. Blocks the parent placed: milk feed at +0 (20 min), nap at +90 (45 min, 10 min settling). Seed ${s.reportSeed} is shown; the rule check below covers seeds ${s.seeds[0]}–${s.seeds[s.seeds.length - 1]}.`, '');
  const summary: string[] = [];
  for (const timing of [false, true]) {
    const r = planWindow(c, { kids: s.kids, settings: s.settings, window: s.window, start: s.start, seed: s.reportSeed, keep: s.keep, timing });
    const plan = planFor(s, r.segments);
    const a = analyzePlan(plan, c);
    out.push(`## ${timing ? 'Timing-aware (timing: true)' : 'Timing-unaware (timing: false)'}`, '');
    out.push(table(plan, a, c), '');
    out.push(`Open time: ${r.open} min.`, '');
    if (r.notes.length) out.push(...r.notes.map((n) => `- ${n}`), '');
    let broken = 0;
    const examples: string[] = [];
    for (const seed of s.seeds) {
      const rs = planWindow(c, { kids: s.kids, settings: s.settings, window: s.window, start: s.start, seed, keep: s.keep, timing });
      const ps = planFor(s, rs.segments);
      const problems = checkRules(ps, analyzePlan(ps, c), c);
      if (problems.length) {
        broken++;
        examples.push(`seed ${seed}: ${problems.join('; ')}`);
      }
    }
    summary.push(`| ${timing ? 'timing: true' : 'timing: false'} | ${s.seeds.length - broken} of ${s.seeds.length} | ${examples.slice(0, 3).join('<br>') || '—'} |`);
  }
  out.push('## Rule check across seeds', '');
  out.push('Rules: no applicable "avoid" (tummy time out of the 30 min after and 15 min before a feed), nothing lively in the 30 min before the nap, nothing lively first thing after waking.', '');
  out.push('| Mode | Seeds that follow every rule | Examples of what broke |', '|---|---|---|', ...summary, '');
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const md = run();
  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(join(root, 'reports/planner-sequence.md'), md);
  console.log(md);
}
