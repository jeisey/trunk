/**
 * Time-of-day rules shared by the planner (which avoids violations) and the
 * plan editor (which flags them in edited, starter, and imported plans).
 *
 * - AAP (2026): keep babies under 6 months out of direct and indirect sun and
 *   avoid being outside 10 a.m.–4 p.m.
 * - Outdoor-only ideas aren't scheduled between 8 p.m. and 6 a.m.
 *
 * A whole segment is checked, not just its start.
 */
import type { Activity, MixedAgeRecipe } from '../content/schema.ts';
import type { PlaceFilter } from './filters.ts';
import { monthsToDays } from './age.ts';

export const MIDDAY_SUN = { from: 10 * 60, to: 16 * 60 };
export const NIGHT = { from: 20 * 60, to: 6 * 60 };

export interface OutdoorProfile {
  /** Can only happen outdoors. */
  outdoorOnly: boolean;
  /** Can happen outdoors. */
  outdoors: boolean;
  /** Carries a sun/weather hazard. */
  sunHazard: boolean;
}

export function activityProfile(a: Pick<Activity, 'places' | 'hazards'>): OutdoorProfile {
  return {
    outdoorOnly: !a.places.includes('indoors'),
    outdoors: a.places.includes('outdoors'),
    sunHazard: a.hazards.includes('sun-weather'),
  };
}

export function recipeProfile(r: Pick<MixedAgeRecipe, 'places'>, younger?: Pick<Activity, 'hazards'>): OutdoorProfile {
  return {
    outdoorOnly: !r.places.includes('indoors'),
    outdoors: r.places.includes('outdoors'),
    sunHazard: Boolean(younger?.hazards.includes('sun-weather')),
  };
}

function inWindow(clock: number, from: number, to: number): boolean {
  return from < to ? clock >= from && clock < to : clock >= from || clock < to;
}

/** Does [start, start + minutes) touch the window? Checked minute by minute (segments are ≤ 4 hours). */
export function overlaps(start: number, minutes: number, window: { from: number; to: number }): boolean {
  for (let m = 0; m < Math.max(1, minutes); m++) {
    if (inWindow((start + m) % 1440, window.from, window.to)) return true;
  }
  return false;
}

export type TimeIssue = 'sun' | 'night';

export function timeIssue(p: OutdoorProfile, start: number, minutes: number, youngestDays: number, place: PlaceFilter): TimeIssue | null {
  const outdoorsHere = p.outdoorOnly || (place === 'outdoors' && p.outdoors);
  if (youngestDays < monthsToDays(6) && (outdoorsHere || (p.sunHazard && p.outdoors && place !== 'indoors')) && overlaps(start, minutes, MIDDAY_SUN)) {
    return 'sun';
  }
  if (outdoorsHere && overlaps(start, minutes, NIGHT)) return 'night';
  return null;
}

export const TIME_ISSUE_TEXT: Record<TimeIssue, string> = {
  sun: 'Outdoors between 10 a.m. and 4 p.m.: AAP advises keeping babies under 6 months out of direct and indirect sun. Move it earlier or later, or do it indoors.',
  night: 'Outdoors after dark: consider moving this to daytime.',
};
