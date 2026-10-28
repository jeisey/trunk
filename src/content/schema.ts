/**
 * Trunk content contract, v1.
 *
 * This file is the single authority for content shapes. TypeScript types are
 * inferred from these Zod schemas, and docs/schema/content.schema.json is
 * generated from them. Do not hand-edit types elsewhere.
 *
 * Contract rules that need more than one record (references, duplicates,
 * cross-field safety rules) live in src/content/validate.ts.
 */
import { z } from 'zod';
import { AGE_STRING_PATTERN } from '../lib/age.ts';

export const SCHEMA_VERSION = 1 as const;

// ---------- Controlled vocabularies (defined in vocab.ts) ----------

import {
  GOALS,
  INTENTS,
  PLACES,
  EFFORTS,
  PARTICIPATION,
  PROXIMITY,
  HANDS_ON,
  MESS,
  NOISE,
  MATERIALS_LEVEL,
  KINDS,
  EVIDENCE_TYPES,
  ABILITIES,
  HAZARDS,
  SPACES,
  TUMMY_POSITIONS,
  CLAIM_KINDS,
  JURISDICTIONS,
} from './vocab.ts';
export {
  GOALS,
  INTENTS,
  PLACES,
  EFFORTS,
  PARTICIPATION,
  PROXIMITY,
  HANDS_ON,
  MESS,
  NOISE,
  MATERIALS_LEVEL,
  KINDS,
  EVIDENCE_TYPES,
  ABILITIES,
  HAZARDS,
  SPACES,
  TUMMY_POSITIONS,
  CLAIM_KINDS,
  JURISDICTIONS,
};

// ---------- Identifier rules ----------

const slug = '[a-z0-9]+(?:-[a-z0-9]+)*';
export const ID_PATTERNS = {
  activity: new RegExp(`^act\\.${slug}$`),
  recipe: new RegExp(`^mix\\.${slug}$`),
  starterPlan: new RegExp(`^plan\\.${slug}$`),
  source: new RegExp(`^src\\.${slug}\\.${slug}$`),
  claim: new RegExp(`^clm\\.(?:core|[a-f]|mix)\\.${slug}$`),
} as const;

export const ActivityId = z.string().regex(ID_PATTERNS.activity, 'activity id must look like act.some-slug');
export const RecipeId = z.string().regex(ID_PATTERNS.recipe, 'recipe id must look like mix.some-slug');
export const StarterPlanId = z.string().regex(ID_PATTERNS.starterPlan, 'starter plan id must look like plan.some-slug');
export const SourceId = z.string().regex(ID_PATTERNS.source, 'source id must look like src.org.some-slug');
export const ClaimId = z
  .string()
  .regex(ID_PATTERNS.claim, 'claim id must look like clm.<core|a-f|mix>.some-slug');

// ---------- Primitives ----------

const AgeString = z.string().regex(AGE_STRING_PATTERN, 'age must look like 1w, 3m, or 2y');
const IsoDate = z.iso.date();
/** Publication dates are often only known to the year or month. */
const PartialDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'use YYYY, YYYY-MM, or YYYY-MM-DD');
const Minutes = z.number().int().min(0).max(240);
const ShortText = (max: number) => z.string().trim().min(2).max(max);

export const Duration = z
  .strictObject({
    min: z.number().int().min(1).max(240),
    default: z.number().int().min(1).max(240),
    max: z.number().int().min(1).max(240),
  })
  .refine((d) => d.min <= d.default && d.default <= d.max, {
    message: 'duration must satisfy min <= default <= max',
  });

export const Supervision = z.strictObject({
  participation: z.enum(PARTICIPATION),
  proximity: z.enum(PROXIMITY),
  handsOn: z.enum(HANDS_ON),
  minAdults: z.number().int().min(1).max(2),
  /** True when one adult can cover this while also supervising another child's compatible activity. */
  shareable: z.boolean(),
  /** Short, specific space/hazard constraint shown to parents, e.g. "Clear floor, away from the sofa edge". */
  space: ShortText(140),
});

export const SafetyNote = z.strictObject({
  text: ShortText(180),
  claims: z.array(ClaimId).max(4).default([]),
});

export const Why = z.strictObject({
  text: ShortText(220),
  claims: z.array(ClaimId).min(1).max(4),
});

export const Readiness = z.strictObject({
  abilities: z.array(z.enum(ABILITIES)).max(4),
  notes: z.array(ShortText(140)).max(2),
});

export const Materials = z.strictObject({
  level: z.enum(MATERIALS_LEVEL),
  items: z.array(ShortText(60)).max(8),
});

export const Activity = z.strictObject({
  id: ActivityId,
  rev: z.number().int().min(1),
  title: ShortText(48),
  summary: ShortText(150),
  kind: z.enum(KINDS),
  ageMin: AgeString,
  ageMax: AgeString,
  readiness: Readiness,
  goals: z.array(z.enum(GOALS)).max(3),
  intents: z.array(z.enum(INTENTS)).min(1).max(3),
  places: z.array(z.enum(PLACES)).min(1).max(2),
  spaces: z.array(z.enum(SPACES)).min(1).max(3),
  outing: z.boolean(),
  materials: Materials,
  setupMinutes: Minutes.max(30),
  cleanupMinutes: Minutes.max(30),
  duration: Duration,
  effort: z.enum(EFFORTS),
  supervision: Supervision,
  mess: z.enum(MESS),
  noise: z.enum(NOISE),
  hazards: z.array(z.enum(HAZARDS)).max(6),
  steps: z.array(ShortText(180)).min(2).max(4),
  adaptations: z.array(ShortText(180)).min(1).max(3),
  stopCues: z.array(ShortText(140)).min(1).max(4),
  safety: z.array(SafetyNote).min(1).max(4),
  why: Why.optional(),
  tummyTime: z.strictObject({ position: z.enum(TUMMY_POSITIONS), flatSurface: z.boolean() }).optional(),
  evidence: z.strictObject({
    type: z.enum(EVIDENCE_TYPES),
    claims: z.array(ClaimId).max(8),
  }),
  checked: IsoDate,
  retired: z.strictObject({ date: IsoDate, reason: ShortText(200) }).optional(),
});

