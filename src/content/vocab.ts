/**
 * Controlled vocabularies, kept free of Zod so the browser bundle can import
 * them without pulling in the build-time validator. schema.ts builds the
 * content contract from these arrays.
 */

export const GOALS = [
  'gross-motor',
  'fine-motor',
  'communication',
  'cognition',
  'social-emotional',
  'sensory',
] as const;

export const INTENTS = [
  'connect',
  'move',
  'calm',
  'fresh-air',
  'explore',
  'create',
  'routine',
  'parent-moment',
] as const;

export const PLACES = ['indoors', 'outdoors'] as const;

/** Parent energy the activity asks for. Independent of supervision. */
export const EFFORTS = ['low', 'medium', 'high'] as const;

/** How much the adult takes part. */
export const PARTICIPATION = ['leads', 'joins', 'watches'] as const;

/** How close the adult must be. */
export const PROXIMITY = ['holding', 'arms-reach', 'same-room'] as const;

/** Whether the adult's hands are needed. */
export const HANDS_ON = ['continuous', 'intermittent', 'none'] as const;

export const MESS = ['none', 'low', 'medium', 'high'] as const;
export const NOISE = ['quiet', 'moderate', 'loud'] as const;

/** Lowest materials tier needed. */
export const MATERIALS_LEVEL = ['none', 'household', 'toys', 'special'] as const;

export const KINDS = ['play', 'outing', 'routine', 'media'] as const;

/**
 * described: the activity itself is described by a cited source.
 * adapted:   an editorial design built from source-informed principles.
 * practical: an everyday routine or practical choice; makes no developmental claim.
 */
export const EVIDENCE_TYPES = ['described', 'adapted', 'practical'] as const;

export const ABILITIES = [
  'head-control',
  'rolls',
  'sits-independently',
  'crawls',
  'pulls-to-stand',
  'walks',
  'runs',
  'jumps',
  'climbs',
  'eats-solids',
  'follows-directions',
  'no-longer-mouthing',
] as const;

export const HAZARDS = [
  'small-parts',
  'water',
  'heat',
  'falls',
  'cords',
  'sharp',
  'food',
  'mouthing',
  'traffic',
  'sun-weather',
  'suffocation',
  'allergens',
] as const;

export const SPACES = [
  'floor',
  'lap-or-arms',
  'table',
  'seat',
  'kitchen',
  'bath-or-sink',
  'open-area',
  'yard-or-park',
  'neighborhood',
  'anywhere',
] as const;

/**
 * Tummy-time position. Only 'floor' (a firm, flat surface) is flatSurface: true.
 * Chest, lap, carried, and propped positions can be useful, but Trunk never
 * credits them toward a prescribed flat-surface target.
 */
export const TUMMY_POSITIONS = ['floor', 'chest', 'lap', 'carry', 'propped'] as const;

export const CLAIM_KINDS = ['recommendation', 'description', 'safety'] as const;

export const JURISDICTIONS = ['US', 'International', 'IE', 'UK', 'CA', 'AU', 'NZ', 'EU'] as const;

// ---------- Timing (content schema v2) ----------

/**
 * How stimulating an activity (or a recipe's shared space) usually is, reviewed per record.
 * settling: quiet, slow, familiar; can fit winding down.
 * gentle:   calm but engaging.
 * lively:   physically active, exciting, loud, or messy.
 * variable: depends on how it's done, or not assessed. Never treated as calm or as cleared.
 */
export const STIMULATION = ['settling', 'gentle', 'lively', 'variable'] as const;

/** Routine events a timing rule can be keyed to. A snack is a meal for timing purposes. */
export const ROUTINE_EVENTS = ['milk-feed', 'meal', 'nap'] as const;

/** before: measured back from the event's start. after: measured forward from the event's end. */
export const TIMING_WHEN = ['before', 'after'] as const;

/**
 * preferred: a good fit near this event (ranked up, may get a short positive cue).
 * neutral:   assessed; no timing concern.
 * later:     better at another time (ranked down, never excluded).
 * avoid:     leave out of automatic suggestions near this event; flagged if a parent places it there.
 * None of these are medical prohibitions; age, readiness, and supervision rules are separate.
 */
export const TIMING_FIT = ['preferred', 'neutral', 'later', 'avoid'] as const;

/** Conditions a rule can be limited to. Trunk never asks for a medical profile, so these stay advisory. */
export const TIMING_CONDITIONS = ['spit-up'] as const;

/** source: the guidance (or number) comes from a cited source. editorial: Trunk's own planning convention. */
export const TIMING_BASIS = ['source', 'editorial'] as const;

/** Parent-placed routine blocks in a plan. */
export const ROUTINE_TYPES = ['nap', 'milk-feed', 'meal', 'snack'] as const;
