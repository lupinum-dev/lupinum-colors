import { formatCssVariables } from '../export'
import type { DisplayShade } from '../types'

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

  return formatCssVariables(name, shades, format)
}
