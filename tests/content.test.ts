import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { days } from '../src/lib/eligibility.ts';
import { parseFile, validateCatalog } from '../src/content/validate.ts';
import { buildCoverage } from '../src/content/coverage.ts';
import { ageStringToDays } from '../src/lib/age.ts';
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
const timingRule = (f: Raw, i = 0) => (f.timingRules as Record<string, any>[])[i]; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    // ---- Timing (content schema v2) ----
    ['settling stimulation on a loud activity', (f: Raw) => {
      act(f, 1).noise = 'loud';
      act(f, 1).timing.stimulation = 'settling';
    }, /"settling" needs quiet noise/],
    ['settling stimulation on a messy activity', (f: Raw) => {
      act(f, 1).mess = 'medium';
      act(f, 1).timing.stimulation = 'settling';
    }, /"settling" needs quiet noise and little or no mess/],
    ['a loud activity marked gentle', (f: Raw) => {
      act(f, 1).noise = 'loud';
      act(f, 1).timing.stimulation = 'gentle';
    }, /loud or very messy activities must be "lively"/],
    ['a very messy activity marked gentle', (f: Raw) => {
      act(f, 1).mess = 'high';
      act(f, 1).timing.stimulation = 'gentle';
    }, /loud or very messy activities must be "lively"/],
    ['an unknown stimulation value', (f: Raw) => (act(f, 1).timing.stimulation = 'calm'), /Invalid option|expected one of/],
    ['an unknown timing rule id', (f: Raw) => (act(f, 1).timing.rules = ['tim.core.not-a-rule']), /unknown timing rule tim\.core\.not-a-rule/],
    ['a malformed timing rule id', (f: Raw) => (timingRule(f).id = 'tim.nap-soon'), /timing rule id must look like/],
    ['a timing rule listed twice', (f: Raw) => act(f).timing.rules.push('tim.core.fixture-tummy-after-feed'), /listed twice/],
    ['a policy (match) rule listed on a record', (f: Raw) => {
      (f.timingRules as unknown[]).push({ ...timingRule(f), id: 'tim.core.fixture-policy', fit: 'preferred', match: { stimulation: ['settling'] } });
      act(f, 1).timing.rules = ['tim.core.fixture-policy'];
    }, /is a policy rule \(it has match\)/],
    ['a source-based rule without claims', (f: Raw) => (timingRule(f).basis = 'source'), /source-based timing rule needs at least one claim/],
    ['a source window on an editorial rule', (f: Raw) => (timingRule(f).window.basis = 'source'), /source-based window needs a source-based rule/],
    ['a source-based blanket "avoid" policy', (f: Raw) => {
      (f.timingRules as unknown[]).push({ ...timingRule(f), id: 'tim.core.fixture-ban', basis: 'source', claims: ['clm.core.tummy-awake-supervised'], match: { stimulation: ['lively'] } });
    }, /policy \(match\) rule cannot be a source-based "avoid"/],
    ['a condition-limited rule that prefers', (f: Raw) => {
      timingRule(f).condition = 'spit-up';
      timingRule(f).fit = 'preferred';
    }, /condition-limited rule must be "avoid" or "later"/],
    ['a timing rule with only one age bound', (f: Raw) => (timingRule(f).ageMin = '1w'), /give both ageMin and ageMax/],
    ['tummy time without the before-feed rule', (f: Raw) => (act(f).timing.rules = ['tim.core.fixture-tummy-after-feed']), /"avoid" milk-feed rule for before a feed/],
    ['tummy time without the after-feed rule', (f: Raw) => (act(f).timing.rules = ['tim.core.fixture-tummy-before-feed']), /"avoid" milk-feed rule for after a feed/],
    ['tummy time whose feed rule is only advisory', (f: Raw) => (timingRule(f, 1).condition = 'spit-up'), /"avoid" milk-feed rule for before a feed/],
    ['a listed rule whose ages miss the activity', (f: Raw) => {
      timingRule(f).ageMin = '6m';
      timingRule(f).ageMax = '12m';
    }, /covers 6m–12m, which doesn't overlap this activity's ages/],
    ['an infant-only rule on a toddler activity', (f: Raw) => {
      (f.timingRules as unknown[]).push({ ...timingRule(f), id: 'tim.core.fixture-infant', fit: 'later', condition: 'spit-up', ageMin: '1w', ageMax: '12m' });
      act(f, 1).timing.rules = ['tim.core.fixture-infant'];
    }, /covers 1w–12m, which doesn't overlap/],
    ['a recipe without a timing profile', (f: Raw) => delete (f.recipes[0] as Record<string, unknown>).timing, /timing/],
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
    expect(coverage.timing.stops).toHaveLength(69);
  });

  describe('timing classification', () => {
    const { activities, recipes, timingRules } = result.catalog;
    const ruleById = new Map(timingRules.map((r) => [r.id, r]));
    const twelveMonths = ageStringToDays('12m');
    const SPIT_UP = 'tim.core.gentle-play-after-feed-spit-up';

    it('documents every deliberately unresolved (variable) record in the timing notes', () => {
      const doc = readFileSync(join(root, 'docs/research/timing.md'), 'utf8');
      const unresolved = doc.split(/^## Unresolved/m)[1]?.split(/^## /m)[0] ?? '';
      const variable = [...activities, ...recipes].filter((r) => r.timing.stimulation === 'variable').map((r) => r.id);
      for (const id of variable) expect(unresolved, id).toContain(id);
    });

    it('lists every activity and recipe in the timing notes', () => {
      const doc = readFileSync(join(root, 'docs/research/timing.md'), 'utf8');
      for (const r of [...activities, ...recipes]) expect(doc, r.id).toContain(`\`${r.id}\``);
    });

    it('gives every tummy-time record the HSE feed rules and the AAP spit-up advisory', () => {
      for (const a of activities.filter((x) => x.tummyTime)) {
        expect(a.timing.rules, a.id).toEqual(expect.arrayContaining(['tim.core.tummy-after-milk-feed', 'tim.core.tummy-before-milk-feed', SPIT_UP]));
      }
    });

    it('keeps condition-limited rules advisory, infant-only, and off toddler and preschool records', () => {
      const conditional = timingRules.filter((r) => r.condition);
      expect(conditional.map((r) => r.id)).toContain(SPIT_UP);
      for (const r of conditional) {
        expect(r.match, r.id).toBeUndefined();
        expect(['later', 'avoid'], r.id).toContain(r.fit);
        expect(r.ageMax && ageStringToDays(r.ageMax) <= twelveMonths, r.id).toBe(true);
      }
      for (const a of activities) {
        if (a.timing.rules.some((id) => ruleById.get(id)?.condition)) {
          expect(ageStringToDays(a.ageMin) < twelveMonths, a.id).toBe(true);
        }
      }
    });

    it('keeps nap guidance editorial: no source-based nap rule or window', () => {
      for (const r of timingRules.filter((x) => x.event === 'nap')) {
        expect(r.basis, r.id).toBe('editorial');
        expect(r.window.basis, r.id).toBe('editorial');
        expect(r.fit, r.id).not.toBe('avoid');
      }
    });

    it('keeps meal rules sourced, or cautious, baby-only, and labelled as Trunk’s convention', () => {
      for (const r of timingRules.filter((x) => x.event === 'meal')) {
        expect(r.claims.length, r.id).toBeGreaterThan(0);
        if (r.basis === 'editorial') {
          // Only a cautious extension of feed advice for babies (tummy time and eating), never a rule for older children.
          expect(r.ageMax && days(r.ageMax), r.id).toBeLessThanOrEqual(days('12m'));
          expect(r.fit, r.id).toBe('avoid');
          expect(r.reason, r.id).toMatch(/Trunk/);
        }
      }
    });

    it('never tells parents to keep a child awake, delay a feed, or follow a schedule', () => {
      const banned = /keep (them|your (baby|child|toddler)) awake|(delay|postpone|wait for|hold off) (the |a |your )?(feed|meal)|wake window|schedule|promotes? sleep|helps? (them|your (baby|child)) (to )?(fall )?sleep|safe after feeding/i;
      for (const r of timingRules) {
        expect(`${r.cue} ${r.reason}`, r.id).not.toMatch(banned);
      }
    });
  });
});
