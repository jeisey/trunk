import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFile, validateCatalog } from '../src/content/validate.ts';
import { buildCoverage } from '../src/content/coverage.ts';
import { rawFixture, root } from './helpers.ts';

type Raw = ReturnType<typeof rawFixture>;

function check(mutate: (f: Raw) => void) {
  const f = rawFixture();
  mutate(f);
  const parsed = parseFile('fixture', f);
  if (!parsed.data) return parsed.errors.map((e) => e.message).join('\n');
  return validateCatalog([{ file: 'fixture', data: parsed.data }]).errors.map((e) => e.message).join('\n');
}

const act = (f: Raw, i = 0) => f.activities[i] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('content fixtures', () => {
  it('the valid fixture passes with no errors', () => {
    expect(check(() => {})).toBe('');
  });

  it.each([
    ['unknown field', (f: Raw) => (act(f).colour = 'blue'), /Unrecognized key/],
    ['malformed id', (f: Raw) => (act(f).id = 'Act Tummy'), /activity id/],
    ['duplicate id', (f: Raw) => (act(f, 1).id = act(f, 0).id), /duplicate id/],
    ['dangling claim', (f: Raw) => (act(f).evidence.claims = ['clm.core.not-real']), /unknown claim/],
    ['dangling source', (f: Raw) => ((f.claims[0] as any).sources = ['src.nope.nothing']), /unknown source/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['dangling recipe activity', (f: Raw) => ((f.recipes[0] as any).older.activity = 'act.missing'), /unknown activity/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['malformed age', (f: Raw) => (act(f).ageMin = '3mo'), /age must look like/],
    ['inverted ages', (f: Raw) => ((act(f).ageMin = '2m'), (act(f).ageMax = '1m')), /must be below maximum/],
    ['age past fifth birthday', (f: Raw) => (act(f, 1).ageMax = '61m'), /past the fifth birthday/],
    ['age under one week', (f: Raw) => (act(f).ageMin = '0w'), /below 1 week/],
    ['impossible duration', (f: Raw) => (act(f).duration = { min: 10, default: 5, max: 20 }), /min <= default <= max/],
    ['unsupported enum', (f: Raw) => (act(f).effort = 'exhausting'), /Invalid option|expected one of/],
    ['too many steps', (f: Raw) => (act(f).steps = ['a step', 'b step', 'c step', 'd step', 'e step']), /Too big|at most/],
    ['http source', (f: Raw) => ((f.sources[0] as any).url = 'http://example.org/page'), /url|URL/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['described without claims', (f: Raw) => ((act(f).evidence.claims = []), (act(f).why = undefined)), /needs at least one claim/],
    ['goals without provenance', (f: Raw) => {
      const a = act(f, 1);
      a.evidence = { type: 'practical', claims: [] };
      delete a.why;
    }, /developmental goals need/],
    ['serious hazard without a sourced safety note', (f: Raw) => (act(f, 1).hazards = ['falls']), /need a safety note citing a safety claim/],
    ['shareable water play', (f: Raw) => (act(f).hazards = ['water', 'suffocation']), /water activities must not be shareable/],
    ['water as a parent moment', (f: Raw) => {
      const a = act(f);
      a.hazards = ['water'];
      a.supervision.shareable = false;
      a.intents = ['parent-moment'];
    }, /never be a parent-moment/],
    ['small parts under three', (f: Raw) => (act(f, 1).hazards = ['small-parts']), /small-parts hazards are not allowed/],
    ['banned material', (f: Raw) => (act(f, 1).materials.items = ['A bag of water beads']), /water beads/],
    ['balloons', (f: Raw) => (act(f, 1).steps = ['Blow up a balloon and bat it around.', 'Keep going.']), /balloons/],
    ['button batteries', (f: Raw) => (act(f, 1).materials.items = ['Toy with a loose button battery']), /batter/],
    ['magnets', (f: Raw) => (act(f, 1).materials.items = ['Fridge magnets']), /magnets/],
    ['rough handling of a baby', (f: Raw) => (act(f).steps = ['Gently bounce your baby on your knee.', 'Smile.']), /bouncing/],
    ['snack without readiness', (f: Raw) => {
      const a = act(f, 1);
      a.hazards = ['food'];
      a.safety = [{ text: 'Seated and supervised.', claims: ['clm.core.tummy-awake-supervised'] }];
    }, /eats-solids/],
    ['media too young', (f: Raw) => {
      const a = act(f, 1);
      a.kind = 'media';
      a.ageMin = '12m';
      a.goals = [];
    }, /media activities cannot start before 18 months/],
    ['elevated tummy time credited as flat', (f: Raw) => (act(f).tummyTime = { position: 'chest', flatSurface: true }), /only floor tummy time/],
    ['parallel recipe one adult cannot supervise', (f: Raw) => {
      const b = act(f, 1);
      b.supervision = { ...b.supervision, proximity: 'arms-reach', participation: 'leads' };
    }, /not feasible for one adult/],
    ['recipe role outside activity ages', (f: Raw) => ((f.recipes[0] as any).older.ageMin = '6m'), /must sit inside/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['recipe longer than an activity allows', (f: Raw) => ((f.recipes[0] as any).duration = { min: 2, default: 10, max: 30 }), /exceeds what both activities support/], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['future check date', (f: Raw) => (act(f).checked = '2999-01-01'), /in the future/],
    ['a second child added through an adaptation', (f: Raw) => (act(f, 1).adaptations = ['Baby nearby: give the baby a book too.']), /adds a second child/],
    ['a serious hazard whose first safety note is unsourced', (f: Raw) => act(f).safety.unshift({ text: 'Have fun.', claims: [] }), /first safety note must cite a safety claim/],
  ])('rejects %s', (_name, mutate, pattern) => {
    expect(check(mutate as (f: Raw) => void)).toMatch(pattern);
  });

  it('rejects the invalid fixture files on disk', () => {
    const dir = join(root, 'tests/fixtures/invalid');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const parsed = parseFile(file, raw);
      const errors = parsed.data ? validateCatalog([{ file, data: parsed.data }]).errors : parsed.errors;
      expect(errors.length, file).toBeGreaterThan(0);
    }
  });
});

describe('the bundled catalog', () => {
  const dirs = [join(root, 'content'), join(root, 'content/workstreams')];
  const files = dirs.flatMap((d) => {
    try {
      return readdirSync(d)
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(d, f));
    } catch {
      return [];
    }
  });
  const parseErrors: string[] = [];
  const parsed = files.flatMap((file) => {
    const r = parseFile(file, JSON.parse(readFileSync(file, 'utf8')));
    parseErrors.push(...r.errors.map((e) => `${file} ${e.id ?? ''}: ${e.message}`));
    return r.data ? [{ file, data: r.data }] : [];
  });
  const result = validateCatalog(parsed);

  it('validates with zero errors', () => {
    expect(parseErrors).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('has unique source URLs and only HTTPS sources', () => {
    const urls = result.catalog.sources.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => u.startsWith('https://'))).toBe(true);
  });

  it('keeps tummy-time position explicit and only floor is flat', () => {
    for (const a of result.catalog.activities.filter((x) => x.tummyTime)) {
      expect(a.tummyTime!.flatSurface, a.id).toBe(a.tummyTime!.position === 'floor');
    }
  });

  it('produces a coverage report for every slider stop', () => {
    const coverage = buildCoverage(result.catalog);
    expect(coverage.stops).toHaveLength(69);
  });
});
