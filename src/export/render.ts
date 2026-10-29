/**
 * Plan → PNG pages, drawn on a canvas on the user's device.
 * Loaded only when the parent asks for images.
 *
 * - Every fact comes from analyzePlan() (and the shared row order in
 *   planDisplay.ts), so the image matches the editor: routine blocks, the other
 *   child's alongside track, per-child roles, timing cues, and conflicts. Wall
 *   time is the union of entries, so alongside tracks never double a duration.
 * - Text never shrinks below a legible size to fit; long plans paginate and
 *   every entry appears on some page.
 * - Privacy defaults: generic child labels and approximate ages; the plan's
 *   title and the text of the parent's own entries only when they opt in.
 * - The brand logo is the supplied raster (same-origin, so the canvas can still
 *   be exported), decoded before drawing.
 */
import { assetUrl, BRAND, BRAND_ASSETS, UI } from '../brand.ts';
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAge } from '../lib/age.ts';
import { analyzePlan, childLabel, type EntryAnalysis, type Gap, type PlanAnalysis } from '../lib/layout.ts';
import type { Plan } from '../lib/plan.ts';
import { TIME_ISSUE_TEXT } from '../lib/timeRules.ts';
import { formatMinutes } from '../lib/time.ts';
import { childGapText, clockAt, entryHeading, entryRoles, planRows } from '../components/planDisplay.ts';

export type ExportFormat = 'feed' | 'story';

export const FORMATS: Record<ExportFormat, { width: number; height: number; label: string }> = {
  feed: { width: 1080, height: 1350, label: 'Feed (1080 × 1350)' },
  story: { width: 1080, height: 1920, label: 'Story (1080 × 1920)' },
};

export interface ExportOptions {
  includeTitle: boolean;
  includeCustomText: boolean;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const M = 72; // side margin
const PAD = 28; // text inset inside a block
const INDENT = 44; // alongside-track indent
const GAP = 14; // between blocks
const SERIOUS = new Set(['water', 'food', 'suffocation', 'heat', 'traffic', 'falls', 'small-parts']);
const LINE = 1.3;

interface Line {
  text: string;
  font: string;
  size: number;
  color: string;
  gapBefore: number;
}

type Shade = 'routine' | 'soft' | 'plain' | 'gap' | 'head';

interface Block {
  lines: Line[];
  height: number;
  shade: Shade;
  indent: number;
  /** Don't end a page on this block (a track heading stays with its first entry). */
  keepWithNext?: boolean;
  /** For entries in an alongside track: the track's heading, repeated when a page starts mid-track. */
  track?: string;
}

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, f: string, maxWidth: number): string[] {
  ctx.font = f;
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      // Break a single over-long word by characters.
      if (!line && ctx.measureText(w).width > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          if (ctx.measureText(chunk + ch).width > maxWidth) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = test;
    } else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

export function siteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  const url = configured || `${window.location.origin}${window.location.pathname}`;
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** The supplied logo (504 px rendition), decoded before use. Same-origin, so the canvas stays exportable. */
export async function loadLogo(): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = assetUrl(BRAND_ASSETS.logo504);
    await img.decode();
    return img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
}

class Builder {
  lines: Line[] = [];
  private ctx: CanvasRenderingContext2D;
  private width: number;
  constructor(ctx: CanvasRenderingContext2D, width: number) {
    this.ctx = ctx;
    this.width = width;
  }
  push(text: string, weight: number, size: number, color: string, gapBefore = 0) {
    const f = font(weight, size);
    wrap(this.ctx, text, f, this.width).forEach((t, i) => this.lines.push({ text: t, font: f, size, color, gapBefore: i === 0 ? gapBefore : 0 }));
  }
  block(shade: Shade, indent: number, extra: Partial<Block> = {}): Block {
    const height = this.lines.reduce((h, l) => h + l.gapBefore + l.size * LINE, 0) + 36;
    return { lines: this.lines, height, shade, indent, ...extra };
  }
}

