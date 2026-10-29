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
