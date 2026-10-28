/**
 * The single age-normalization utility for Trunk.
 *
 * Canonical unit: whole days since birth (integer).
 *
 * Conversions (documented in docs/decisions.md):
 *   1 week  = 7 days (exact)
 *   1 month = 365.25 / 12 = 30.4375 days (approximate), rounded to the nearest day
 *   1 year  = 12 months
 *
 * The same conversion is used for content age bounds AND for a child's entered
 * age, so "4 months" entered by a parent compares exactly against a "4m" bound.
 *
 * Content ranges are half-open: a child is age-eligible when
 *   minDays <= childDays < maxDays
 * so "3 to under 6 months" is written ageMin "3m", ageMax "6m".
 *
 * Age is only a starting filter. Readiness/abilities are modelled separately and
 * never inferred from age.
 */

export const DAYS_PER_MONTH = 365.25 / 12;

export type AgeUnit = 'w' | 'm' | 'y';

export interface EnteredAge {
  value: number;
  unit: AgeUnit;
}

export const AGE_STRING_PATTERN = /^(\d{1,3})(w|m|y)$/;

/** Youngest supported age: 1 week. */
export const MIN_SUPPORTED_DAYS = 7;
/** Supported ages end before the fifth birthday (60 months), exclusive. */
export const MAX_SUPPORTED_DAYS_EXCLUSIVE = monthsToDays(60);

export function monthsToDays(months: number): number {
  return Math.round(months * DAYS_PER_MONTH);
}

export function toDays(age: EnteredAge): number {
  switch (age.unit) {
    case 'w':
      return Math.round(age.value * 7);
    case 'm':
      return monthsToDays(age.value);
    case 'y':
      return monthsToDays(age.value * 12);
  }
}

/** Parse a content age string such as "1w", "3m", "2y". Returns null if malformed. */
export function parseAgeString(text: string): EnteredAge | null {
  const match = AGE_STRING_PATTERN.exec(text);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2] as AgeUnit };
}

export function ageStringToDays(text: string): number {
  const parsed = parseAgeString(text);
  if (!parsed) throw new Error(`Malformed age string: ${text}`);
  return toDays(parsed);
}

export function isAgeEligible(childDays: number, minDays: number, maxDaysExclusive: number): boolean {
  return childDays >= minDays && childDays < maxDaysExclusive;
}

export function isSupportedAge(days: number): boolean {
  return days >= MIN_SUPPORTED_DAYS && days < MAX_SUPPORTED_DAYS_EXCLUSIVE;
}

/**
 * Slider stops. Early infancy changes quickly, so the first 12 stops are weekly
 * (1–12 weeks); after that each stop is one month (3–59 months). This avoids a
 * uniform five-year track where newborn ages are impossible to select.
 */
export const AGE_STOPS: readonly EnteredAge[] = Object.freeze([
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, unit: 'w' as const })),
  ...Array.from({ length: 57 }, (_, i) => ({ value: i + 3, unit: 'm' as const })),
]);

/** Index of the stop nearest to (and not above) the given age; clamps to range. */
export function nearestStopIndex(age: EnteredAge): number {
  const days = toDays(age);
  let best = 0;
  for (let i = 0; i < AGE_STOPS.length; i++) {
    if (toDays(AGE_STOPS[i]) <= days) best = i;
  }
  return best;
}

/**
 * Normalize any entered age to a supported, display-friendly form:
 * weeks under 3 months, otherwise whole months. Clamps to 1 week – 59 months.
 */
export function normalizeEnteredAge(age: EnteredAge): EnteredAge {
  if (!Number.isFinite(age.value) || age.value < 0) return { value: 1, unit: 'w' };
  const days = toDays(age);
  if (days < MIN_SUPPORTED_DAYS) return { value: 1, unit: 'w' };
  if (days >= MAX_SUPPORTED_DAYS_EXCLUSIVE) return { value: 59, unit: 'm' };
  if (age.unit === 'w') {
    const weeks = Math.round(age.value);
    if (weeks <= 12) return { value: Math.max(1, weeks), unit: 'w' };
    return { value: Math.max(3, Math.floor(days / DAYS_PER_MONTH)), unit: 'm' };
  }
  const months = age.unit === 'y' ? age.value * 12 : age.value;
  const whole = Math.floor(months);
  if (whole < 3) {
    return { value: Math.min(12, Math.max(1, Math.round(days / 7))), unit: 'w' };
  }
  return { value: Math.min(59, whole), unit: 'm' };
}

export function formatAge(age: EnteredAge): string {
  if (age.unit === 'w') return `${age.value} ${age.value === 1 ? 'week' : 'weeks'}`;
  const months = age.unit === 'y' ? age.value * 12 : age.value;
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearText = `${years} ${years === 1 ? 'year' : 'years'}`;
  return rest === 0 ? yearText : `${yearText}, ${rest} ${rest === 1 ? 'month' : 'months'}`;
}

export function formatAgeShort(age: EnteredAge): string {
  if (age.unit === 'w') return `${age.value} wk`;
  const months = age.unit === 'y' ? age.value * 12 : age.value;
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

/** Human description of a content range, e.g. "3–5 months" style "3 months to under 6 months". */
export function formatAgeRange(minText: string, maxText: string): string {
  const min = parseAgeString(minText);
  const max = parseAgeString(maxText);
  if (!min || !max) return '';
  return `${formatAge(min)} to under ${formatAge(max)}`;
}
