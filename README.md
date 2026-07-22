# Tailwind OKLCH Palette Lab

A TypeScript palette generator and technical Vue editor calibrated against the complete Tailwind CSS color dataset.

Give it any CSS color—hex, RGB, HSL, or OKLCH—and it generates the Tailwind shade sequence `50` through `950`. The editor keeps raw OKLCH as its single source of truth while exposing OKLCH, HSL, and HSV editing views.

## Palette workflow

1. Enter a seed color and choose whether it must remain an exact shade or may be fitted to the canonical curve.
2. Inspect the nearest Tailwind reference palettes as independently styled curve overlays.
3. Borrow lightness, chroma/saturation, or hue from any reference:
   - **Values** moves toward the literal reference values.
   - **Shape** transfers the reference curve relative to the protected anchor.
4. Shape chroma independently for light, middle, and dark tonal bands; optionally stabilize dark hues toward the anchor.
5. Smooth a selected channel with local Savitzky–Golay regularization.
6. Preview every bulk operation before applying it, validate gamut/contrast/spacing warnings, then export Tailwind, CSS, or JSON tokens.

All committed operations and direct curve edits are recorded in undo/redo history. Reference overlays and the generated baseline never mutate the working palette.

## Run locally

Requires Node.js `^22.18.0` or `>=24.12.0` and npm `12.0.1`.

```sh
vp install
vp dev
```

Open [http://localhost:5173](http://localhost:5173).

## Verify

```sh
vp test
vp run type-check
vp build
```

The test suite covers parsing, gamut mapping, reference calibration, generation invariants, nearest-reference ranking, channel borrowing, tonal chroma shaping, hue stabilization, and curve smoothing.

## CLI

The underlying generator remains available as a TypeScript CLI:

```sh
vp run palette primary '#89E5D2' --seed exact --at auto
vp run palette primary 'oklch(89.7% 0.196 126.665)' --at 300
```

Run `vp run palette --help` for all options.
