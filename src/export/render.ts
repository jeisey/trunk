/**
 * Plan → PNG pages, drawn on a canvas on the user's device.
 * Loaded only when the parent asks for images.
 *
 * Text never shrinks below a legible size to fit; long plans paginate, and
 * every entry appears on some page.
 */
import type { IndexedCatalog } from '../content/catalog.ts';
import { formatAge } from '../lib/age.ts';
import { adultText } from '../lib/labels.ts';
import { BREAK_HINT, type Plan } from '../lib/plan.ts';
import { timeline, type TimedSegment } from '../lib/layout.ts';
import { formatClock, parseHHMM } from '../lib/time.ts';

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
const COLORS = { text: '#16332a', muted: '#4b5f57', accent: '#2457a6', line: '#dbe3df', safety: '#7a4300', surface: '#f5f8f6', mascot: '#7f9cc6', ear: '#b9cbe6', leaf: '#3f8a5f' };
const M = 72; // side margin
const SERIOUS = new Set(['water', 'food', 'suffocation', 'heat', 'traffic', 'falls', 'small-parts']);
const LINE = 1.3;

interface Line {
  text: string;
  font: string;
  size: number;
  color: string;
  gapBefore?: number;
  indent?: number;
}

interface Block {
  lines: Line[];
  height: number;
  shaded: boolean;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string[] {
  ctx.font = font;
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

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

export function siteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  const url = configured || `${window.location.origin}${window.location.pathname}`;
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function entryBlock(ctx: CanvasRenderingContext2D, t: TimedSegment, plan: Plan, c: IndexedCatalog, opts: ExportOptions, width: number): Block {
  const seg = t.segment;
  const inner = width - 2 * M - 40;
  const lines: Line[] = [];
  const push = (text: string, weight: number, size: number, color: string, gapBefore = 0, indent = 0) => {
    const f = font(weight, size);
    wrap(ctx, text, f, inner - indent).forEach((l, i) => lines.push({ text: l, font: f, size, color, gapBefore: i === 0 ? gapBefore : 0, indent }));
  };
  const ages = plan.kids.map((k) => formatAge(k.age));
  push(`${formatClock(t.start)} – ${formatClock(t.end)}  ·  ${seg.minutes} min${t.setup + t.cleanup ? ` + ${t.setup + t.cleanup} setup/tidy` : ''}`, 650, 28, COLORS.muted);
  if (seg.kind === 'activity') {
    const a = c.activityById.get(seg.ref ?? '');
    push(a?.title ?? 'Activity', 750, 40, COLORS.text, 4);
    if (a) {
      push(`Child 1: ${a.summary}`, 450, 30, COLORS.text, 6);
      push(`You: ${adultText(a.supervision)}`, 450, 30, COLORS.text, 4);
      // Records with serious hazards show their two leading (sourced) safety notes.
      const notes = a.hazards.some((h) => SERIOUS.has(h)) ? a.safety.slice(0, 2) : a.safety.slice(0, 1);
      notes.forEach((n, i) => push(`! ${n.text}`, 550, 27, COLORS.safety, i === 0 ? 6 : 2));
    }
  } else if (seg.kind === 'recipe') {
    const r = c.recipeById.get(seg.ref ?? '');
    push(`${r?.title ?? 'Together'}${r ? (r.mode === 'together' ? '  (together)' : '  (side by side)') : ''}`, 750, 40, COLORS.text, 4);
    if (r) {
      const y = seg.younger === 'c2' ? 1 : 0;
      const o = y === 0 ? 1 : 0;
      push(`Child ${y + 1} (${ages[y]}): ${r.younger.does}`, 450, 30, COLORS.text, 6);
      push(`Child ${o + 1} (${ages[o]}): ${r.older.does}`, 450, 30, COLORS.text, 4);
      push(`You: ${r.adult.does}`, 450, 30, COLORS.text, 4);
      push(`! ${r.safety[0].text}`, 550, 27, COLORS.safety, 6);
    }
  } else if (seg.kind === 'break') {
    push(seg.label || 'Flexible break', 750, 36, COLORS.text, 4);
    push(BREAK_HINT, 450, 28, COLORS.muted, 4);
  } else {
    push(opts.includeCustomText && seg.label ? seg.label : 'Your own activity', 750, 36, COLORS.text, 4);
    const who = seg.who === 'c1' ? 'Child 1' : seg.who === 'c2' ? 'Child 2' : plan.kids.length === 2 ? 'Both' : 'Child 1';
    push(`${who} · parent’s own entry`, 450, 28, COLORS.muted, 4);
  }
  const height = lines.reduce((h, l) => h + (l.gapBefore ?? 0) + l.size * LINE, 0) + 40;
  return { lines, height, shaded: seg.kind === 'break' || seg.kind === 'custom' };
}

function drawMascot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.mascot;
  ctx.fill(new Path2D('M8 38c0-12 9-20 21-20h8c2.8 0 5 2.2 5 5v17c0 3-2.2 5-5 5h-1v6h-6v-6h-9v6h-6v-6.6C10 42.6 8 40.5 8 38z'));
  ctx.beginPath();
  ctx.arc(44, 24, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ear;
  ctx.fill(new Path2D('M33.5 15c-6.5 0-10 5.5-10 11.5S27.5 37 33.5 37c3 0 5-2.2 5-5V20c0-2.8-2.2-5-5-5z'));
  ctx.strokeStyle = COLORS.mascot;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D('M54.5 27c3.4 2.4 4.4 6.6 3.2 10.4-1.1 3.6-4.4 5.4-7.4 4.4'));
  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.arc(47.5, 21, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.leaf;
  ctx.fill(new Path2D('M49.6 41.4c-1.6-2.6-.6-5.6 2.2-6.6.9 2.9-.2 5.6-2.2 6.6z'));
  ctx.restore();
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

  const items = timeline(plan, c);
  const startMin = parseHHMM(plan.start);
  const endMin = items.length ? items[items.length - 1].end : startMin;
  const blocks = items.map((t) => entryBlock(ctx, t, plan, c, opts, width));
  const title = opts.includeTitle && plan.title.trim() ? plan.title.trim() : 'Our plan';
  const ages = plan.kids.map((k, i) => `Child ${i + 1}: about ${formatAge(k.age)}`).join('   ·   ');

  const headerFirst = 300;
  const headerNext = 250;
  const footer = 150;

  // Paginate: pack blocks into pages without shrinking text.
  const pages: Block[][] = [[]];
  let room = height - headerFirst - footer;
  for (const b of blocks) {
    const cur = pages[pages.length - 1];
    if (b.height > room && cur.length > 0) {
      pages.push([b]);
      room = height - headerNext - footer - b.height - 16;
    } else {
      cur.push(b);
      room -= b.height + 16;
    }
  }

  const url = siteUrl();
  const out: RenderedPage[] = [];
  for (let p = 0; p < pages.length; p++) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    let y = 64;
    drawMascot(ctx, M, y - 8, 1.25);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(800, 40);
    ctx.textBaseline = 'top';
    ctx.fillText('Trunk', M + 92, y);
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(500, 26);
    ctx.fillText('A little help for the next hour', M + 92, y + 48);
    y += 112;
    if (p === 0) {
      ctx.fillStyle = COLORS.text;
      for (const l of wrap(ctx, title, font(800, 54), width - 2 * M).slice(0, 2)) {
        ctx.font = font(800, 54);
        ctx.fillText(l, M, y);
        y += 66;
      }
      ctx.fillStyle = COLORS.muted;
      ctx.font = font(550, 28);
      ctx.fillText(`${formatClock(startMin)} – ${formatClock(endMin)}`, M, y + 4);
      y += 44;
      for (const l of wrap(ctx, ages, font(550, 28), width - 2 * M)) {
        ctx.font = font(550, 28);
        ctx.fillText(l, M, y);
        y += 36;
      }
      y = Math.max(y + 10, headerFirst);
    } else {
      ctx.fillStyle = COLORS.muted;
      ctx.font = font(650, 30);
      ctx.fillText(wrap(ctx, `${title} (continued)`, font(650, 30), width - 2 * M)[0], M, y + 4);
      y = headerNext;
    }

    for (const b of pages[p]) {
      if (b.shaded) {
        ctx.fillStyle = COLORS.surface;
        ctx.fillRect(M, y, width - 2 * M, b.height);
      }
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(M, y, 6, b.height);
      let ly = y + 20;
      for (const l of b.lines) {
        ly += l.gapBefore ?? 0;
        ctx.font = l.font;
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, M + 28 + (l.indent ?? 0), ly);
        ly += l.size * LINE;
      }
      y += b.height + 16;
    }

    // Footer
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, height - footer + 20);
    ctx.lineTo(width - M, height - footer + 20);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(500, 26);
    ctx.fillText('Source-informed ideas, not medical advice. Times are estimates;', M, height - footer + 40);
    ctx.fillText('follow your child’s cues.', M, height - footer + 74);
    ctx.fillStyle = COLORS.accent;
    ctx.font = font(700, 28);
    ctx.fillText(url, M, height - footer + 108);
    if (pages.length > 1) {
      ctx.fillStyle = COLORS.text;
      ctx.font = font(700, 28);
      const label = `${p + 1} / ${pages.length}`;
      ctx.fillText(label, width - M - ctx.measureText(label).width, height - footer + 108);
    }

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'));
    out.push({ blob, url: URL.createObjectURL(blob), page: p + 1, pages: pages.length, width, height });
  }
  return out;
}
