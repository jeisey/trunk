/** Finder preferences remembered in this browser (ages and filters only; never names or dates). */
import * as z from 'zod/mini';
import { ABILITIES, GOALS } from './content/vocab.ts';
import { DEFAULT_FILTERS, type Filters } from './lib/filters.ts';
import type { ChildState } from './components/AgeControl.tsx';

const PREFS_KEY = 'trunk.prefs';

const int = (min: number, max: number) => z.number().check(z.int(), z.minimum(min), z.maximum(max));

const PrefsSchema = z.object({
  v: z.literal(1),
  kids: z
    .array(
      z.object({
        age: z.object({ value: int(1, 59), unit: z.enum(['w', 'm']) }),
        notYet: z._default(z.array(z.enum(ABILITIES)), []),
      }),
    )
    .check(z.minLength(1), z.maxLength(2)),
  filters: z.object({
    minutes: z.nullable(int(5, 240)),
    energy: z.enum(['busy', 'low', 'some', 'plenty']),
    place: z.enum(['any', 'indoors', 'outdoors']),
    mode: z.enum(['either', 'together', 'parallel']),
    focus: z.union([z.literal('both'), z.literal(0), z.literal(1)]),
    adults: z.union([z.literal(1), z.literal(2)]),
    lowPrep: z.boolean(),
    goals: z.array(z.enum(GOALS)),
    materials: z.enum(['any', 'household', 'none']),
    mess: z.enum(['any', 'low']),
    quiet: z.boolean(),
  }),
});

export interface Prefs {
  kids: ChildState[];
  filters: Filters;
}

export const DEFAULT_PREFS: Prefs = {
  kids: [{ age: { value: 6, unit: 'm' }, notYet: [] }],
  filters: DEFAULT_FILTERS,
};

export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = PrefsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_PREFS;
    return { kids: parsed.data.kids, filters: { ...DEFAULT_FILTERS, ...parsed.data.filters } };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 1, ...prefs }));
  } catch {
    /* Preferences are a convenience; failing to store them is harmless. */
  }
}
