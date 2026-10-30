/**
 * Validate every content file and build the bundled catalog + coverage report.
 *
 *   node scripts/build-catalog.ts            validate, write src/generated/catalog.json and reports/
 *   node scripts/build-catalog.ts --check    validate only (exit 1 on errors)
 *   node scripts/build-catalog.ts --check --only content/workstreams/a.json
 *        validate everything for references, but only report errors for one file
 *        (used by parallel content writers so another file's draft doesn't block them)
 *   node scripts/build-catalog.ts --check --dir tests/fixtures/valid
 *        validate a different directory of content files
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { ContentFile, SCHEMA_VERSION } from '../src/content/schema.ts';
import { parseFile, validateCatalog, type Issue } from '../src/content/validate.ts';
import { buildCoverage, coverageMarkdown } from '../src/content/coverage.ts';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? resolve(args[onlyIdx + 1]) : null;
const dirIdx = args.indexOf('--dir');
const root = process.cwd();
const contentDirs = dirIdx >= 0 ? [resolve(args[dirIdx + 1])] : [join(root, 'content'), join(root, 'content', 'workstreams')];

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

const files = contentDirs.flatMap(listJson);
if (only && !existsSync(only)) {
  console.error(`Content validation FAILED: ${relative(root, only)} does not exist.`);
  process.exit(1);
}
const parsed: { file: string; data: z.infer<typeof ContentFile> }[] = [];
const parseErrors: Issue[] = [];
for (const path of files) {
  const rel = relative(root, path);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    parseErrors.push({ file: rel, message: `invalid JSON: ${(e as Error).message}` });
    continue;
  }
  const result = parseFile(rel, raw);
  if (result.data) parsed.push({ file: rel, data: result.data });
  parseErrors.push(...result.errors);
}

const { catalog, errors, warnings } = validateCatalog(parsed);
const allErrors = [...parseErrors, ...errors];
const onlyRel = only ? relative(root, only) : null;
const shown = onlyRel ? allErrors.filter((e) => e.file === onlyRel) : allErrors;
const hidden = allErrors.length - shown.length;

const fmt = (i: Issue) => `  ${i.file}${i.id ? ` [${i.id}]` : ''}: ${i.message}`;
if (warnings.length) {
  const w = onlyRel ? warnings.filter((x) => x.file === onlyRel) : warnings;
  if (w.length) console.log(`Warnings (${w.length}):\n${w.map(fmt).join('\n')}`);
}
if (hidden) console.log(`(${hidden} error(s) in other files not shown because of --only)`);

const counts = `${catalog.activities.length} activities, ${catalog.recipes.length} recipes, ${catalog.starterPlans.length} starter plans, ${catalog.timingRules.length} timing rules, ${catalog.claims.length} claims, ${catalog.sources.length} sources from ${files.length} file(s)`;

if (shown.length) {
  console.error(`Content validation FAILED with ${shown.length} error(s):\n${shown.map(fmt).join('\n')}`);
  process.exit(1);
}
console.log(`Content valid: ${counts}`);
if (checkOnly) process.exit(0);
if (allErrors.length) process.exit(1);

// ---- Write bundled catalog (retired records are kept so old share links resolve) ----
// Activities, recipes, and starter plans load with the app. Claims and sources
// (the evidence) are a separate file the app loads lazily, keeping initial JS small.
mkdirSync(join(root, 'src', 'generated'), { recursive: true });
// Deterministic: the content version is the latest source-check date, so rebuilding never churns files.
const contentVersion = catalog.sources.reduce((max, s) => (s.checked > max ? s.checked : max), '');
writeFileSync(
  join(root, 'src', 'generated', 'catalog.json'),
  JSON.stringify({
    schema: SCHEMA_VERSION,
    version: contentVersion,
    sourceCount: catalog.sources.length,
    timingRules: catalog.timingRules,
    activities: catalog.activities,
    recipes: catalog.recipes,
    starterPlans: catalog.starterPlans,
  }),
);
writeFileSync(join(root, 'src', 'generated', 'evidence.json'), JSON.stringify({ claims: catalog.claims, sources: catalog.sources }));

// ---- JSON Schema generated from the Zod authority ----
mkdirSync(join(root, 'docs', 'schema'), { recursive: true });
writeFileSync(
  join(root, 'docs', 'schema', 'content.schema.json'),
  JSON.stringify(z.toJSONSchema(ContentFile, { io: 'input', unrepresentable: 'any' }), null, 2) + '\n',
);

// ---- Coverage report ----
mkdirSync(join(root, 'reports'), { recursive: true });
const coverage = buildCoverage(catalog);
writeFileSync(join(root, 'reports', 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
writeFileSync(join(root, 'reports', 'coverage.md'), coverageMarkdown(coverage, counts, contentVersion));
console.log(`Wrote src/generated/catalog.json, docs/schema/content.schema.json, reports/coverage.{md,json}`);
if (coverage.gaps.length) console.log(`Coverage gaps (${coverage.gaps.length}): see reports/coverage.md`);
