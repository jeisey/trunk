# Trunk brand kit

A calm, friendly elephant identity for the Trunk parenting activity finder.

## Files and dimensions

| File | Format | Intrinsic size | Intended use |
| --- | --- | --- | --- |
| `public/brand/trunk-logo.png` | RGBA PNG, transparent | 2172 × 724 px (3:1) | Header wordmark, plan exports, light-background brand lockup |
| `public/brand/trunk-icon.png` | RGBA PNG, transparent | 1254 × 1254 px | Standalone elephant, favicon/app-icon source, compact branding |
| `src/styles/trunk-brand.css` | CSS | — | Exact UI palette tokens |
| `asset-manifest.json` | JSON | — | Dimensions, file sizes, transparency verification, SHA-256 hashes |
| `GENERATION.md` | Markdown | — | Original generation prompts and method |

Both PNGs have genuine alpha transparency, including fully transparent corners. They are raster source assets with antialiased edges and slight generated color variation. The CSS tokens below are the exact palette targets, not a claim that every raster pixel has one of two identical RGB values. Neither image is an SVG/vector master.

## Palette and style

- Forest: **#163E35** — wordmark, main silhouette, body text, primary buttons.
- Sky: **#6BABC4** — ear, decorative accents, soft supporting surfaces.
- White: **#FFFFFF** — preferred website canvas.

Rounded, simple, geometric, friendly, and practical. Use the forest color for readable text; keep sky primarily decorative. Put white labels on forest buttons. The master logo is designed for light backgrounds. Keep its proportions, clear space, and color identity; use its original transparent background.

## Claude Code handoff

Copy this kit's `public/brand/` directory into the application's `public/brand/`. Merge the optional CSS tokens into the app's styling convention.

Read this before implementing branding:

> Use the supplied Trunk logo and elephant PNGs as the brand assets. This replaces the earlier build-prompt suggestion to invent a new SVG elephant. Do not redraw the mascot, replace it with an emoji, or regenerate the wordmark. Use the horizontal logo in the header and the standalone mark where the wordmark would be too small. Preserve aspect ratios. The PNGs are high-resolution source assets; generate lightweight appropriately sized web renditions during implementation and keep the masters. Validate appearance on a light background and at actual mobile sizes. Respect GitHub Pages repository base paths for every asset URL. Use the exact CSS brand colors for UI styling. Read the intrinsic sizes from asset-manifest.json.

Suggested initial display sizes:

- Header logo: **168 × 56 CSS pixels**, or **192 × 64** where space permits. Its transparent padding is part of the master.
- Standalone icon: **32–48 CSS pixels** in the interface; inspect legibility if used smaller.
- For production, derive logo assets at the chosen CSS size and 2× density, and favicon/app-icon sizes such as 32, 48, 180, 192, and 512 px from the icon master. Recheck transparency, margins, and small-size legibility after conversion.
- Use explicit intrinsic dimensions/aspect ratio to reserve layout space. Lazy-load secondary branding, not the visible header logo.
- Where a light logo is required on dark surfaces, make a separately reviewed variant; do not rely on arbitrary CSS inversion.

Vite/React example using the supplied source image:

```tsx
<img
  src={`${import.meta.env.BASE_URL}brand/trunk-logo.png`}
  width={2172}
  height={724}
  style={{ width: 168, height: "auto", display: "block" }}
  alt="Trunk"
/>
```

For a standalone elephant beside visible “Trunk” text, use an empty alt attribute so a screen reader does not repeat the brand. A home link containing only the mark needs an accessible name such as “Trunk home”.

The source PNGs are roughly 525 KiB and 621 KiB; do not load full-size masters everywhere. Produce smaller web renditions for the final application and preserve these files as the source of truth.

## Verification and provenance

Created with the built-in image-generation tool, then copied unchanged into this kit. Dimensions, PNG format, alpha range, transparent corners, and archive integrity were checked locally. Full generation prompts are included in GENERATION.md. No trademark or domain-availability clearance is implied.

