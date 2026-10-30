/**
 * Self-contained share links: #/s/<version><codec>.<base64url payload>
 *
 * - The payload lives in the URL fragment, so it is never sent to a server.
 * - It is compressed (deflate-raw via CompressionStream) and base64url-encoded.
 *   Encoding is not encryption: anyone with the link can read it.
 * - Default shares contain generic child labels, approximate ages, times, and
 *   catalog IDs only. Title, custom entry text, and notes are included only when
 *   the parent opts in after seeing a preview. Momentary timing context ("Just
 *   fed", "Nap soon") is never part of a plan, so it is never shared.
 * - Decoding enforces input-size and decompression limits, validates a strict
 *   schema, cleans all text, and re-applies current catalog eligibility and the
 *   plan's structure rules. Missing, retired, or no-longer-eligible items are
 *   dropped with a visible explanation.
 *
 * Format v2 (links `2z.…`, files `{ trunkPlan: 2 }`) adds routine blocks (type,
 * child, minutes, time, settling/holding), `who` on one-child activities, and
 * anchored times, locks, and alongside entries. v1 links and files still open
 * through the retained v1 schema (every v1 entry is also a valid v2 entry).
 */
import * as z from 'zod/mini';
import type { IndexedCatalog } from '../content/catalog.ts';
import { ROUTINE_TYPES } from '../content/vocab.ts';
import { BREAK_LABEL, MAX_SEGMENTS, newId, newPlanId, Plan as PlanSchema, PLAN_VERSION, type Plan, type PlanSegment } from './plan.ts';
import { reconcileSegments } from './reconcile.ts';
import { normalizeEnteredAge } from './age.ts';
import { cleanText, LIMITS } from './text.ts';
import { HHMM } from './time.ts';
import { defaultPlanTitle } from './planTitle.ts';

export const SHARE_VERSION = 2;
/** Oldest share format this build still reads. */
export const OLDEST_SHARE_VERSION = 1;
/** Whole-link budget. Links longer than this fall back to image/JSON export. */
export const MAX_LINK_LENGTH = 2000;
/** Hard limits applied before and during decoding. */
export const MAX_ENCODED_LENGTH = 6000;
export const MAX_DECODED_BYTES = 16_384;

export interface ShareOptions {
  includeTitle: boolean;
  includeCustomText: boolean;
  includeNotes: boolean;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = { includeTitle: false, includeCustomText: false, includeNotes: false };

const ENERGY = ['busy', 'low', 'some', 'plenty'] as const;
const PLACE = ['any', 'indoors', 'outdoors'] as const;
const MODE = ['either', 'together', 'parallel'] as const;

const Slug = z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), z.maxLength(70));
const int = (min: number, max: number) => z.number().check(z.int(), z.minimum(min), z.maximum(max));
const Mins = int(1, 240);
const Who = z.enum(['b', '1', '2']);
const Text = z.string().check(z.maxLength(200));

/** v1 entries (2026-10 and earlier). Kept to read old links and files. */
const V1_ENTRIES = [
  z.tuple([z.literal('a'), Slug, Mins]),
  z.tuple([z.literal('r'), Slug, Mins, z.enum(['1', '2'])]),
  z.tuple([z.literal('b'), Mins]),
  z.tuple([z.literal('c'), Mins, Who]),
  z.tuple([z.literal('c'), Mins, Who, Text]),
] as const;
const V1Segment = z.union(V1_ENTRIES);

/**
 * v2 per-entry extras, all optional: w = child for a one-child activity, t = anchored
 * start (minutes after the plan's start), l = locked, g = alongside, s = nap settling
 * minutes, h = parent holds the sleeping child.
 */
const Extras = z.strictObject({
  w: z.optional(z.enum(['1', '2'])),
  t: z.optional(int(0, 1439)),
  l: z.optional(z.literal(1)),
  g: z.optional(z.literal(1)),
  s: z.optional(int(0, 60)),
  h: z.optional(z.literal(1)),
});
type Extras = z.infer<typeof Extras>;

