import type { DisplayShade } from './palette-store'

export type ExportFormat = 'css' | 'tailwind' | 'json'

export function formatExport(format: ExportFormat, name: string, shades: DisplayShade[]): string {
  if (format === 'json') {
    return JSON.stringify(
      Object.fromEntries(
        shades.map((entry) => [entry.shade, { oklch: entry.css, hex: entry.hex }]),
      ),
      null,
      2,
    )
  }

  const opening = format === 'tailwind' ? '@theme {' : ':root {'
  const lines = shades.map((entry) => `  --color-${name}-${entry.shade}: ${entry.css};`)
  return [opening, ...lines, '}'].join('\n')
}