export const Source = z.strictObject({
  id: SourceId,
  url: z.url({ protocol: /^https$/ }),
  org: ShortText(120),
  title: ShortText(200),
  jurisdiction: z.enum(JURISDICTIONS),
  checked: IsoDate,
  published: PartialDate.optional(),
  updated: PartialDate.optional(),
  notes: ShortText(400).optional(),
});

export const Claim = z.strictObject({
  id: ClaimId,
  kind: z.enum(CLAIM_KINDS),
  /** The limited claim as Trunk states it. Original wording, not a quotation. */
  text: ShortText(260),
  sources: z.array(SourceId).min(1).max(4),
  /** Where in the source: section heading, paragraph, or list item. */
  locator: ShortText(200),
  /** Short paraphrase of the supporting passage (not a copy). */
  paraphrase: ShortText(400),
  /** Population, age, jurisdiction, and position limits of the claim. */
  scope: ShortText(260),
  caveat: ShortText(400).optional(),
});

const RecipeRole = z.strictObject({
  ageMin: AgeString,
  ageMax: AgeString,
  abilities: z.array(z.enum(ABILITIES)).max(4),
  activity: ActivityId,
  /** What this child does, in the role. */
  does: ShortText(180),
  adapt: ShortText(180).optional(),
});

export const MixedAgeRecipe = z.strictObject({
  id: RecipeId,
  rev: z.number().int().min(1),
  mode: z.enum(['together', 'parallel']),
  title: ShortText(56),
  summary: ShortText(160),
  places: z.array(z.enum(PLACES)).min(1).max(2),
  outing: z.boolean(),
  younger: RecipeRole,
  older: RecipeRole,
  adult: z.strictObject({
    does: ShortText(200),
    minAdults: z.number().int().min(1).max(2),
    handsOnFor: z.enum(['younger', 'older', 'both', 'neither']),
  }),
  sharedSetup: ShortText(200),
  setupMinutes: Minutes.max(30),
  cleanupMinutes: Minutes.max(30),
  /** Adult and space constraints, e.g. "Same room; baby's mat at least an arm's length from the blocks". */
  space: ShortText(200),
  duration: Duration,
  effort: z.enum(EFFORTS),
  intents: z.array(z.enum(INTENTS)).min(1).max(3),
  steps: z.array(ShortText(200)).min(2).max(4),
  stopCues: z.array(ShortText(140)).min(1).max(4),
  safety: z.array(SafetyNote).min(1).max(5),
  claims: z.array(ClaimId).max(8),
  checked: IsoDate,
  retired: z.strictObject({ date: IsoDate, reason: ShortText(200) }).optional(),
});

const StarterSegment = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('activity'), ref: ActivityId, minutes: z.number().int().min(1).max(240) }),
  z.strictObject({ kind: z.literal('recipe'), ref: RecipeId, minutes: z.number().int().min(1).max(240) }),
  z.strictObject({
    kind: z.literal('break'),
    minutes: z.number().int().min(1).max(60),
    label: ShortText(60).optional(),
  }),
]);

export const StarterPlan = z.strictObject({
  id: StarterPlanId,
  rev: z.number().int().min(1),
  title: ShortText(60),
  summary: ShortText(200),
  circumstance: ShortText(120),
  /** Ages used to preview the plan (1 or 2 children). */
  ages: z.array(AgeString).min(1).max(2),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  segments: z.array(StarterSegment).min(3).max(12),
  checked: IsoDate,
});

/** One content file. Every file may hold any record family; ownership is by convention. */
export const ContentFile = z.strictObject({
  schema: z.literal(SCHEMA_VERSION),
  workstream: z.string().regex(/^(core|[A-F]|mix|fixture)$/),
  description: ShortText(300).optional(),
  sources: z.array(Source).default([]),
  claims: z.array(Claim).default([]),
  activities: z.array(Activity).default([]),
  recipes: z.array(MixedAgeRecipe).default([]),
  starterPlans: z.array(StarterPlan).default([]),
});

export type Goal = (typeof GOALS)[number];
export type Intent = (typeof INTENTS)[number];
export type Place = (typeof PLACES)[number];
export type Effort = (typeof EFFORTS)[number];
export type Ability = (typeof ABILITIES)[number];
export type Hazard = (typeof HAZARDS)[number];
export type TummyPosition = (typeof TUMMY_POSITIONS)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type Activity = z.infer<typeof Activity>;
export type Source = z.infer<typeof Source>;
export type Claim = z.infer<typeof Claim>;
export type MixedAgeRecipe = z.infer<typeof MixedAgeRecipe>;
export type RecipeRole = z.infer<typeof RecipeRole>;
export type StarterPlan = z.infer<typeof StarterPlan>;
export type StarterSegment = z.infer<typeof StarterSegment>;
export type ContentFile = z.infer<typeof ContentFile>;
export type Supervision = z.infer<typeof Supervision>;
