<p align="center">
  <img src="public/favicon.svg" width="128" alt="Lupinum Colors icon">
</p>

<h1 align="center">Lupinum Colors</h1>

<p align="center">Generate, refine, test, and export production-ready Tailwind color scales.</p>

<p align="center">
  <a href="https://colors.lupinum.com/"><img src="https://img.shields.io/badge/live-colors.lupinum.com-315d3b" alt="Open Lupinum Colors"></a>
  <a href="https://github.com/lupinum-dev/lupinum-colors/actions/workflows/ci.yml"><img src="https://github.com/lupinum-dev/lupinum-colors/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-315d3b" alt="MIT license"></a>
</p>

## Why use Lupinum Colors?

Many palette generators return a finished result without showing how it was
made. Lupinum Colors exposes the lightness, chroma, and hue curves behind every
shade. You can compare the result with Tailwind's color families, make exact
changes, test contrast, and export implementation-ready tokens.

The editor keeps OKLCH values as its single source of truth. HSL and HSV are
derived editing views, so switching formats does not create competing palette
state.

## When to use it

Use Lupinum Colors when you need a custom Tailwind-style scale from shade `50`
through `950`, especially when you want to inspect or refine how the scale was
generated.

Do not use it as a substitute for testing colors in the complete interface.
Contrast depends on the final foreground, background, font, and interaction
state. The generated scale is a design input, not an accessibility guarantee.

## Use the app

Open [colors.lupinum.com](https://colors.lupinum.com/). Enter a CSS color in
HEX, RGB, HSL, OKLab, OKLCH, or Display P3 syntax. The application runs in the
browser and does not require an account.

Committed palettes are stored in the URL fragment when you share or reload the
page. Browser URL fragments are not sent to the server.

## Main workflow

1. Enter a source color and choose how it anchors the scale.
2. Compare the generated curve with nearby Tailwind color families.
3. Edit lightness, chroma or saturation, and hue with curves or exact fields.
4. Refine the light and dark ends of the scale.
5. Test the palette in interface previews and the contrast matrix.
6. Export Tailwind v4, CSS, or JSON tokens.

## Requirements

- Node.js 22.18–22.x, 24.12–24.x, or 26.x.
- pnpm 11.21.0.
- A modern browser for the editor.

## Installation

Clone the repository and install the locked dependencies:

```sh
pnpm install --frozen-lockfile
```

## Quick start

```sh
pnpm dev
```

Open the local URL printed by Vite+.

The repository also includes an internal command-line interface for development
and calibration work:

```sh
pnpm palette primary '#89E5D2' --seed exact --at auto
```

## How it works

The generator derives a complete scale from the source color and calibrated
Tailwind reference data. The committed reference records its Tailwind version
and a digest of the source file. A build fails when the reference is stale.

The production build creates a static client bundle, renders the initial Vue
application during the build, and inserts the result into `dist/index.html`.
The deployed application does not require a production Node.js server.

## Documentation

- [Maintainer operations](MAINTAINING.md)
- [Third-party credits](THIRD_PARTY_NOTICES.md)
- [Lupinum OSS handbook](https://oss.lupinum.com/)

## Contributing and development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request. Run the
normal repository gate before review:

```sh
pnpm verify
```

## Support and security

Open a [GitHub issue](https://github.com/lupinum-dev/lupinum-colors/issues) for
a reproducible defect. Join the
[Lupinum OSS Discord](https://discord.gg/RPH6SeA36N) for questions and project
discussion.

Do not report vulnerabilities in a public issue. Follow
[SECURITY.md](SECURITY.md) to send a private report.

## Credits

Lupinum Colors uses the color definitions distributed with Tailwind CSS as its
calibration reference. Tailwind CSS is created by Tailwind Labs and available
under the MIT License. Lupinum Colors is independent and is not affiliated with
or endorsed by Tailwind Labs.

The interface also builds on shadcn-vue conventions, Reka UI primitives,
Culori, Lucide icons, and the Geist font family. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## License

[MIT](LICENSE) © Lupinum OG.
