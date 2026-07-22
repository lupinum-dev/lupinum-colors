# Tailwind-style OKLCH palette CLI

Generate an 11-shade, Tailwind-style palette from any OKLCH color. The input is
kept exactly at its anchor shade; the remaining colors interpolate the normalized
lightness, chroma, and hue trajectories of the neighboring Tailwind color families.

```bash
npm install
npm run dev -- primary "oklch(89.7% 0.196 126.665)" --at 300
```

Let the CLI infer the most plausible anchor:

```bash
npm run dev -- brand "oklch(62% 0.19 245)"
```

Generate CSS variables or JSON:

```bash
npm run dev -- brand "oklch(62% 0.19 245)" --at 500 --format css
npm run dev -- brand "oklch(62% 0.19 245)" --at 500 --format json
```

The generator uses Tailwind's installed `theme.css` as its single canonical
training dataset. It excludes neutral families because hue interpolation is not
meaningful for near-zero chroma palettes.

## How the interpolation works

For every Tailwind family, the generator measures each shade relative to the
chosen anchor: movement toward black or white, chroma ratio, and circular hue
offset. It locates the input hue between two Tailwind families and interpolates
those normalized trajectories. Lightness is rescaled against the room available
above and below the input, so unusual anchor lightness values remain ordered and
inside the valid OKLCH range.

The tests include a leave-one-family-out benchmark: each chromatic Tailwind
family is removed and reconstructed using only its two hue neighbors. This guards
against an implementation that merely looks up known Tailwind values.