function entryBlock(ctx: CanvasRenderingContext2D, e: EntryAnalysis, plan: Plan, c: IndexedCatalog, opts: ExportOptions, width: number, indent: number): Block {
  const seg = e.item.segment;
  const b = new Builder(ctx, width - 2 * M - indent - PAD - 20);
  const show = { customText: opts.includeCustomText };
  const overhead = e.item.setup + e.item.cleanup;
  b.push(`${clockAt(plan, e.item.start)} – ${clockAt(plan, e.item.end)}  ·  ${seg.minutes} min${overhead ? ` + ${overhead} setup/tidy` : ''}`, 650, 28, UI.muted);
  const routine = seg.kind === 'routine';
  b.push(`${entryHeading(seg, plan, c, show)}${routine ? '  (estimate)' : ''}`, 750, routine || seg.kind === 'custom' || seg.kind === 'break' ? 36 : 40, UI.text, 4);
  const recipe = seg.kind === 'recipe' ? c.recipeById.get(seg.ref ?? '') : undefined;
  if (recipe) b.push(recipe.mode === 'together' ? 'Together' : 'Side by side', 600, 26, UI.muted, 2);
  const roles = entryRoles(plan, c, e, { customText: opts.includeCustomText ? undefined : false });
  roles.forEach((r, i) => b.push(`${r.who}: ${r.text}`, 450, 30, UI.text, i === 0 ? 8 : 4));
  if (e.timing.cue) {
    const who = plan.kids.length === 2 && seg.kind === 'recipe' ? `${childLabel(e.timing.cue.finding.child === 1 ? 1 : 0)}: ` : '';
    const good = e.timing.cue.tone === 'good';
    b.push(`${good ? '◆' : '◷'} ${who}${e.timing.cue.text}`, 650, 28, good ? UI.text : UI.safety, 8);
  }
  if (e.timeIssue) b.push(`! ${TIME_ISSUE_TEXT[e.timeIssue]}`, 550, 27, UI.safety, 6);
  for (const cf of e.conflicts) if (cf.kind !== 'timing' && cf.severity === 'conflict') b.push(`Check: ${cf.message}`, 600, 27, UI.danger, 6);
  if (seg.kind === 'activity' || recipe) {
    const act = seg.kind === 'activity' ? c.activityById.get(seg.ref ?? '') : undefined;
    const hazards = act ? act.hazards : recipe ? [recipe.younger.activity, recipe.older.activity].flatMap((id) => c.activityById.get(id)?.hazards ?? []) : [];
    const safety = (act?.safety ?? recipe?.safety ?? []).slice(0, hazards.some((h) => SERIOUS.has(h)) ? 2 : 1);
    safety.forEach((n, i) => b.push(`! ${n.text}`, 550, 27, UI.safety, i === 0 ? 8 : 2));
  }
  return b.block(routine ? 'routine' : seg.kind === 'break' || seg.kind === 'custom' ? 'soft' : 'plain', indent);
}

function gapBlock(ctx: CanvasRenderingContext2D, g: Gap, plan: Plan, width: number, indent: number): Block {
  const b = new Builder(ctx, width - 2 * M - indent - PAD - 20);
  b.push(`${clockAt(plan, g.start)} – ${clockAt(plan, g.end)}  ·  ${formatMinutes(g.end - g.start)}`, 650, 26, UI.muted);
  b.push(g.who === 'all' ? 'Open time' : childGapText(g, plan), g.who === 'all' ? 700 : 500, 28, UI.text, 2);
  return b.block('gap', indent);
}

function trackHead(ctx: CanvasRenderingContext2D, text: string, width: number): Block {
  const b = new Builder(ctx, width - 2 * M - INDENT - PAD);
  b.push(text, 750, 30, UI.text);
  return { ...b.block('head', INDENT), height: b.lines.reduce((h, l) => h + l.size * LINE, 0) + 8 };
}

export function planBlocks(ctx: CanvasRenderingContext2D, plan: Plan, analysis: PlanAnalysis, c: IndexedCatalog, opts: ExportOptions, width: number): Block[] {
  const blocks: Block[] = [];
  for (const row of planRows(plan, analysis)) {
    if (row.kind === 'entry') blocks.push(entryBlock(ctx, row.entry, plan, c, opts, width, 0));
    else if (row.kind === 'gap') blocks.push(gapBlock(ctx, row.gap, plan, width, 0));
    else {
      const heading = `While ${childLabel(row.hostLane)} ${row.verb} · ${childLabel(row.otherLane)}:`;
      // The routine, its track heading, and the first thing in the track stay together.
      if (blocks.length) blocks[blocks.length - 1].keepWithNext = true;
      blocks.push({ ...trackHead(ctx, heading, width), keepWithNext: row.items.length > 0 });
      for (const t of row.items) blocks.push({ ...(t.kind === 'entry' ? entryBlock(ctx, t.entry, plan, c, opts, width, INDENT) : gapBlock(ctx, t.gap, plan, width, INDENT)), track: heading });
    }
  }
  if (analysis.overrun > 0) {
    const b = new Builder(ctx, width - 2 * M - PAD - 20);
    b.push(`Runs ${formatMinutes(analysis.overrun)} past the ${formatMinutes(plan.window)} window`, 650, 28, UI.safety);
    blocks.push(b.block('soft', 0));
  }
  return blocks;
}

/**
 * Pack blocks onto pages without shrinking text. A block taller than a page gets
 * a page of its own. A page that starts inside an alongside track repeats the
 * track's heading, so the child labels still make sense.
 */
