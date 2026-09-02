# Lupinum Colors

A Tailwind shade generator and technical Vue editor calibrated against the complete Tailwind CSS color dataset.

Give it any CSS color—hex, RGB, HSL, or OKLCH—and it generates the Tailwind shade sequence `50` through `950`. The editor keeps raw OKLCH as its single source of truth while exposing OKLCH, HSL, and HSV editing views.

The public product name is **Lupinum Colors**, the tool is described as the **Tailwind shade generator**, and the canonical production URL is `https://colors.lupinum.com/`.

## Palette workflow

1. Enter a seed color and choose whether it must remain an exact shade or may be fitted to the canonical curve.
2. Inspect the nearest Tailwind reference palettes as independently styled curve overlays.
3. Edit lightness, chroma/saturation, and hue directly on the curve with pointer or keyboard controls.
4. Refine the light and dark ends of the scale, including tint retention and the number of neighboring shades in the blend.
5. Preview the palette in realistic interfaces and inspect every foreground/background pair in the contrast matrix.
6. Apply or discard scale-end previews, use undo/redo for committed edits, then export Tailwind, CSS, or JSON tokens.

All committed operations and direct curve edits are recorded in undo/redo history. Reference overlays and the generated baseline never mutate the working palette.

## Run locally

Requires Node.js `^22.18.0` or `>=24.12.0` and npm `12.0.1`.

```sh
vp install
vp dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production output

`vp run build` creates a static client bundle, renders the Vue application once on the server during the build, and inserts that HTML into `dist/index.html`. Hosting still requires only static files; there is no production Node.js server.

The generated page hydrates into the normal interactive Vue application in the browser. Search engines and link preview crawlers receive the complete product copy without waiting for JavaScript rendering.

## Verify

```sh
vp check
vp test
vp run build
```

The test suite covers parsing, gamut mapping, reference calibration, generation invariants, nearest-reference ranking, endpoint shaping, edit history, contrast analysis, and token output.

## CLI

The underlying generator remains available as a TypeScript CLI:

```sh
vp run palette primary '#89E5D2' --seed exact --at auto
vp run palette primary 'oklch(89.7% 0.196 126.665)' --at 300
```

Run `vp run palette --help` for all options.

## Release preparation

See [LAUNCH.md](./LAUNCH.md) for the positioning, search strategy, launch copy, campaign drafts, measurement plan, and manual release checklist. The repository does not deploy or publish automatically.
