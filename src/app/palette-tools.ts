import { circularHueDistance, perceptualDistance } from '../color'
import { SHADE_NAMES, type Palette, type PaletteFamily, type ReadonlyPalette } from '../types'

export interface PaletteEndOptions {
  light: {
    lightness: number
    tintRetention: number
  }
  dark: {
    lightness: number
    tintRetention: number
  }
  spread: number
}

export interface ReferenceRank {
  family: PaletteFamily
  score: number
  meanDelta: number
  lightnessDelta: number
  chromaDelta: number
  hueDelta: number
}

export function clonePalette(palette: ReadonlyPalette): Palette {
  return Object.fromEntries(SHADE_NAMES.map((shade) => [shade, { ...palette[shade] }])) as Palette
}

export function rankReferences(
  palette: ReadonlyPalette,
  families: readonly PaletteFamily[],
): ReferenceRank[] {
  return families
    .map((family) => {
      let meanDelta = 0
      let lightnessDelta = 0
      let chromaDelta = 0
      let hueDelta = 0
      for (const shade of SHADE_NAMES) {
        const current = palette[shade]
        const reference = family.colors[shade]
        meanDelta += perceptualDistance(current, reference)
        lightnessDelta += Math.abs(current.l - reference.l)
        chromaDelta += Math.abs(current.c - reference.c)
        const chromaWeight = Math.min(1, Math.max(current.c, reference.c) / 0.08)
        hueDelta += circularHueDistance(current.h, reference.h) * chromaWeight
      }
      const count = SHADE_NAMES.length
      meanDelta /= count
      lightnessDelta /= count
      chromaDelta /= count
      hueDelta /= count
      return {
        family,
        meanDelta,
        lightnessDelta,
        chromaDelta,
        hueDelta,
        score: Math.max(0, Math.min(100, Math.exp(-meanDelta / 0.075) * 100)),
      }
    })
    .sort((first, second) => first.meanDelta - second.meanDelta)
}

// Shift each endpoint by an explicit lightness delta and chroma ratio. Chroma
// follows a monotone cubic tail that blends the existing direction into an
// even endpoint ramp, avoiding the abrupt penultimate-stop collapse caused by
// per-stop multipliers. The selected tail length is always honored.
export function adjustPaletteEnds(palette: ReadonlyPalette, options: PaletteEndOptions): Palette {
  const result = clonePalette(palette)
  const lastIndex = SHADE_NAMES.length - 1
  const spread = Math.round(clamp(options.spread, 1, 4))
  const lightBoundary = spread
  const darkBoundary = lastIndex - spread
  const lightTarget = clamp(options.light.lightness, palette[100].l, 1)
  const darkTarget = clamp(options.dark.lightness, 0, palette[900].l)
  const lightDelta = lightTarget - palette[50].l
  const darkDelta = darkTarget - palette[950].l
  const lightTint = clamp(options.light.tintRetention, 0, 1)
  const darkTint = clamp(options.dark.tintRetention, 0, 1)

  for (const [index, shade] of SHADE_NAMES.entries()) {
    const canAdjustLight = index < lightBoundary
    const canAdjustDark = index > darkBoundary

    if (canAdjustLight) {
      const weight = tailWeight(index, lightBoundary)
      result[shade].l = clamp(palette[shade].l + lightDelta * weight, 0, 1)
      const neutralChroma = Math.min(
        palette[shade].c,
        tailChroma(palette, 0, lightBoundary, index, 'light'),
      )
      result[shade].c = Math.max(0, lerp(neutralChroma, palette[shade].c, lightTint))
    } else if (canAdjustDark) {
      const weight = tailWeight(lastIndex - index, lastIndex - darkBoundary)
      result[shade].l = clamp(palette[shade].l + darkDelta * weight, 0, 1)
      const neutralChroma = Math.min(
        palette[shade].c,
        tailChroma(palette, darkBoundary, lastIndex, index, 'dark'),
      )
      result[shade].c = Math.max(0, lerp(neutralChroma, palette[shade].c, darkTint))
    }
  }

  return result
}

function tailWeight(distance: number, spread: number): number {
  return 1 - smoothstep(0, spread, distance)
}

function tailChroma(
  palette: ReadonlyPalette,
  startIndex: number,
  endIndex: number,
  index: number,
  side: 'light' | 'dark',
): number {
  const span = endIndex - startIndex
  if (span <= 0) return palette[SHADE_NAMES[index]].c

  const start = side === 'light' ? 0 : palette[SHADE_NAMES[startIndex]].c
  const end = side === 'light' ? palette[SHADE_NAMES[endIndex]].c : 0
  const secant = (end - start) / span
  const startSlope =
    side === 'light'
      ? secant
      : softenTailEntry(
          limitMonotoneSlope(
            palette[SHADE_NAMES[startIndex]].c - palette[SHADE_NAMES[startIndex - 1]].c,
            secant,
          ),
          secant,
        )
  const endSlope =
    side === 'dark'
      ? secant
      : limitMonotoneSlope(
          palette[SHADE_NAMES[endIndex + 1]].c - palette[SHADE_NAMES[endIndex]].c,
          secant,
        )
  const amount = (index - startIndex) / span
  return cubicHermite(start, end, startSlope * span, endSlope * span, amount)
}

function softenTailEntry(currentSlope: number, requiredSlope: number): number {
  // Stay close to the palette's existing direction, but commit enough to the
  // endpoint ramp that the first selected shade visibly joins the transition.
  return lerp(currentSlope, requiredSlope, 0.85)
}

function limitMonotoneSlope(slope: number, secant: number): number {
  return secant >= 0 ? clamp(slope, 0, secant * 3) : clamp(slope, secant * 3, 0)
}

function cubicHermite(
  start: number,
  end: number,
  startTangent: number,
  endTangent: number,
  amount: number,
): number {
  const squared = amount * amount
  const cubed = squared * amount
  return (
    (2 * cubed - 3 * squared + 1) * start +
    (cubed - 2 * squared + amount) * startTangent +
    (-2 * cubed + 3 * squared) * end +
    (cubed - squared) * endTangent
  )
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
