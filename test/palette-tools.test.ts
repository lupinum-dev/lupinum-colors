import { describe, expect, it } from 'vite-plus/test'
import { CHANNEL_MODES } from '../src/app/channels'
import {
  applyReferenceChannel,
  rankReferences,
  shapeChroma,
  smoothChannel,
  stabilizeHue,
} from '../src/app/palette-tools'
import { loadTailwindFamilies } from '../src/tailwind-data'
import { SHADE_NAMES, type OklchColor, type Shade } from '../src/types'

const families = loadTailwindFamilies()
const rose = families.find((family) => family.name === 'rose')!
const taupe = families.find((family) => family.name === 'taupe')!
const chroma = CHANNEL_MODES.oklch[1]
const hue = CHANNEL_MODES.oklch[2]

function clone(colors: Record<Shade, OklchColor>): Record<Shade, OklchColor> {
  return Object.fromEntries(SHADE_NAMES.map((shade) => [shade, { ...colors[shade] }])) as Record<
    Shade,
    OklchColor
  >
}

describe('reference ranking and borrowing', () => {
  it('ranks an exact Tailwind family first', () => {
    const ranked = rankReferences(rose.colors, families)
    expect(ranked[0].family.name).toBe('rose')
    expect(ranked[0].meanDelta).toBeLessThan(1e-10)
    expect(ranked[0].score).toBeCloseTo(100, 8)
  })

  it('moves dark chroma toward Taupe by a controlled amount', () => {
    const result = applyReferenceChannel(rose.colors, taupe.colors, {
      channel: chroma,
      operation: 'values',
      amount: 0.1,
      scope: 'darks',
      feather: 0,
      anchor: 500,
      protectAnchor: true,
    })
    expect(result[500].c).toBe(rose.colors[500].c)
    expect(result[300].c).toBe(rose.colors[300].c)
    expect(result[800].c).toBeCloseTo(
      rose.colors[800].c + (taupe.colors[800].c - rose.colors[800].c) * 0.1,
      10,
    )
  })

  it('borrows a chroma shape without replacing the anchor magnitude', () => {
    const result = applyReferenceChannel(rose.colors, taupe.colors, {
      channel: chroma,
      operation: 'shape',
      amount: 1,
      scope: 'all',
      anchor: 500,
      protectAnchor: true,
    })
    expect(result[500].c).toBe(rose.colors[500].c)
    expect(result[900].c).toBeCloseTo(
      rose.colors[500].c * (taupe.colors[900].c / taupe.colors[500].c),
      10,
    )
  })
})

describe('curve shaping', () => {
  it('applies independent tonal chroma factors', () => {
    const result = shapeChroma(rose.colors, {
      overall: 1,
      lights: 1,
      middle: 0.5,
      darks: 0.6,
      anchor: 500,
      protectAnchor: false,
    })
    expect(result[200].c).toBe(rose.colors[200].c)
    expect(result[500].c).toBeCloseTo(rose.colors[500].c * 0.5, 10)
    expect(result[900].c).toBeCloseTo(rose.colors[900].c * 0.6, 10)
  })

  it('stabilizes dark hue circularly toward the anchor', () => {
    const palette = clone(taupe.colors)
    palette[800].h = 350
    palette[500].h = 10
    const result = stabilizeHue(palette, {
      strength: 0.5,
      scope: 'darks',
      anchor: 500,
      protectAnchor: true,
    })
    expect(result[800].h).toBeCloseTo(0, 10)
    expect(result[500].h).toBe(10)
  })

  it('smooths a local hue kink without moving protected anchor or endpoints', () => {
    const palette = clone(rose.colors)
    palette[700].h = 70
    const before = Math.abs(palette[600].h - 2 * palette[700].h + palette[800].h)
    const result = smoothChannel(palette, {
      channel: hue,
      strength: 0.8,
      scope: 'all',
      anchor: 500,
      protectAnchor: true,
      protectEndpoints: true,
    })
    const after = Math.abs(result[600].h - 2 * result[700].h + result[800].h)
    expect(after).toBeLessThan(before)
    expect(result[500]).toEqual(palette[500])
    expect(result[50]).toEqual(palette[50])
    expect(result[950]).toEqual(palette[950])
  })
})
