---
name: Tailwind OKLCH Palette
description: A precise theme-aware workbench for shaping tonal curves, previewing interfaces, and exporting production-ready color tokens.
colors:
  instrument-black: 'oklch(0.115 0 0)'
  instrument-white: 'oklch(0.985 0 0)'
  panel: 'oklch(0.155 0 0)'
  popover: 'oklch(0.18 0 0)'
  action: 'oklch(0.922 0 0)'
  action-ink: 'oklch(0.205 0 0)'
  secondary: 'oklch(0.22 0 0)'
  muted: 'oklch(0.195 0 0)'
  muted-ink: 'oklch(0.72 0 0)'
  accent: 'oklch(0.22 0 0)'
  destructive: 'oklch(0.704 0.191 22.216)'
  quiet-border: 'oklch(1 0 0 / 12%)'
  field-border: 'oklch(1 0 0 / 15%)'
  focus-ring: 'oklch(0.556 0 0)'
typography:
  headline:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.01em'
  title:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: '0.07em'
  body:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 'normal'
  data:
    fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, monospace'
    fontSize: '11px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 'normal'
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
components:
  button-primary:
    backgroundColor: '{colors.action}'
    textColor: '{colors.action-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 10px'
    height: '36px'
  button-outline:
    backgroundColor: '{colors.instrument-black}'
    textColor: '{colors.instrument-white}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 10px'
    height: '36px'
  input:
    backgroundColor: '{colors.instrument-black}'
    textColor: '{colors.instrument-white}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '4px 10px'
    height: '36px'
  card:
    backgroundColor: '{colors.panel}'
    textColor: '{colors.instrument-white}'
    rounded: '{rounded.xl}'
    padding: '16px'
  badge-outline:
    backgroundColor: 'transparent'
    textColor: '{colors.instrument-white}'
    typography: '{typography.data}'
    rounded: '{rounded.pill}'
    padding: '2px 8px'
    height: '20px'
---

# Design System: Tailwind OKLCH Palette

## Overview

**Creative North Star: "The Calibrated Instrument"**

This interface is a precise color instrument, not a decorated dashboard. It uses a canonical shadcn neutral workbench with persistent light and dark modes, so controls stay familiar, compact, and quiet while the palette canvas remains the dominant visual event. The product feels technical, analytical, and direct without becoming sterile.

Structure follows the work itself: establish the source, shape the curve, select and inspect a tonal range, then copy production-ready tokens. Dense controls are acceptable when they clarify that sequence; ornamental panels, promotional composition, and unexplained color effects are not.

**Key Characteristics:**

- Neutral light and dark surfaces keep attention on the editable palette.
- Compact controls expose precision without inflating the interface.
- Quiet borders and tonal layering separate regions with minimal visual noise.
- Color, line patterns, markers, labels, and order identify data together.
- A wide editing canvas leads; the inspector supports it from a fixed-width rail.

## Colors

The workbench is deliberately achromatic in both themes. Neutral surfaces and restrained contrast make the generated palette, curves, warnings, reference overlays, and live preview the only saturated regions.

### Primary

- **Instrument White:** The high-contrast action surface and strongest text color. It marks decisive actions such as Generate and Apply without introducing a competing brand hue.
- **Action Ink:** Near-black copy on Instrument White actions preserves the inverse control treatment.

### Secondary

- **Control Graphite:** The selected state for low-emphasis segmented controls and the fill for secondary actions.
- **Raised Graphite:** The restrained hover and expanded-state surface used by ghost controls.

### Tertiary

- **Signal Red:** Reserved for destructive actions and errors. Amber is used locally for warnings; neither color becomes general decoration.

### Neutral

- **Instrument Black:** The application ground and input bed.
- **Panel:** The standard card, inspector, and toolbar surface.
- **Popover:** A slightly higher tonal layer for floating content.
- **Muted Graphite:** Quiet control groups and subdued containers.
- **Muted Ink:** Secondary descriptions, hints, inactive labels, and nonessential icons.
- **Quiet Border:** The primary structural divider, visible enough to clarify grouping without outlining every element loudly.
- **Field Border:** A slightly stronger boundary for interactive fields.
- **Focus Ring:** A neutral midtone halo for keyboard focus; the canvas uses a cool blue focus stroke where a neutral ring would disappear.

