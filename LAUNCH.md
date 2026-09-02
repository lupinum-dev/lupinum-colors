# Lupinum Colors launch package

This document prepares the product for release at `https://colors.lupinum.com/`. It does not authorize deployment, DNS changes, analytics accounts, advertising spend, or publication to external communities.

## Product system

- **Site name:** Lupinum Colors
- **Tool name:** Tailwind shade generator
- **Canonical URL:** `https://colors.lupinum.com/`
- **One-line promise:** Generate, refine, test, and export production-ready Tailwind color scales.
- **Primary audience:** Frontend developers and product designers building custom Tailwind color systems.
- **Differentiator:** The result is calibrated against Tailwind's complete color dataset and remains directly editable as transparent OKLCH curves.
- **Business role:** A free expert tool that earns trust, attracts relevant search traffic, and introduces qualified visitors to Lupinum's design and software work.

Keep the tool free for the initial release. Charging for this version would require accounts, billing, saved projects, support expectations, and a clearer recurring value proposition. Measure genuine use before adding that operational weight.

## Search intent

The home page targets one primary intent: **Tailwind shade generator**.

Use these closely related phrases naturally in launch copy and external links:

- Tailwind color generator
- Tailwind color palette generator
- Tailwind CSS color generator
- Tailwind v4 color generator
- Tailwind OKLCH generator
- generate Tailwind shades from HEX
- Tailwind 50–950 color scale
- Tailwind `@theme` generator

Do not create separate pages that repeat the same tool with slightly different wording. Add a new indexable route only when it provides a distinct, complete workflow. The first credible candidates are:

1. `/oklch-palette-generator` for a framework-independent workflow;
2. `/tailwind-v4-theme-generator` for semantic theme creation rather than one color scale;
3. `/color-contrast-checker` for a focused accessibility workflow.

## Search result copy

**Title**

> Tailwind Color Shade Generator — Lupinum Colors

**Description**

> Generate and refine a Tailwind CSS 50–950 color scale from any HEX, RGB, HSL, or OKLCH color. Check contrast and export Tailwind v4, CSS, or JSON.

## Directory and launch copy

**Short description — 80 characters**

> Generate precise Tailwind color scales with an editable OKLCH curve.

**Product Hunt tagline**

> Tailwind color scales you can inspect, refine, and trust.

**Directory description**

> Lupinum Colors is a free Tailwind shade generator for developers and product designers. Start with any HEX, RGB, HSL, or OKLCH color, generate a calibrated 50–950 scale, edit its lightness, chroma, and hue curves, compare it with Tailwind's built-in palettes, check every contrast pair, and export Tailwind v4, CSS, or JSON tokens. It runs in the browser and needs no account.

**Community post draft**

> I kept running into color generators that gave me a finished scale without showing why it looked the way it did. We built Lupinum Colors around the opposite idea: start with a Tailwind-calibrated 50–950 scale, then edit the actual OKLCH curves, compare nearby Tailwind families, inspect every contrast pair, and export an `@theme` block. It is free, runs in the browser, and needs no account. I would especially value feedback on the curve editor and the scale-end controls: https://colors.lupinum.com/

Do not post identical text to several communities. Adapt the introduction to the community, disclose that Lupinum built the tool, and stay available to answer technical questions.

## Article that can earn links

Recommended title:

> How we calibrated an OKLCH generator against every Tailwind CSS color

Suggested structure:

1. Why a mathematically smooth scale can still look unlike Tailwind.
2. What the 26 Tailwind color families reveal about lightness, chroma, and hue.
3. How anchor inference works.
4. Why gamut mapping must remain visible.
5. What the cross-validation tests measure.
6. A worked example with the generated scale and exported `@theme` block.
7. Link to the tool and its relevant source or methodology evidence.

The article should use real measurements from this repository. Do not manufacture benchmark claims or write a generic SEO summary.

## Paid search preparation

Do not buy ads on launch day. First confirm that visitors generate palettes, copy exports, and reach the Lupinum contact link. If organic or community traffic converts, start with one tightly limited search campaign.

**Exact and phrase-match keywords**

- `[tailwind shade generator]`
- `[tailwind color generator]`
- `[tailwind color palette generator]`
- `"tailwind v4 color generator"`
- `"tailwind oklch generator"`

**Negative keywords**

- clothing
- jacket
- pants
- GPU
- GLSL
- Minecraft
- game shader
- hair color
- paint

**Headlines — maximum 30 characters**

- Tailwind Shade Generator
- Build Tailwind Color Scales
- OKLCH Palette Generator
- Tailwind v4 Color Tokens
- Free 50–950 Shade Tool
- Check Contrast Before Export

**Descriptions — maximum 90 characters**

- Turn any CSS color into a precise 50–950 scale. Refine and export v4 tokens.
- Check contrast, compare Tailwind colors, and copy CSS or JSON. No sign-up.

Use this campaign URL:

`https://colors.lupinum.com/?utm_source=google&utm_medium=cpc&utm_campaign=tailwind-shade-generator`

Start with exact and phrase match only, one country/language group at a time, and a small daily cap. Stop if export use or qualified Lupinum referrals do not justify the cost.

## Measurement plan

The first release intentionally includes no analytics vendor. After the privacy text and hosting configuration are reviewed, connect a privacy-conscious analytics service and measure only these product events:

- `palette_generated`
- `palette_export_copied` with the export format
- `lupinum_contact_clicked`
- `technical_reference_opened`

Primary activation is `palette_export_copied`. A generated palette without an export is exploration, not proven value. Avoid recording color values, palette names, exported tokens, or other user-entered content.

Review these after 30 days:

- search queries and indexed pages in Google Search Console;
- visitor-to-export rate;
- repeat visits without identifying individual people;
- Lupinum contact referrals;
- the points where users abandon the editor.

## Operational handoff

This file owns positioning, search, campaign, and measurement decisions. It
does not own repository setup, deployment, or rollback instructions.

Follow [MAINTAINING.md](./MAINTAINING.md) for deployment and production
verification. Track unresolved GitHub, Vercel, DNS, privacy, search, and launch
actions in the repository's single `Launch checklist` issue.
