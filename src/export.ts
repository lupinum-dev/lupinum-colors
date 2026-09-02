import type { Shade } from './types.js'

export type CssVariableFormat = 'css' | 'tailwind'

export function formatCssVariables(
  name: string,
  shades: readonly { shade: Shade; css: string }[],
  format: CssVariableFormat,
): string {
  const opening = format === 'tailwind' ? '@theme {' : ':root {'
  const variables = shades.map((shade) => `  --color-${name}-${shade.shade}: ${shade.css};`)
  return [opening, ...variables, '}'].join('\n')
}
