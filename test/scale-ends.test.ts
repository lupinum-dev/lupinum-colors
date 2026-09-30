import { describe, expect, it } from 'vite-plus/test'
import { generatePalette } from '../src/palette'
import { SHADE_NAMES, type Palette } from '../src/types'
import { applyEnd, emptyEnds, endTail } from '../src/app/scale-ends'

function palette(color = '#6f5bd6'): Palette {
  const result = generatePalette({ name: 'brand', color })
  return Object.fromEntries(
    SHADE_NAMES.map((shade) => [shade, { ...result.shades[shade].raw }]),
  ) as Palette
}

describe('scale ends', () => {
  it('limits tails to the three outer shades without reaching the anchor', () => {
    expect(endTail('dark', 500)).toEqual([800, 900, 950])
    expect(endTail('light', 500)).toEqual([50, 100, 200])
    expect(endTail('dark', 800)).toEqual([900, 950])
    expect(endTail('dark', 950)).toEqual([])
    expect(endTail('light', 50)).toEqual([])
    const green = palette('#315d3b')
    const adjusted = applyEnd('dark', green, emptyEnds().dark, { chroma: 0.005 }, 800)
    expect(adjusted.palette[800]).toEqual(green[800])
  })

  it('reduces dark chroma without changing the inner shades or anchor', () => {
    const original = palette()
    const adjusted = applyEnd('dark', original, emptyEnds().dark, { chroma: 0.005 }, 500)
    expect(adjusted.palette[950].c).toBeCloseTo(0.005, 9)
    expect(adjusted.palette[800].c).toBeLessThan(original[800].c)
    expect(adjusted.palette[700]).toEqual(original[700])
    expect(adjusted.palette[500]).toEqual(original[500])
  })

  it('replaces a chroma target without compounding it', () => {
    const first = applyEnd('dark', palette(), emptyEnds().dark, { chroma: 0.005 }, 500)
    const second = applyEnd('dark', first.palette, first.state, { chroma: 0.042 }, 500)
    expect(second.palette[950].c).toBeCloseTo(0.042, 9)
  })

  it('restores the original palette and empty state at Brand', () => {
    const original = palette()
    const first = applyEnd('dark', original, emptyEnds().dark, { chroma: 0.005 }, 500)
    const reset = applyEnd('dark', first.palette, first.state, { chroma: null }, 500)
    expect(reset.palette).toEqual(original)
    expect(reset.state).toEqual(emptyEnds().dark)
  })

  it('keeps a manual hue edit when the end is adjusted again', () => {
    const first = applyEnd('dark', palette(), emptyEnds().dark, { chroma: 0.005 }, 500)
    first.palette[900] = { ...first.palette[900], h: 270 }
    const second = applyEnd('dark', first.palette, first.state, { chroma: 0.042 }, 500)
    expect(second.palette[900].h).toBe(270)
  })

  it('neutralizes the light end without changing shade 300', () => {
    const original = palette()
    const adjusted = applyEnd('light', original, emptyEnds().light, { chroma: 0 }, 500)
    expect(adjusted.palette[50].c).toBe(0)
    expect(adjusted.palette[300]).toEqual(original[300])
  })

  it('changes dark lightness independently of chroma', () => {
    const original = palette()
    const adjusted = applyEnd('dark', original, emptyEnds().dark, { lightness: 0.12 }, 500)
    expect(adjusted.palette[950].l).toBe(0.12)
    expect(adjusted.palette[950].c).toBe(original[950].c)
  })
})