### Named Rules

**The Canvas Owns Color Rule.** Saturated color belongs to palette data, channel curves, reference overlays, status, and generated swatches. Workbench chrome stays neutral.

**The Redundancy Rule.** Never use hue alone to communicate meaning. Pair it with text, position, marker shape, line pattern, or state geometry.

## Typography

**Display Font:** Geist (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)  
**Body Font:** Geist (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)  
**Label/Mono Font:** Geist Mono (with `ui-monospace`, `SFMono-Regular`, and `monospace` fallbacks)

**Character:** Geist keeps the workbench compact, neutral, and highly legible. Geist Mono separates exact values, color syntax, keyboard commands, history indexes, and export output from explanatory interface copy.

### Hierarchy

- **Headline:** Semibold and compact; used for the application name and primary workbench headings.
- **Title:** Small, semibold, tracked, and uppercase in inspector section headers; use it as an instrument label, not as decorative display type.
- **Body:** The default size for descriptions and control text, with relaxed line height where instructions need two lines.
- **Label:** Medium-weight, short field labels and compact button copy.
- **Data:** Monospaced values, hex and OKLCH readouts, badges, keyboard hints, and code export.

### Named Rules

**The Measured Type Rule.** Use sans-serif for intent and mono for measurable values. Do not use mono as a blanket “technical” texture.

## Layout

The application is a responsive workstation inside one shared shell capped at 2880px. The 52px toolbar and content use the same edges. Page insets are 16px on mobile, 24px on standard desktops, and 32px on very wide displays.

Below 1280px the source, canvas, and inspector follow one semantic column. From 1280px the source spans a canvas-plus-360px-inspector layout. From 1792px the source becomes a sticky 288–320px rail, the canvas receives all flexible width, and the inspector grows between 360px and 420px. On small screens the inspector opens in a bottom sheet.

The editor preserves a minimum internal width of 720px and scrolls horizontally only inside its own frame. Its height grows from a 480px laptop floor through 760px on standard desktops and up to 920px on large displays. Selected-shade values belong to the Selection inspector instead of a separate card below the canvas.

Preview, Contrast, and Tokens share one tabbed analysis work plane below the editor. Preview combines a realistic product workspace with a diagnostic component specimen; its Auto, Light, and Dark appearance is independent from the surrounding app. Structural preview surfaces remain neutral and the generated scale is applied only to explicit color roles.

The contrast analysis compares white, all eleven palette shades, and black in a complete 13×13 matrix. A selected-pair rail exposes the exact ratio, UI/AA/AAA outcomes, realistic rendering, swap behavior, and accessible alternatives. The matrix uses one roving keyboard tab stop, retains every cell under filtering, and scrolls only inside its own viewport.

**The Dominant Canvas Rule.** The canvas receives all flexible width. Supporting controls may stack, scroll, or move below it, but they must not shrink the plotted palette into a secondary panel.

**The Persistent Theme Rule.** Light and dark mode are user preferences stored locally and applied before the app mounts, preventing a theme flash during reload.

## Elevation & Depth

Depth is primarily tonal and structural: a near-black ground, slightly lighter cards, quiet 1px boundaries, and sparing extra-light shadows. The sticky header adds translucent background and backdrop blur only to preserve orientation over scrolling content. Raised effects never compete with the palette.

### Shadow Vocabulary

- **Control Lift:** An extra-small shadow on outline controls, fields, sliders, and small swatches. It separates interactive objects from the dark bed without making them float.
- **Surface Ring:** A one-pixel, low-contrast perimeter on cards. Treat it as structural definition, not decoration.
- **Selection Inset:** White inset strokes inside selected shade strips. These belong to data selection state, not general elevation.

### Named Rules

**The Tonal-First Rule.** Separate workbench regions with background tone and a quiet boundary before adding shadow.

## Shapes

The system uses one coherent radius family derived from a 10px base: gently curved controls, slightly larger panel corners, and full pills only for compact badges or circular markers. Cards and the editor frame use the larger 14px corner; fields and standard controls use 8px; dense internal rows use 10px or less.

The palette canvas is geometrically stricter than the surrounding chrome. Its eleven shade strips meet without internal rounding, while only the outer editor frame is clipped. Curve handles use circles, reference markers vary deliberately, and range controls use square handles so interaction roles stay visually distinct.

