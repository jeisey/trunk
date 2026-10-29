/**
 * Self-contained share links: #/s/<version><codec>.<base64url payload>
 *
 * - The payload lives in the URL fragment, so it is never sent to a server.
 * - It is compressed (deflate-raw via CompressionStream) and base64url-encoded.
 *   Encoding is not encryption: anyone with the link can read it.
 * - Default shares contain generic child labels, approximate ages, times, and
 *   catalog IDs only. Title, custom entry text, and notes are included only when
 *   the parent opts in after seeing a preview.
 * - Decoding enforces input-size and decompression limits, validates a strict
 *   schema, cleans all text, and re-applies current catalog eligibility. Missing,
 *   retired, or no-longer-eligible items are dropped with a visible explanation.
 */
import * as z from 'zod/mini';
import type { IndexedCatalog } from '../content/catalog.ts';
import { BREAK_LABEL, MAX_SEGMENTS, newId, newPlanId, PLAN_VERSION, type Plan, type PlanSegment } from './plan.ts';
import { reconcileSegments } from './reconcile.ts';
import { normalizeEnteredAge } from './age.ts';
import { cleanText, LIMITS } from './text.ts';
import { HHMM } from './time.ts';

export const SHARE_VERSION = 1;
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
const CompactSegment = z.union([
  z.tuple([z.literal('a'), Slug, Mins]),
  z.tuple([z.literal('r'), Slug, Mins, z.enum(['1', '2'])]),
  z.tuple([z.literal('b'), Mins]),
  z.tuple([z.literal('c'), Mins, z.enum(['b', '1', '2'])]),
  z.tuple([z.literal('c'), Mins, z.enum(['b', '1', '2']), z.string().check(z.maxLength(200))]),
]);

const CompactPlan = z.strictObject({
  t: z.optional(z.string().check(z.maxLength(200))),
  s: z.string().check(z.regex(HHMM)),
  w: int(10, 720),
  k: z.array(z.tuple([int(1, 59), z.enum(['w', 'm'])])).check(z.minLength(1), z.maxLength(2)),
  o: z.tuple([int(0, 3), int(0, 2), int(0, 2), z.union([z.literal(1), z.literal(2)])]),
  g: z.array(CompactSegment).check(z.maxLength(30)),
  n: z.optional(z.string().check(z.maxLength(1200))),
});
type CompactPlan = z.infer<typeof CompactPlan>;

export function toCompact(plan: Plan, opts: ShareOptions): CompactPlan {
  const compact: CompactPlan = {
    s: plan.start,
    w: plan.window,
    k: plan.kids.map((k) => [k.age.value, k.age.unit] as [number, 'w' | 'm']),
    o: [ENERGY.indexOf(plan.settings.energy), PLACE.indexOf(plan.settings.place), MODE.indexOf(plan.settings.mode), plan.settings.adults],
    g: plan.segments.map((s): CompactPlan['g'][number] => {
      switch (s.kind) {
        case 'activity':
          return ['a', (s.ref ?? '').replace(/^act\./, ''), s.minutes];
        case 'recipe':
          return ['r', (s.ref ?? '').replace(/^mix\./, ''), s.minutes, s.younger === 'c2' ? '2' : '1'];
        case 'break':
          return ['b', s.minutes];
        case 'custom': {
          const who = s.who === 'c1' ? '1' : s.who === 'c2' ? '2' : 'b';
          return opts.includeCustomText && s.label ? ['c', s.minutes, who, cleanText(s.label, LIMITS.custom)] : ['c', s.minutes, who];
        }
      }
    }),
  };
  if (opts.includeTitle && plan.title.trim()) compact.t = cleanText(plan.title, LIMITS.title);
  if (opts.includeNotes && plan.notes.trim()) compact.n = cleanText(plan.notes, LIMITS.notes, { multiline: true });
  return compact;
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
  if (version !== SHARE_VERSION) {
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
  const result = CompactPlan.safeParse(parsed);
  if (!result.success) throw new ShareError('invalid', 'This link doesn’t contain a valid Trunk plan.');
  return result.data;
}

export interface ImportResult {
  plan: Plan;
  dropped: { label: string; reason: string }[];
  adjusted: number;
}

/**
 * Turn an untrusted compact plan into a local draft, applying today's catalog
 * and safety/eligibility checks. Never trusts incoming durations or pairings.
 */
export function reconcile(compact: CompactPlan, c: IndexedCatalog, now = new Date()): ImportResult {
  const kids = compact.k.map(([value, unit]) => ({ age: normalizeEnteredAge({ value, unit }) as { value: number; unit: 'w' | 'm' }, notYet: [] }));
  const settings = {
    energy: ENERGY[compact.o[0]],
    place: PLACE[compact.o[1]],
    mode: MODE[compact.o[2]],
    adults: compact.o[3],
  };
  const raw: PlanSegment[] = compact.g.map((g): PlanSegment => {
    switch (g[0]) {
      case 'a':
        return { id: newId('a'), kind: 'activity', ref: `act.${g[1]}`, minutes: g[2] };
      case 'r':
        return { id: newId('r'), kind: 'recipe', ref: `mix.${g[1]}`, minutes: g[2] };
      case 'b':
        return { id: newId('b'), kind: 'break', minutes: g[1], label: BREAK_LABEL };
      case 'c': {
        const who = g[2] === '1' ? 'c1' : g[2] === '2' ? 'c2' : 'both';
        const label = g.length === 4 ? cleanText(g[3], LIMITS.custom) : '';
        return { id: newId('c'), kind: 'custom', minutes: g[1], who, label: label || 'Your own activity' };
      }
    }
  });
  const { segments, dropped, adjusted } = reconcileSegments(kids, settings, raw, c);
  const stamp = now.toISOString();
  const plan: Plan = {
    v: PLAN_VERSION,
    id: newPlanId(),
    title: compact.t ? cleanText(compact.t, LIMITS.title) || 'Shared plan' : 'Shared plan',
    kids,
    start: compact.s,
    window: compact.w,
    settings,
    segments: segments.slice(0, MAX_SEGMENTS),
    notes: compact.n ? cleanText(compact.n, LIMITS.notes, { multiline: true }) : '',
    createdAt: stamp,
    updatedAt: stamp,
  };
  return { plan, dropped, adjusted };
}

export async function importPayload(payload: string, c: IndexedCatalog): Promise<ImportResult> {
  return reconcile(await decodePayload(payload), c);
}

/** Import a downloaded plan file ({ trunkPlan: 1, plan: <compact> }) through the same checks as a link. */
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
  if (wrapper.data.trunkPlan !== SHARE_VERSION) throw new ShareError('version', 'That plan file comes from a different version of Trunk.');
  const compact = CompactPlan.safeParse(wrapper.data.plan);
  if (!compact.success) throw new ShareError('invalid', 'That file doesn’t contain a valid Trunk plan.');
  return reconcile(compact.data, c);
}
