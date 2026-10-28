/** Plain-language labels for controlled vocabularies. */
import type { Activity, Goal, Intent, MixedAgeRecipe, Supervision, TummyPosition } from '../content/schema.ts';
import { formatAgeRange } from './age.ts';

export const GOAL_LABEL: Record<Goal, string> = {
  'gross-motor': 'Big movements',
  'fine-motor': 'Hands and fingers',
  communication: 'Talking and listening',
  cognition: 'Thinking and problem-solving',
  'social-emotional': 'Feelings and connection',
  sensory: 'Senses',
};

export const INTENT_LABEL: Record<Intent, string> = {
  connect: 'Connect',
  move: 'Move',
  calm: 'Calm',
  'fresh-air': 'Fresh air',
  explore: 'Explore',
  create: 'Create',
  routine: 'Everyday routine',
  'parent-moment': 'You need a moment',
};

export const EVIDENCE_LABEL: Record<Activity['evidence']['type'], { short: string; long: string }> = {
  described: { short: 'Described by a source', long: 'A cited public health source describes this activity.' },
  adapted: { short: 'Adapted idea', long: 'An original Trunk idea built from the source-informed principles cited below.' },
  practical: { short: 'Practical routine', long: 'An everyday routine or practical choice. Trunk makes no developmental claim for it.' },
};

export const TUMMY_POSITION_LABEL: Record<TummyPosition, string> = {
  floor: 'On a firm, flat floor surface',
  chest: 'On your chest (reclined)',
  lap: 'Across your lap',
  carry: 'Carried tummy-down',
  propped: 'Propped over a small roll',
};

export function durationText(d: { min: number; default: number; max: number }): string {
  if (d.min === d.max) return `about ${d.min} min`;
  return `${d.min}–${d.max} min`;
}

/** What the adult is doing, in one line. Supervision, not effort. */
export function adultText(s: Supervision): string {
  if (s.proximity === 'holding') return s.participation === 'watches' ? 'Holding them, watching closely' : 'Holding them the whole time';
  if (s.proximity === 'arms-reach') {
    if (s.participation === 'leads') return 'Within arm’s reach, leading it';
    if (s.participation === 'joins') return 'Within arm’s reach, playing along';
    return 'Within arm’s reach, eyes on them';
  }
  if (s.participation === 'leads') return 'Nearby, leading it';
  if (s.participation === 'joins') return 'Nearby, joining in';
  return 'Same room, keeping an eye on them';
}

export function attentionNote(s: Supervision): string | null {
  if (!s.shareable) return 'Needs your full attention';
  if (s.minAdults > 1) return 'Needs two adults';
  return null;
}

export function materialsLine(a: Pick<Activity, 'materials' | 'setupMinutes'>): string {
  const items = a.materials.items.length ? a.materials.items.join(', ') : 'Nothing needed';
  return a.setupMinutes > 0 ? `${items} · ${a.setupMinutes} min setup` : items;
}

export const EFFORT_LABEL: Record<Activity['effort'], string> = {
  low: 'Low energy for you',
  medium: 'Some energy for you',
  high: 'Active for you',
};

export function activityAges(a: Pick<Activity, 'ageMin' | 'ageMax'>): string {
  return formatAgeRange(a.ageMin, a.ageMax);
}

export function recipeAges(r: MixedAgeRecipe): string {
  return `${formatAgeRange(r.younger.ageMin, r.younger.ageMax)} with ${formatAgeRange(r.older.ageMin, r.older.ageMax)}`;
}

export const ABILITY_LABEL: Record<string, string> = {
  'head-control': 'holds head steady',
  rolls: 'rolls over',
  'sits-independently': 'sits without support',
  crawls: 'crawls',
  'pulls-to-stand': 'pulls up to stand',
  walks: 'walks',
  runs: 'runs',
  jumps: 'jumps with both feet',
  climbs: 'climbs',
  'eats-solids': 'already eats solid foods',
  'follows-directions': 'follows simple directions',
  'no-longer-mouthing': 'no longer puts things in their mouth',
};
