/**
 * Brand tokens have one source (src/brand.ts). styles.css mirrors them as CSS
 * custom properties, and index.html points at the generated icon renditions.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND, BRAND_ASSETS, UI } from '../src/brand.ts';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function rootTokens(css: string): Map<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css);
  if (!block) throw new Error('styles.css has no :root block');
  const out = new Map<string, string>();
  for (const m of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim().toLowerCase());
  return out;
}

describe('brand tokens', () => {
  const css = read('src/styles.css');
  const tokens = rootTokens(css);

  it('declares the brand colours exactly as src/brand.ts', () => {
    expect(BRAND.forest).toBe('#163e35');
    expect(BRAND.sky).toBe('#6babc4');
    for (const [key, value] of Object.entries(BRAND)) expect(tokens.get(`--brand-${kebab(key)}`), key).toBe(value);
  });

  it('declares every interface token with the value in src/brand.ts', () => {
    for (const [key, value] of Object.entries(UI)) expect(tokens.get(`--${kebab(key)}`), key).toBe(value);
  });

  it('puts forest text and primary actions on the brand colours', () => {
    expect(UI.text).toBe(BRAND.forest);
    expect(UI.action).toBe(BRAND.forest);
    expect(UI.onAction).toBe(BRAND.white);
    expect(UI.sky).toBe(BRAND.sky);
  });

  it('no longer uses the old blue accent or the drawn mascot colours', () => {
    for (const file of ['src/styles.css', 'src/export/render.ts', 'index.html']) {
      const text = read(file).toLowerCase();
      for (const old of ['#2457a6', '#1b4380', '#eaf1fb', '#7f9cc6', '#b9cbe6']) expect(text, `${file} ${old}`).not.toContain(old);
    }
  });

  it('keeps readable contrast for text tokens', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    expect(ratio(UI.text, UI.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.onAction, UI.action)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.text, UI.skySoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.text, UI.sky)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.muted, UI.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.muted, UI.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.muted, UI.skySoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.safety, UI.safetySoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.danger, UI.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.danger, UI.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(UI.fieldLine, UI.canvas)).toBeGreaterThanOrEqual(3);
    // White on pale sky is never readable; the UI never pairs them.
    expect(ratio(BRAND.white, UI.sky)).toBeLessThan(4.5);
  });
});

describe('brand assets', () => {
  const html = read('index.html');

  it('index.html links the icon renditions with relative paths', () => {
    expect(html).toContain(`href="./${BRAND_ASSETS.icon32}"`);
    expect(html).toContain(`href="./${BRAND_ASSETS.icon192}"`);
    expect(html).toMatch(new RegExp(`rel="apple-touch-icon"[^>]*href="\\./${BRAND_ASSETS.icon180.replace(/\./g, '\\.')}"`));
    expect(html).not.toContain('favicon.svg');
    expect(html).not.toMatch(/href="\/(?!\/)/);
  });

  it('every referenced rendition exists in public/', () => {
    for (const path of Object.values(BRAND_ASSETS)) expect(existsSync(join(root, 'public', path)), path).toBe(true);
    expect(existsSync(join(root, 'public', 'favicon.svg'))).toBe(false);
  });

  it('logo renditions keep the master proportions (3:1)', () => {
    for (const path of [BRAND_ASSETS.logo168, BRAND_ASSETS.logo336, BRAND_ASSETS.logo504]) {
      const buf = readFileSync(join(root, 'public', path));
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(Math.abs(w / h - 2172 / 724), path).toBeLessThan(0.02);
    }
  });
});
