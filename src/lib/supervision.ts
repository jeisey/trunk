/**
 * Supervision feasibility rules. These drive the planner and the content
 * validator; they are not decorative badges.
 *
 * The rules are deliberately categorical and conservative. They answer one
 * question: can ONE adult appropriately supervise these two activities at the
 * same time, in the same space?
 */
import type { Activity, Hazard } from '../content/schema.ts';

/** Hazards that always need an adult's undivided attention. */
export const UNDIVIDED_ATTENTION_HAZARDS: readonly Hazard[] = ['water', 'heat', 'food', 'traffic'];

export interface FeasibilityResult {
  ok: boolean;
  reasons: string[];
}

type Track = Pick<Activity, 'title' | 'supervision' | 'hazards' | 'places' | 'outing'>;

const isClose = (t: Track) => t.supervision.proximity === 'holding' || t.supervision.proximity === 'arms-reach';

/**
 * Check whether two activities can run side by side under the given number of
 * adults. With two adults each child can have their own adult, so only the
 * per-activity minimum matters.
 */
export function checkParallel(a: Track, b: Track, adults: number): FeasibilityResult {
  const reasons: string[] = [];

  if (adults >= 2) {
    if (a.supervision.minAdults + b.supervision.minAdults > adults) {
      reasons.push('These two activities need more adults than are available.');
    }
    return { ok: reasons.length === 0, reasons };
  }

  for (const t of [a, b]) {
    if (t.supervision.minAdults > 1) reasons.push(`${t.title} needs two adults.`);
    if (!t.supervision.shareable) reasons.push(`${t.title} needs your full attention.`);
    const undivided = t.hazards.filter((h) => UNDIVIDED_ATTENTION_HAZARDS.includes(h));
    if (undivided.length > 0) {
      reasons.push(`${t.title} involves ${undivided.join(', ')} and needs your full attention.`);
    }
  }

  const continuous = [a, b].filter((t) => t.supervision.handsOn === 'continuous');
  if (continuous.length === 2) {
    reasons.push('Both activities need your hands the whole time.');
  } else if (continuous.length === 1) {
    const other = continuous[0] === a ? b : a;
    if (other.supervision.handsOn !== 'none') {
      reasons.push(`${continuous[0].title} needs your hands the whole time, and ${other.title} also needs hands-on help.`);
    }
  }

  if (isClose(a) && isClose(b)) {
    reasons.push('Both activities need you within arm’s reach.');
  }

  if (a.supervision.participation === 'leads' && b.supervision.participation === 'leads') {
    reasons.push('You can’t lead two different activities at once.');
  }

  const sharedPlace = a.places.some((p) => b.places.includes(p));
  if (!sharedPlace || a.outing !== b.outing) {
    reasons.push('The activities happen in different places.');
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Activities a parent can watch while busy nearby (for example, cooking). */
export function isBusyNearbyCompatible(t: Track): boolean {
  return (
    t.supervision.participation === 'watches' &&
    t.supervision.proximity === 'same-room' &&
    t.supervision.handsOn === 'none' &&
    t.supervision.shareable &&
    !t.hazards.some((h) => UNDIVIDED_ATTENTION_HAZARDS.includes(h))
  );
}
