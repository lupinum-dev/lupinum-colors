import { circularHueDistance, normalizeHue, perceptualDistance, signedHueDelta } from '../color'
import { SHADE_NAMES, type OklchColor, type PaletteFamily, type Shade } from '../types'
import type { Channel } from './channels'

export type TonalScope = 'all' | 'lights' | 'middle' | 'darks' | 'custom'
export type ReferenceOperation = 'values' | 'shape'

export interface ScopeOptions {
  scope: TonalScope
  from?: Shade
  to?: Shade
  feather?: number
}

export interface ReferenceAdjustment extends ScopeOptions {
  channel: Channel
  operation: ReferenceOperation
  amount: number
  anchor: Shade
  protectAnchor: boolean
}

export interface ChromaShapeOptions {
  overall: number
  lights: number
  middle: number
  darks: number
  anchor: Shade
  protectAnchor: boolean
}

export interface HueStabilityOptions extends ScopeOptions {
  strength: number
  anchor: Shade
  protectAnchor: boolean
}

export interface SmoothOptions extends ScopeOptions {
  channel: Channel
  strength: number
  anchor: Shade
  protectAnchor: boolean
  protectEndpoints: boolean
  protectScopeEndpoints?: boolean
}

export interface ReferenceRank {
  family: PaletteFamily
  score: number
  meanDelta: number
  lightnessDelta: number
  chromaDelta: number
  hueDelta: number
}

export function clonePalette(palette: Record<Shade, OklchColor>): Record<Shade, OklchColor> {
  return Object.fromEntries(SHADE_NAMES.map((shade) => [shade, { ...palette[shade] }])) as Record<
    Shade,
    OklchColor
  >
}

