import { describe, expect, it } from 'vitest';
import {
  AGE_STOPS,
  ageStringToDays,
  formatAge,
  isAgeEligible,
  isSupportedAge,
  MAX_SUPPORTED_DAYS_EXCLUSIVE,
  MIN_SUPPORTED_DAYS,
  monthsToDays,
  nearestStopIndex,
  normalizeEnteredAge,
  parseAgeString,
  toDays,
} from '../src/lib/age.ts';

describe('age normalization', () => {
  it('converts units with the documented month length', () => {
    expect(toDays({ value: 1, unit: 'w' })).toBe(7);
    expect(toDays({ value: 3, unit: 'm' })).toBe(91);
    expect(toDays({ value: 4, unit: 'm' })).toBe(122);
    expect(toDays({ value: 6, unit: 'm' })).toBe(183);
    expect(toDays({ value: 12, unit: 'm' })).toBe(365);
    expect(toDays({ value: 2, unit: 'y' })).toBe(toDays({ value: 24, unit: 'm' }));
    expect(monthsToDays(60)).toBe(1826);
  });

  it('parses content age strings and rejects malformed ones', () => {
    expect(parseAgeString('3m')).toEqual({ value: 3, unit: 'm' });
    expect(parseAgeString('1w')).toEqual({ value: 1, unit: 'w' });
    expect(parseAgeString('2y')).toEqual({ value: 2, unit: 'y' });
    for (const bad of ['3', 'm3', '3 m', '3mo', '-1m', '1.5m', '']) expect(parseAgeString(bad)).toBeNull();
    expect(() => ageStringToDays('soon')).toThrow();
  });

  it('uses half-open ranges so adjacent bands never overlap or leave gaps', () => {
    const three = ageStringToDays('3m');
    const six = ageStringToDays('6m');
    expect(isAgeEligible(three - 1, three, six)).toBe(false);
    expect(isAgeEligible(three, three, six)).toBe(true);
    expect(isAgeEligible(six - 1, three, six)).toBe(true);
    expect(isAgeEligible(six, three, six)).toBe(false);
    // The next band starts exactly where this one ends.
    expect(isAgeEligible(six, six, ageStringToDays('12m'))).toBe(true);
  });

  it('a parent-entered "4 months" matches a 4m bound exactly', () => {
    expect(toDays({ value: 4, unit: 'm' })).toBe(ageStringToDays('4m'));
    expect(isAgeEligible(toDays({ value: 4, unit: 'm' }), ageStringToDays('4m'), ageStringToDays('6m'))).toBe(true);
    expect(isAgeEligible(toDays({ value: 4, unit: 'm' }), ageStringToDays('1w'), ageStringToDays('4m'))).toBe(false);
  });

  it('supports 1 week through the day before the fifth birthday', () => {
    expect(isSupportedAge(MIN_SUPPORTED_DAYS)).toBe(true);
    expect(isSupportedAge(MIN_SUPPORTED_DAYS - 1)).toBe(false);
    expect(isSupportedAge(MAX_SUPPORTED_DAYS_EXCLUSIVE - 1)).toBe(true);
    expect(isSupportedAge(MAX_SUPPORTED_DAYS_EXCLUSIVE)).toBe(false);
  });
});

describe('slider stops', () => {
  it('are weekly for 1–12 weeks, then monthly to 59 months, strictly increasing', () => {
    expect(AGE_STOPS).toHaveLength(69);
    expect(AGE_STOPS[0]).toEqual({ value: 1, unit: 'w' });
    expect(AGE_STOPS[11]).toEqual({ value: 12, unit: 'w' });
    expect(AGE_STOPS[12]).toEqual({ value: 3, unit: 'm' });
    expect(AGE_STOPS[68]).toEqual({ value: 59, unit: 'm' });
    for (let i = 1; i < AGE_STOPS.length; i++) expect(toDays(AGE_STOPS[i])).toBeGreaterThan(toDays(AGE_STOPS[i - 1]));
    expect(AGE_STOPS.every((s) => isSupportedAge(toDays(s)))).toBe(true);
  });

  it('round-trips every stop through nearestStopIndex', () => {
    AGE_STOPS.forEach((s, i) => expect(nearestStopIndex(s)).toBe(i));
  });
});

describe('typed age normalization', () => {
  it('keeps weeks under 3 months and months after', () => {
    expect(normalizeEnteredAge({ value: 3, unit: 'w' })).toEqual({ value: 3, unit: 'w' });
    expect(normalizeEnteredAge({ value: 16, unit: 'w' })).toEqual({ value: 3, unit: 'm' });
    expect(normalizeEnteredAge({ value: 2, unit: 'm' })).toEqual({ value: 9, unit: 'w' });
    expect(normalizeEnteredAge({ value: 2, unit: 'y' })).toEqual({ value: 24, unit: 'm' });
    expect(normalizeEnteredAge({ value: 4.5, unit: 'y' })).toEqual({ value: 54, unit: 'm' });
  });

  it('clamps out-of-range entries to the supported range', () => {
    expect(normalizeEnteredAge({ value: 0, unit: 'w' })).toEqual({ value: 1, unit: 'w' });
    expect(normalizeEnteredAge({ value: 5, unit: 'y' })).toEqual({ value: 59, unit: 'm' });
    expect(normalizeEnteredAge({ value: -3, unit: 'm' })).toEqual({ value: 1, unit: 'w' });
    expect(normalizeEnteredAge({ value: Number.NaN, unit: 'm' })).toEqual({ value: 1, unit: 'w' });
  });

  it('formats ages for display', () => {
    expect(formatAge({ value: 1, unit: 'w' })).toBe('1 week');
    expect(formatAge({ value: 3, unit: 'w' })).toBe('3 weeks');
    expect(formatAge({ value: 4, unit: 'm' })).toBe('4 months');
    expect(formatAge({ value: 28, unit: 'm' })).toBe('2 years, 4 months');
    expect(formatAge({ value: 36, unit: 'm' })).toBe('3 years');
  });
});
