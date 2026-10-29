/**
 * Trunk brand: the single source for brand colours and asset paths, used by the
 * UI (styles.css mirrors these as CSS tokens; tests/brand.test.ts keeps them in
 * sync) and by canvas exports.
 *
 * Assets come from the supplied brand kit. Masters (public/brand/trunk-logo.png,
 * trunk-icon.png) are kept unchanged; scripts/brand-assets.py makes the small
 * web renditions in public/brand/web/. Never redraw the mark or wordmark.
 */
export const BRAND = {
  forest: '#163e35',
  sky: '#6babc4',
  white: '#ffffff',
} as const;

/**
 * Interface tokens derived from the brand colours. Forest carries text and
 * primary actions (white labels on forest buttons). Sky is for supporting
 * accents and soft backgrounds with forest text on them; it never carries white
 * text. Warning and error colours stay distinct from the brand and keep at
 * least 4.5:1 contrast on their backgrounds.
 *
 * styles.css declares each of these as `--<kebab-case name>` on :root.
 */
export const UI = {
  canvas: BRAND.white,
  text: BRAND.forest,
  action: BRAND.forest,
  actionStrong: '#0f2e27',
  onAction: BRAND.white,
  sky: BRAND.sky,
  skySoft: '#e8f3f8',
  skyLine: '#b5d8e6',
  muted: '#4a5f58',
  line: '#d6e2df',
  surface: '#f4f8f7',
  safety: '#7a4300',
  safetySoft: '#fff5e6',
  safetyLine: '#f0d4a8',
  danger: '#a3271f',
  dangerSoft: '#fdecea',
  dangerLine: '#f1b5ae',
  /** Borders of form fields and buttons (3:1 against the canvas). */
  fieldLine: '#7d958d',
} as const;

/** Intrinsic size of the logo master (3:1, transparent padding included). */
export const LOGO_RATIO = 2172 / 724;

export const BRAND_ASSETS = {
  logo168: 'brand/web/trunk-logo-168.png',
  logo336: 'brand/web/trunk-logo-336.png',
  logo504: 'brand/web/trunk-logo-504.png',
  icon32: 'brand/web/trunk-icon-32.png',
  icon48: 'brand/web/trunk-icon-48.png',
  icon180: 'brand/web/trunk-icon-180.png',
  icon192: 'brand/web/trunk-icon-192.png',
  icon512: 'brand/web/trunk-icon-512.png',
} as const;

/** URL for a public asset that works under any GitHub Pages base path (Vite base is './'). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
