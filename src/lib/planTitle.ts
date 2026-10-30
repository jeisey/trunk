/**
 * A default plan title from what the plan already holds: part of day, length,
 * and the children's approximate ages, e.g. "Afternoon · 90 min · 4 mo + 2 yr".
 * No names and no dates, so it is safe in saved lists and shares.
 */
import { formatAgeShort } from './age.ts';
import type { Plan } from './plan.ts';
import { formatMinutes, parseHHMM } from './time.ts';

export function partOfDay(clock: number): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
  const m = ((clock % 1440) + 1440) % 1440;
  if (m >= 5 * 60 && m < 12 * 60) return 'Morning';
  if (m >= 12 * 60 && m < 17 * 60) return 'Afternoon';
  if (m >= 17 * 60 && m < 21 * 60) return 'Evening';
  return 'Night';
}

export function defaultPlanTitle(plan: Pick<Plan, 'kids' | 'start' | 'window'>): string {
  let when = '';
  try {
    when = partOfDay(parseHHMM(plan.start));
  } catch {
    when = '';
  }
  const length = plan.window <= 90 ? `${plan.window} min` : formatMinutes(plan.window);
  const ages = plan.kids.map((k) => formatAgeShort(k.age)).join(' + ');
  return [when, length, ages].filter(Boolean).join(' · ');
}