export function rankReferences(
  palette: Record<Shade, OklchColor>,
  families: PaletteFamily[],
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

export function applyReferenceChannel(
  palette: Record<Shade, OklchColor>,
  reference: Record<Shade, OklchColor>,
  options: ReferenceAdjustment,
): Record<Shade, OklchColor> {
  const result = clonePalette(palette)
  const currentAnchor = options.channel.get(palette[options.anchor])
  const referenceAnchor = options.channel.get(reference[options.anchor])
  const isHue = options.channel.key === 'h'

  for (const shade of SHADE_NAMES) {
    const weight =
      options.protectAnchor && shade === options.anchor ? 0 : scopeWeight(shade, options)
    if (weight <= 0) continue

    const current = options.channel.get(palette[shade])
    const referenceValue = options.channel.get(reference[shade])
    let target = referenceValue

    if (options.operation === 'shape') {
      if (isHue) {
        target = normalizeHue(currentAnchor + signedHueDelta(referenceAnchor, referenceValue))
      } else if (isRatioChannel(options.channel.key) && Math.abs(referenceAnchor) > 1e-7) {
        target = currentAnchor * (referenceValue / referenceAnchor)
      } else {
        target = currentAnchor + (referenceValue - referenceAnchor)
      }
    }

    const amount = clamp(options.amount, 0, 1) * weight
    const nextValue = isHue
      ? normalizeHue(current + signedHueDelta(current, target) * amount)
      : lerp(current, target, amount)
    result[shade] = options.channel.set(result[shade], nextValue)
  }

  return result
}

export function shapeChroma(
  palette: Record<Shade, OklchColor>,
  options: ChromaShapeOptions,
): Record<Shade, OklchColor> {
  const result = clonePalette(palette)
  for (const [index, shade] of SHADE_NAMES.entries()) {
    if (options.protectAnchor && shade === options.anchor) continue
    const tonal = tonalFactor(index, options.lights, options.middle, options.darks)
    result[shade].c = Math.max(0, palette[shade].c * options.overall * tonal)
  }
  return result
}

export function stabilizeHue(
  palette: Record<Shade, OklchColor>,
  options: HueStabilityOptions,
): Record<Shade, OklchColor> {
  const result = clonePalette(palette)
  const target = palette[options.anchor].h
  for (const shade of SHADE_NAMES) {
    if (options.protectAnchor && shade === options.anchor) continue
    const weight = scopeWeight(shade, options) * clamp(options.strength, 0, 1)
    if (weight <= 0) continue
    result[shade].h = normalizeHue(
      palette[shade].h + signedHueDelta(palette[shade].h, target) * weight,
    )
  }
  return result
}

export function smoothChannel(
  palette: Record<Shade, OklchColor>,
  options: SmoothOptions,
): Record<Shade, OklchColor> {
  const result = clonePalette(palette)
  const original = SHADE_NAMES.map((shade) => options.channel.get(palette[shade]))
  const values = options.channel.key === 'h' ? unwrapHue(original) : [...original]
  const passes = Math.max(1, Math.ceil(clamp(options.strength, 0, 1) * 4))
  const blend = clamp(options.strength * 1.25, 0, 1)
  const [scopeStart, scopeEnd] = scopeBounds(options)
  let working = [...values]

  for (let pass = 0; pass < passes; pass += 1) {
    const next = [...working]
    for (let index = 0; index < working.length; index += 1) {
      const shade = SHADE_NAMES[index]
      if (
        (options.protectAnchor && shade === options.anchor) ||
        (options.protectEndpoints && (index === 0 || index === working.length - 1)) ||
        (options.protectScopeEndpoints && (index === scopeStart || index === scopeEnd))
      )
        continue
      const weight = scopeWeight(shade, options)
      if (weight <= 0) continue
      const local = savitzkyGolay(working, index)
      next[index] = lerp(working[index], local, blend * weight)
    }
    working = next
  }

  for (const [index, shade] of SHADE_NAMES.entries()) {
    if (
      (options.protectAnchor && shade === options.anchor) ||
      (options.protectEndpoints && (index === 0 || index === SHADE_NAMES.length - 1)) ||
      (options.protectScopeEndpoints && (index === scopeStart || index === scopeEnd))
    )
      continue
    const weight = scopeWeight(shade, options)
    if (weight <= 0) continue
    const value = options.channel.key === 'h' ? normalizeHue(working[index]) : working[index]
    result[shade] = options.channel.set(result[shade], value)
  }
  return result
}

export interface SelectionCurveOptions {
  channel: Channel
  from: Shade
  to: Shade
  startDelta: number
  curveDelta: number
  endDelta: number
  feather: number
  anchor: Shade
  protectAnchor: boolean
}

// Adjust a contiguous range with a stable three-control curve. The start and end
// controls are exact; curveDelta is the midpoint's deviation from their line.
export function adjustSelectionCurve(
  palette: Record<Shade, OklchColor>,
  options: SelectionCurveOptions,
): Record<Shade, OklchColor> {
  const result = clonePalette(palette)
  const fromIndex = SHADE_NAMES.indexOf(options.from)
  const toIndex = SHADE_NAMES.indexOf(options.to)
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  const span = Math.max(1, end - start)
  const feather = Math.max(0, Math.round(options.feather))

  for (const [index, shade] of SHADE_NAMES.entries()) {
    if (options.protectAnchor && shade === options.anchor) continue

    let delta = 0
    if (index >= start && index <= end) {
      const t = (index - start) / span
      delta =
        lerp(options.startDelta, options.endDelta, t) +
        4 * t * (1 - t) * options.curveDelta
    } else if (feather > 0 && index < start && start - index <= feather) {
      delta = options.startDelta * featherWeight(start - index, feather)
    } else if (feather > 0 && index > end && index - end <= feather) {
      delta = options.endDelta * featherWeight(index - end, feather)
    } else {
      continue
    }

    const current = options.channel.get(palette[shade])
    result[shade] = options.channel.set(result[shade], current + delta)
  }
  return result
}

export function featherWeight(distance: number, feather: number): number {
  if (distance <= 0) return 1
  if (distance > feather || feather <= 0) return 0
  return smoothstep(0, feather + 1, feather + 1 - distance)
}

export function scopeWeight(shade: Shade, options: ScopeOptions): number {
  if (options.scope === 'all') return 1
  const index = SHADE_NAMES.indexOf(shade)
  const [start, end] = scopeBounds(options)
  if (index >= start && index <= end) return 1
  const feather = Math.max(0, options.feather ?? 0)
  if (feather === 0) return 0
  const distance = index < start ? start - index : index - end
  if (distance > feather) return 0
  return smoothstep(0, feather + 1, feather + 1 - distance)
}

function scopeBounds(options: ScopeOptions): [number, number] {
  if (options.scope === 'lights') return [0, 3]
  if (options.scope === 'middle') return [4, 6]
  if (options.scope === 'darks') return [7, 10]
  const from = options.from ? SHADE_NAMES.indexOf(options.from) : 0
  const to = options.to ? SHADE_NAMES.indexOf(options.to) : SHADE_NAMES.length - 1
  return [Math.min(from, to), Math.max(from, to)]
}

function tonalFactor(index: number, lights: number, middle: number, darks: number): number {
  if (index <= 3) return lights
  if (index <= 5) return lerp(lights, middle, smoothstep(3, 5, index))
  if (index <= 7) return lerp(middle, darks, smoothstep(5, 7, index))
  return darks
}

// Quadratic Savitzky–Golay kernel over a mirror-padded window, so shades near
// the ends receive the same treatment as interior shades.
function savitzkyGolay(values: number[], index: number): number {
  const at = (position: number) => values[reflectIndex(position, values.length)]
  return (
    (-3 * at(index - 2) +
      12 * at(index - 1) +
      17 * at(index) +
      12 * at(index + 1) -
      3 * at(index + 2)) /
    35
  )
}

function reflectIndex(index: number, length: number): number {
  if (index < 0) return -index
  if (index >= length) return 2 * (length - 1) - index
  return index
}

function unwrapHue(values: number[]): number[] {
  if (values.length === 0) return []
  const result = [values[0]]
  for (let index = 1; index < values.length; index += 1) {
    result.push(result[index - 1] + signedHueDelta(result[index - 1], values[index]))
  }
  return result
}

function isRatioChannel(key: string): boolean {
  return key === 'c' || key === 's'
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
