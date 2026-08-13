import { describe, expect, it } from 'vite-plus/test'
import { adjustPaletteEnds } from '../src/app/palette-tools'
import { loadTailwindFamilies } from '../src/tailwind-data'
import { SHADE_NAMES, type OklchColor, type Shade } from '../src/types'

const lime = loadTailwindFamilies().find((family) => family.name === 'lime')!.colors

describe('palette endpoint adjustment', () => {
  it('neutralizes both endpoints and eases the change into untouched middle shades', () => {
    const result = adjustPaletteEnds(lime, {
      light: { lightness: lime[50].l, tintRetention: 0 },
      dark: { lightness: 0.16, tintRetention: 0 },
      spread: 4,
    })

    expect(result[50].c).toBe(0)
    expect(result[950].c).toBe(0)
    expect(result[950].l).toBeCloseTo(0.16, 10)
    expect(result[100].c).toBeGreaterThan(0)
    expect(result[100].c).toBeLessThanOrEqual(lime[100].c)
    expect(result[900].c).toBeGreaterThan(0)
    expect(result[900].c).toBeLessThan(lime[900].c)
    expect(result[400]).toEqual(lime[400])
    expect(result[500]).toEqual(lime[500])
    expect(result[600]).toEqual(lime[600])
    const darkChroma = ([600, 700, 800, 900, 950] as const).map((shade) => result[shade].c)
    expect(darkChroma).toEqual([...darkChroma].sort((first, second) => second - first))
  })

  it('makes longer dark blends reach more shades', () => {
    const short = adjustPaletteEnds(lime, {
      light: { lightness: lime[50].l, tintRetention: 1 },
      dark: { lightness: 0, tintRetention: 0 },
      spread: 2,
    })
    const long = adjustPaletteEnds(lime, {
      light: { lightness: lime[50].l, tintRetention: 1 },
      dark: { lightness: 0, tintRetention: 0 },
      spread: 4,
    })

    expect(short[700]).toEqual(lime[700])
    expect(long[700].c).toBeLessThan(lime[700].c)
    expect(long[800].c).toBeLessThan(lime[800].c)
  })

  it('avoids a sharp chroma collapse at the dark endpoint', () => {
    const chroma = [0.01, 0.02, 0.04, 0.08, 0.15, 0.16, 0.13, 0.09, 0.07, 0.02, 0.015]
    const palette = Object.fromEntries(
      SHADE_NAMES.map((shade, index) => [
        shade,
        { l: 1 - index * 0.08, c: chroma[index], h: 145 } satisfies OklchColor,
      ]),
    ) as Record<Shade, OklchColor>
    const result = adjustPaletteEnds(palette, {
      light: { lightness: palette[50].l, tintRetention: 1 },
      dark: { lightness: palette[950].l, tintRetention: 0 },
      spread: 4,
    })
    const darkShades = [600, 700, 800, 900, 950] as const
    const darkChroma = darkShades.map((shade) => result[shade].c)
    const drops = darkChroma.slice(1).map((value, index) => darkChroma[index] - value)

    expect(darkChroma).toEqual([...darkChroma].sort((first, second) => second - first))
    const bends = drops.slice(1).map((drop, index) => Math.abs(drop - drops[index]))
    expect(Math.max(...bends)).toBeLessThan(0.03)
    expect(darkChroma.every((value, index) => value <= palette[darkShades[index]].c)).toBe(true)
  })
})