Use the component that matches the interaction. Tabs switch views, joined ToggleGroups select one mode or filter, and independent actions remain separate Buttons. Joined controls use one rounded 8px perimeter with flush internal edges; unrelated actions keep their own 8px corners and spacing. Palette strips, matrix/table geometry, line tabs, and divided lists remain continuous data structures rather than collections of floating pills.

**The One Radius Family Rule.** Reuse the established 6px, 8px, 10px, and 14px steps. Do not introduce unrelated corner values to create emphasis.

## Components

### Buttons

- **Shape:** Compact rounded rectangles with 8px corners, 32px small height or 36px default height, medium-weight labels, and tightly aligned 16px icons.
- **Primary:** Instrument White background with Action Ink text. Use for the next decisive operation: Generate, Apply, or the primary empty-state action.
- **Hover / Focus:** Primary hover reduces surface intensity; all keyboard-focus states gain a 3px neutral ring and a clearer border. Pointer activation moves down by one pixel.
- **Outline / Ghost / Secondary:** Outline controls keep a transparent dark surface and quiet boundary; ghost controls reveal a Muted Graphite fill on hover; secondary controls use Control Graphite for selected low-emphasis states.

### Chips

- **Style:** Compact 20px pills. Outline badges carry exact values and configuration metadata; filled secondary badges carry comparison or accessibility results.
- **State:** Use monospaced text for measurements and tokens. Do not convert badges into a colorful tag collection.

### Cards / Containers

- **Corner Style:** Gently rounded panels with 14px corners.
- **Background:** Panel over Instrument Black, with the popover tone reserved for floating layers.
- **Shadow Strategy:** Tonal-first with a low-contrast perimeter and extra-small shadow.
- **Border:** Section dividers use the same Quiet Border as cards.
- **Internal Padding:** Compact cards use 16px; inspector work areas use 20px.

### Inputs / Fields

- **Style:** Transparent to lightly tinted dark fill, 8px corners, 36px default height, and Field Border. Numeric and color-string fields use the data face.
- **Focus:** The border shifts to Focus Ring and gains a 3px ring at half opacity.
- **Error / Disabled:** Error fields shift border and ring to Signal Red. Disabled controls retain their geometry, reduce opacity, and remove pointer interaction.

### Navigation

The sticky header is a compact instrument bar rather than a destination nav. It pairs the product identity at left with reversible history and reset actions at right. On small screens, long labels and keyboard hints collapse before the actions do. The inspector uses three equal-width line tabs with a crisp 2px active underline and no filled tab container.

### Palette Canvas

The canvas is the signature component. Eleven edge-to-edge tonal strips carry shade labels and hex values at the base, while lightness, chroma, and hue curves sit directly over the color field. Selected shades use strong inset white rails; the active point has an inner outline; generated baselines are dashed and quieter than editable curves. Reference overlays must combine line style, marker shape, labels, and color.

### Inspector

The inspector is a stable 360–420px control rail for References, Selection, and History. Selection begins with the active shade's swatch, exact values, channel inputs, contrast results, and gamut status. Reference and history entries are continuous lists separated by spacing and quiet dividers. Reversible previews retain a sticky Apply/Cancel bar.

## Do's and Don'ts

### Do:

- **Do** keep the palette canvas visually dominant and give it the flexible workspace width.
- **Do** keep workbench surfaces achromatic so generated colors remain the visual evidence.
- **Do** expose transformations with labels, numeric inputs, previews, reset paths, and history.
- **Do** pair curve color with line pattern, marker shape, labels, and stable ordering.
- **Do** use Geist Mono for exact color data and Geist for interface language.
- **Do** preserve the compact 32px and 36px control heights and the established radius family.

### Don't:

- **Don't** turn the interface into a generic decorated dashboard with ornamental cards or marketing composition.
- **Don't** use gradients, glow, or saturated chrome outside the color data and explicit status states.
- **Don't** hide how a palette was generated or apply unexplained “magic” transformations.
- **Don't** compress all eleven shade columns until their labels, curves, or handles become ambiguous; allow horizontal scrolling instead.
- **Don't** rely on color alone for selection, comparison, warnings, or accessibility results.
- **Don't** add a second visual language for custom editor controls; they must remain part of the same shadcn instrument world.
