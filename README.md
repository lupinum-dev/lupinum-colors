# Tailwind-calibrated shade generator

A deterministic TypeScript library and CLI that generates Tailwind-style
`50–950` palettes from any CSS color. It learns lightness, chroma, and circular
hue trajectories from Tailwind's complete color families, then applies explicit
constraints and gamut mapping.

## Install and run

```bash
npm install
npm run build
npm run dev -- primary "#89E5D2" --explain --inspect
```

### Exact seed

The input appears unchanged at its natural or explicit shade:

```bash
npm run dev -- primary "#89E5D2" --seed exact --at auto
npm run dev -- primary "#89E5D2" --seed exact --at 300
```

For `#89E5D2`, automatic placement selects `300` and preserves the hex exactly.
Explicit unnatural placement is allowed but produces a warning.

### Canonical seed

The input supplies the family hue; the engine calculates what that color would
look like at a canonical Tailwind shade:

```bash
npm run dev -- primary "#89E5D2" --seed canonical
npm run dev -- primary "#89E5D2" --seed canonical --at 500
```

Canonical mode defaults to `500`. The pale mint seed above produces a stronger
mint `500` between Tailwind emerald and teal rather than inserting the seed.

### Hue trajectories

`balanced` uses the fitted continuous hue trajectory. A chromatic input can also
use either neighboring Tailwind family's normalized hue path:

```bash
npm run dev -- primary "#89E5D2" --hue-path balanced
npm run dev -- primary "#89E5D2" --hue-path emerald
npm run dev -- primary "#89E5D2" --hue-path teal
npm run dev -- primary "#89E5D2" --variants
```

`--explain` reports the valid dynamic neighbor names for the input.

## Input and output

Accepted inputs include hex, `rgb()`, `hsl()`, `oklab()`, `oklch()`, and
`color(display-p3 ...)`.

```bash
# Full JSON result, including raw/mapped colors and diagnostics
npm run dev -- brand "rgb(30 140 220)" --format json

# CSS custom properties
npm run dev -- brand "hsl(205 76% 49%)" --format css

# Tailwind v4 theme variables
npm run dev -- brand "oklch(62% 0.19 245)" --format tailwind
```

Gamut targets:

```bash
--gamut srgb        # default; emits hex and OKLCH
--gamut display-p3  # wider-gamut mapped OKLCH
--gamut none        # raw model values, useful for analysis
```

`--inspect` adds adjacent OKLab distance, contrast against black and white, and
per-shade gamut compression to the terminal table. JSON always contains the full
result.

## Library API

```ts
import { generatePalette } from "tailwind-oklch-palette";

const palette = generatePalette({
  name: "primary",
  color: "#89E5D2",
  seed: "exact",
  anchor: "auto",
  huePath: "balanced",
  gamut: "srgb",
});

console.log(palette.configuration.anchor); // 300
console.log(palette.shades[300].hex);       // #89e5d2
```

Each shade contains:

- canonical raw OKLCH;
- gamut-mapped OKLCH and CSS text;
- hex when targeting sRGB;
- whether mapping was required and how much chroma was removed;
- adjacent OKLab distance;
- WCAG contrast against white and black.

The result also explains anchor confidence, neighbor families, hue path,
Tailwind reference version, and quality warnings.

## Model

The generator uses one source of truth: a reproducible fixture derived from the
pinned Tailwind `theme.css`.

```bash
npm run reference:build
npm run reference:verify
```

Chromatic palettes use periodic four-neighbor cubic interpolation over Tailwind's
17 chromatic families. Lightness, chroma, and circular hue movement have
independently cross-validated, anchor-specific tangent scales, with overshoot
bounded by the two local reference families. Exact mode then anchors the trajectory using
piecewise-relative lightness and chroma transforms. Near-achromatic colors use a
separate model built from Tailwind's neutral families.

The original two-neighbor linear MVP is the recorded baseline. The production
model is accepted only when leave-one-family-out tests improve both aggregate and
worst-case behavior. Achromatic inputs use Tailwind neutral directly; tinted
neutrals continuously interpolate the neighboring neutral-temperature profiles.

## Verification

```bash
npm run typecheck
npm test
npm run benchmark
npm run build
```

Vitest covers:

- all accepted color syntaxes and gamut mapping;
- exact and canonical seed semantics;
- automatic anchor confidence;
- balanced and neighboring hue variants;
- chromatic and neutral routing;
- exact reconstruction of known Tailwind palettes from every anchor;
- leave-one-family-out reconstruction across all families and anchors;
- held-out anchor inference;
- 10,000 deterministic randomized palettes and structural invariants;
- CLI parsing and output formats.

Current held-out gates:

```text
all-anchor mean OKLab error < 0.0183
worst palette error          < 0.064
anchor inference accuracy   >= 98%
```

Tailwind palettes are art-directed, so arbitrary generated palettes are
Tailwind-calibrated rather than official Tailwind colors.