const V2Segment = z.union([
  ...V1_ENTRIES,
  z.tuple([z.literal('a'), Slug, Mins, Extras]),
  z.tuple([z.literal('r'), Slug, Mins, z.enum(['1', '2']), Extras]),
  z.tuple([z.literal('b'), Mins, Extras]),
  z.tuple([z.literal('c'), Mins, Who, Extras]),
  z.tuple([z.literal('c'), Mins, Who, Text, Extras]),
  // Routine block: type, minutes (parent's estimate), child, time.
  z.tuple([z.literal('n'), z.enum(ROUTINE_TYPES), Mins, Who, int(0, 1439)]),
  z.tuple([z.literal('n'), z.enum(ROUTINE_TYPES), Mins, Who, int(0, 1439), Extras]),
]);

const head = {
  t: z.optional(z.string().check(z.maxLength(200))),
  s: z.string().check(z.regex(HHMM)),
  w: int(10, 720),
  k: z.array(z.tuple([int(1, 59), z.enum(['w', 'm'])])).check(z.minLength(1), z.maxLength(2)),
  o: z.tuple([int(0, 3), int(0, 2), int(0, 2), z.union([z.literal(1), z.literal(2)])]),
};
const tail = { n: z.optional(z.string().check(z.maxLength(1200))) };

const CompactPlanV1 = z.strictObject({ ...head, g: z.array(V1Segment).check(z.maxLength(30)), ...tail });
const CompactPlan = z.strictObject({ ...head, g: z.array(V2Segment).check(z.maxLength(30)), ...tail });
export type CompactPlan = z.infer<typeof CompactPlan>;
type CompactSegment = CompactPlan['g'][number];

const whoCode = (w: PlanSegment['who']) => (w === 'c1' ? '1' : w === 'c2' ? '2' : 'b');

function extrasOf(s: PlanSegment): Extras | null {
  const x: Extras = {};
  if (s.kind === 'activity' && (s.who === 'c1' || s.who === 'c2')) x.w = s.who === 'c1' ? '1' : '2';
  if (s.kind !== 'routine' && s.at !== undefined) x.t = s.at;
  if (s.locked) x.l = 1;
  if (s.along) x.g = 1;
  if (s.settle !== undefined) x.s = s.settle;
  if (s.holding) x.h = 1;
  return Object.keys(x).length ? x : null;
}

export function toCompact(plan: Plan, opts: ShareOptions): CompactPlan {
  const compact: CompactPlan = {
    s: plan.start,
    w: plan.window,
    k: plan.kids.map((k) => [k.age.value, k.age.unit] as [number, 'w' | 'm']),
    o: [ENERGY.indexOf(plan.settings.energy), PLACE.indexOf(plan.settings.place), MODE.indexOf(plan.settings.mode), plan.settings.adults],
    g: plan.segments.map((s): CompactSegment => {
      const x = extrasOf(s);
      switch (s.kind) {
        case 'activity': {
          const slug = (s.ref ?? '').replace(/^act\./, '');
          return x ? ['a', slug, s.minutes, x] : ['a', slug, s.minutes];
        }
        case 'recipe': {
          const slug = (s.ref ?? '').replace(/^mix\./, '');
          const y = s.younger === 'c2' ? '2' : '1';
          return x ? ['r', slug, s.minutes, y, x] : ['r', slug, s.minutes, y];
        }
        case 'break':
          return x ? ['b', s.minutes, x] : ['b', s.minutes];
        case 'custom': {
          const who = whoCode(s.who);
          const text = opts.includeCustomText && s.label ? cleanText(s.label, LIMITS.custom) : '';
          if (text) return x ? ['c', s.minutes, who, text, x] : ['c', s.minutes, who, text];
          return x ? ['c', s.minutes, who, x] : ['c', s.minutes, who];
        }
        case 'routine': {
          const routine = s.routine ?? 'nap';
          return x ? ['n', routine, s.minutes, whoCode(s.who), s.at ?? 0, x] : ['n', routine, s.minutes, whoCode(s.who), s.at ?? 0];
        }
      }
    }),
  };
  if (opts.includeTitle && plan.title.trim()) compact.t = cleanText(plan.title, LIMITS.title);
  if (opts.includeNotes && plan.notes.trim()) compact.n = cleanText(plan.notes, LIMITS.notes, { multiline: true });
  return compact;
}

/** The JSON file the share dialog downloads: { trunkPlan: 2, plan: <compact> }, with the same privacy options as a link. */
export function planFileText(plan: Plan, opts: ShareOptions): string {
  return JSON.stringify({ trunkPlan: SHARE_VERSION, plan: toCompact(plan, opts) }, null, 2);
}

