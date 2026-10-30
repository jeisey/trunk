/** Finder state → plan inputs (kept tiny: the Find page needs it before the planner chunk loads). */
import { normalizeEnteredAge } from '../lib/age.ts';
import type { Filters } from '../lib/filters.ts';
import type { PlanKid, PlanSettings } from '../lib/plan.ts';
import type { ChildState } from './AgeControl.tsx';

export function kidsToPlanKids(kids: ChildState[]): PlanKid[] {
  return kids.map((k) => {
    const age = normalizeEnteredAge(k.age);
    return { age: { value: age.value, unit: age.unit === 'w' ? 'w' : 'm' }, notYet: [...k.notYet] };
  });
}

export function settingsFromFilters(f: Filters): PlanSettings {
  return { energy: f.energy, place: f.place, mode: f.mode, adults: f.adults };
}