export function paginate(blocks: Block[], firstRoom: number, nextRoom: number, continued: (track: string) => Block = (t) => ({ lines: [], height: 0, shade: 'head', indent: INDENT, track: t })): Block[][] {
  const pages: Block[][] = [[]];
  let room = firstRoom;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const cur = pages[pages.length - 1];
    // Blocks that must stay with what follows (a routine, its track heading, the first entry) need room together.
    let need = b.height;
    for (let j = i; blocks[j]?.keepWithNext && blocks[j + 1]; j++) need += GAP + blocks[j + 1].height;
    if (need > nextRoom) need = b.height;
    if (need > room && cur.length > 0) {
      const head = b.track ? continued(b.track) : null;
      pages.push(head ? [head, b] : [b]);
      room = nextRoom - b.height - GAP - (head ? head.height + GAP : 0);
    } else {
      cur.push(b);
      room -= b.height + GAP;
    }
  }
  return pages;
}

export interface RenderedPage {
  blob: Blob;
  url: string;
  page: number;
  pages: number;
  width: number;
  height: number;
}

export async function renderPlanImages(plan: Plan, c: IndexedCatalog, format: ExportFormat, opts: ExportOptions): Promise<RenderedPage[]> {
  const { width, height } = FORMATS[format];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const logo = await loadLogo();

  const analysis = analyzePlan(plan, c);
  const end = Math.max(analysis.end, 0);
  const blocks = planBlocks(ctx, plan, analysis, c, opts, width);
  const title = opts.includeTitle && plan.title.trim() ? plan.title.trim() : 'Our plan';
  const ages = plan.kids.map((k, i) => `Child ${i + 1}: about ${formatAge(k.age)}`).join('   ·   ');
  const logoW = 228;
  const logoH = logoW / 3;

  const headerFirst = 330;
  const headerNext = 210;
  const footer = 124;
  const pages = paginate(blocks, height - headerFirst - footer, height - headerNext - footer, (track) => trackHead(ctx, `${track.replace(/:$/, '')} (continued):`, width));

  const url = siteUrl();
  const out: RenderedPage[] = [];
  for (let p = 0; p < pages.length; p++) {
    ctx.fillStyle = BRAND.white;
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'top';
    let y = 52;
    if (logo) ctx.drawImage(logo, M - 12, y, logoW, logoH);
    else {
      ctx.fillStyle = UI.text;
      ctx.font = font(800, 48);
      ctx.fillText('Trunk', M, y + 14);
    }
    y += logoH + 26;
    if (p === 0) {
      ctx.fillStyle = UI.text;
      for (const l of wrap(ctx, title, font(800, 54), width - 2 * M).slice(0, 2)) {
        ctx.font = font(800, 54);
        ctx.fillText(l, M, y);
        y += 66;
      }
      ctx.fillStyle = UI.muted;
      ctx.font = font(600, 28);
      ctx.fillText(`${clockAt(plan, 0)} – ${clockAt(plan, Math.max(end, plan.window))}  ·  ${formatMinutes(analysis.busy)} planned`, M, y + 4);
      y += 44;
      for (const l of wrap(ctx, ages, font(600, 28), width - 2 * M)) {
        ctx.font = font(600, 28);
        ctx.fillText(l, M, y);
        y += 36;
      }
      y = Math.max(y + 12, headerFirst);
    } else {
      ctx.fillStyle = UI.muted;
      ctx.font = font(650, 30);
      ctx.fillText(wrap(ctx, `${title} (continued)`, font(650, 30), width - 2 * M)[0], M, y);
      y = headerNext;
    }

    for (const b of pages[p]) {
      const x = M + b.indent;
      const w = width - M - x;
      if (b.shade !== 'head') {
        if (b.shade === 'routine' || b.shade === 'soft' || b.shade === 'gap') {
          ctx.fillStyle = b.shade === 'routine' ? UI.skySoft : UI.surface;
          ctx.fillRect(x, y, w, b.height);
        }
        if (b.shade === 'gap') {
          ctx.strokeStyle = UI.line;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.strokeRect(x + 1, y + 1, w - 2, b.height - 2);
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = b.shade === 'routine' || b.indent ? BRAND.sky : BRAND.forest;
          ctx.fillRect(x, y, b.shade === 'routine' ? 10 : 6, b.height);
        }
      }
      let ly = y + (b.shade === 'head' ? 0 : 18);
      for (const l of b.lines) {
        ly += l.gapBefore;
        ctx.font = l.font;
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, x + (b.shade === 'head' ? 0 : PAD), ly);
        ly += l.size * LINE;
      }
      y += b.height + GAP;
    }

    // Footer: estimated-times label, where it came from, and page numbers.
    ctx.strokeStyle = UI.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, height - footer + 12);
    ctx.lineTo(width - M, height - footer + 12);
    ctx.stroke();
    ctx.fillStyle = UI.muted;
    ctx.font = font(600, 26);
    ctx.fillText('Estimated times', M, height - footer + 30);
    ctx.fillStyle = UI.text;
    ctx.font = font(700, 28);
    ctx.fillText(url, M, height - footer + 66);
    if (pages.length > 1) {
      const label = `${p + 1} / ${pages.length}`;
      ctx.fillText(label, width - M - ctx.measureText(label).width, height - footer + 66);
    }

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'));
    out.push({ blob, url: URL.createObjectURL(blob), page: p + 1, pages: pages.length, width, height });
  }
  return out;
}