// ---------- base64url ----------

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareError('malformed', 'This link is damaged.');
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  let bin: string;
  try {
    bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
  } catch {
    throw new ShareError('malformed', 'This link is damaged.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- compression with limits ----------

export const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateLimited(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new ShareError('too-large', 'This link holds more data than a Trunk plan can.');
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ShareError) throw e;
    throw new ShareError('malformed', 'This link is damaged.');
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export type ShareErrorCode = 'malformed' | 'version' | 'too-large' | 'invalid';

export class ShareError extends Error {
  code: ShareErrorCode;
  constructor(code: ShareErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// ---------- encode / decode ----------

export async function encodePayload(plan: Plan, opts: ShareOptions): Promise<string> {
  const json = JSON.stringify(toCompact(plan, opts));
  const bytes = new TextEncoder().encode(json);
  if (canCompress()) {
    const z = await deflate(bytes);
    return `${SHARE_VERSION}z.${bytesToBase64Url(z)}`;
  }
  return `${SHARE_VERSION}j.${bytesToBase64Url(bytes)}`;
}

export function shareUrl(base: string, payload: string): string {
  return `${base.replace(/#.*$/, '')}#/s/${payload}`;
}

export async function decodePayload(payload: string): Promise<CompactPlan> {
  if (payload.length > MAX_ENCODED_LENGTH) throw new ShareError('too-large', 'This link is too long to be a Trunk plan.');
  const match = /^(\d{1,3})([a-z])\.([A-Za-z0-9_-]+)$/.exec(payload);
  if (!match) throw new ShareError('malformed', 'This link is damaged or incomplete.');
  const version = Number(match[1]);
  if (version < OLDEST_SHARE_VERSION || version > SHARE_VERSION) {
    throw new ShareError(
      'version',
      version > SHARE_VERSION
        ? 'This plan was shared from a newer version of Trunk. Refresh the page and try the link again.'
        : 'This plan link uses an old format Trunk no longer reads.',
    );
  }
  const raw = base64UrlToBytes(match[3]);
  let bytes: Uint8Array;
  if (match[2] === 'z') {
    if (!canCompress()) throw new ShareError('malformed', 'This browser can’t open compressed plan links.');
    bytes = await inflateLimited(raw, MAX_DECODED_BYTES);
  } else if (match[2] === 'j') {
    if (raw.length > MAX_DECODED_BYTES) throw new ShareError('too-large', 'This link holds more data than a Trunk plan can.');
    bytes = raw;
  } else {
    throw new ShareError('version', 'This link uses a format Trunk doesn’t recognize.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ShareError('malformed', 'This link is damaged.');
  }
  const result = parseCompact(version, parsed);
  if (!result) throw new ShareError('invalid', 'This link doesn’t contain a valid Trunk plan.');
  return result;
}

/** Validate a compact plan of a known format version. v1 entries are a subset of v2, so a v1 plan reads as v2. */
function parseCompact(version: number, raw: unknown): CompactPlan | null {
  const r = version === 1 ? CompactPlanV1.safeParse(raw) : CompactPlan.safeParse(raw);
  return r.success ? (r.data as CompactPlan) : null;
}

export interface ImportResult {
  plan: Plan;
  dropped: { label: string; reason: string }[];
  /** Entries kept with a visible change (for example no longer alongside a routine block). */
  changed: { label: string; reason: string }[];
  adjusted: number;
}

const childOf = (w: 'b' | '1' | '2'): 'both' | 'c1' | 'c2' => (w === '1' ? 'c1' : w === '2' ? 'c2' : 'both');

function baseSegment(g: CompactSegment): PlanSegment {
  switch (g[0]) {
    case 'a':
      return { id: newId('a'), kind: 'activity', ref: `act.${g[1]}`, minutes: g[2] };
    case 'r':
      return { id: newId('r'), kind: 'recipe', ref: `mix.${g[1]}`, minutes: g[2] };
    case 'b':
      return { id: newId('b'), kind: 'break', minutes: g[1], label: BREAK_LABEL };
    case 'c': {
      const text = typeof g[3] === 'string' ? cleanText(g[3], LIMITS.custom) : '';
      return { id: newId('c'), kind: 'custom', minutes: g[1], label: text || 'Your own activity', who: childOf(g[2]) };
    }
    case 'n':
      return { id: newId('n'), kind: 'routine', minutes: g[2], who: childOf(g[3]), routine: g[1], at: g[4] };
  }
}

/** Build an entry in the plan schema's key order, applying v2 extras that make sense for its kind. */
function segmentFrom(g: CompactSegment): PlanSegment {
  const last: unknown = g[g.length - 1];
  const extras = typeof last === 'object' && last !== null ? (last as Extras) : undefined;
  const seg = baseSegment(g);
  if (seg.kind === 'activity' && extras?.w) seg.who = extras.w === '1' ? 'c1' : 'c2';
  if (seg.kind !== 'routine' && extras?.t !== undefined) seg.at = extras.t;
  if (extras?.l && seg.at !== undefined) seg.locked = true;
  if (extras?.g && (seg.kind === 'activity' || seg.kind === 'custom' || seg.kind === 'routine') && (seg.who === 'c1' || seg.who === 'c2')) seg.along = true;
  if (seg.kind === 'routine' && seg.routine === 'nap') {
    if (extras?.s !== undefined) seg.settle = extras.s;
    if (extras?.h) seg.holding = true;
  }
  return seg;
}

/**
 * Turn an untrusted compact plan into a local draft, applying today's catalog,
 * safety/eligibility checks, and the plan's structure rules. Never trusts
 * incoming durations or pairings.
 */
export function reconcile(compact: CompactPlan, c: IndexedCatalog, now = new Date()): ImportResult {
  const kids = compact.k.map(([value, unit]) => ({ age: normalizeEnteredAge({ value, unit }) as { value: number; unit: 'w' | 'm' }, notYet: [] }));
  const settings = {
    energy: ENERGY[compact.o[0]],
    place: PLACE[compact.o[1]],
    mode: MODE[compact.o[2]],
    adults: compact.o[3],
  };
  const raw = compact.g.map(segmentFrom);
  const { segments, dropped, changed, adjusted } = reconcileSegments(kids, settings, raw, c);
  const stamp = now.toISOString();
  const plan: Plan = {
    v: PLAN_VERSION,
    id: newPlanId(),
    // Without the sender's title, name it from what the link already carries (no extra data).
    title: (compact.t && cleanText(compact.t, LIMITS.title)) || defaultPlanTitle({ kids, start: compact.s, window: compact.w }),
    kids,
    start: compact.s,
    window: compact.w,
    settings,
    segments: segments.slice(0, MAX_SEGMENTS),
    notes: compact.n ? cleanText(compact.n, LIMITS.notes, { multiline: true }) : '',
    createdAt: stamp,
    updatedAt: stamp,
  };
  const checked = PlanSchema.safeParse(plan);
  if (!checked.success) throw new ShareError('invalid', 'This plan doesn’t pass Trunk’s checks.');
  return { plan: checked.data, dropped, changed, adjusted };
}

export async function importPayload(payload: string, c: IndexedCatalog): Promise<ImportResult> {
  return reconcile(await decodePayload(payload), c);
}

/** Import a downloaded plan file ({ trunkPlan: 1 | 2, plan: <compact> }) through the same checks as a link. */
export function importPlanFile(text: string, c: IndexedCatalog): ImportResult {
  if (!text || text.length > MAX_DECODED_BYTES) throw new ShareError('too-large', 'That file is too large to be a Trunk plan.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ShareError('malformed', 'That file isn’t a Trunk plan.');
  }
  const wrapper = z.strictObject({ trunkPlan: z.number().check(z.int()), plan: z.unknown() }).safeParse(raw);
  if (!wrapper.success) throw new ShareError('invalid', 'That file isn’t a Trunk plan.');
  const version = wrapper.data.trunkPlan;
  if (version > SHARE_VERSION) throw new ShareError('version', 'That plan file comes from a newer version of Trunk. Refresh the page and try again.');
  if (version < OLDEST_SHARE_VERSION) throw new ShareError('version', 'That plan file comes from a different version of Trunk.');
  const compact = parseCompact(version, wrapper.data.plan);
  if (!compact) throw new ShareError('invalid', 'That file doesn’t contain a valid Trunk plan.');
  return reconcile(compact, c);
}
