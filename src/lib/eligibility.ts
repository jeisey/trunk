/**
 * Age and readiness eligibility. Age is a starting filter only; readiness
 * abilities a parent marks as "not yet" exclude activities that need them.
 */
import type { Ability, Activity, MixedAgeRecipe, RecipeRole } from '../content/schema.ts';
import { ageStringToDays, isAgeEligible } from './age.ts';

const dayCache = new Map<string, number>();
export function days(text: string): number {
  let value = dayCache.get(text);
  if (value === undefined) {
    value = ageStringToDays(text);
    dayCache.set(text, value);
  }
  return value;
}

export function activityFitsAge(activity: Pick<Activity, 'ageMin' | 'ageMax'>, childDays: number): boolean {
  return isAgeEligible(childDays, days(activity.ageMin), days(activity.ageMax));
}

export function activityFitsReadiness(activity: Pick<Activity, 'readiness'>, notYet: readonly Ability[]): boolean {
  return !activity.readiness.abilities.some((a) => notYet.includes(a));
}

function roleFits(role: RecipeRole, childDays: number, notYet: readonly Ability[]): boolean {
  return isAgeEligible(childDays, days(role.ageMin), days(role.ageMax)) && !role.abilities.some((a) => notYet.includes(a));
}

export interface ChildInput {
  days: number;
  notYet: readonly Ability[];
}

/**
 * Returns which child (0 or 1) takes the younger role, or null if the pair
 * does not fit. Tries both assignments so child order never matters.
 */
export function recipeAssignment(recipe: MixedAgeRecipe, a: ChildInput, b: ChildInput): 0 | 1 | null {
  if (roleFits(recipe.younger, a.days, a.notYet) && roleFits(recipe.older, b.days, b.notYet)) return 0;
  if (roleFits(recipe.younger, b.days, b.notYet) && roleFits(recipe.older, a.days, a.notYet)) return 1;
  return null;
}
