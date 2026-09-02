import { describe, expect, it } from 'vite-plus/test'
import { signedHueDelta } from '../src/color.js'
import {
  generatePalette,
  generatePaletteFromFamilies,
  generateVariants,
  inferAnchor,
} from '../src/palette.js'
import { loadTailwindFamilies, loadTailwindReference } from '../src/tailwind-data.js'
import { SHADE_NAMES } from '../src/types.js'

const chromatic = loadTailwindFamilies('chromatic')
const neutrals = loadTailwindFamilies('neutral')

describe('Tailwind reference', () => {
  it('is complete, versioned, and contains chromatic and neutral families', () => {
    const reference = loadTailwindReference()
    expect(reference.tailwindVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(reference.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(reference.families.filter((family) => family.kind === 'chromatic')).toHaveLength(17)
    expect(
      reference.families.filter((family) => family.kind === 'neutral').length,
    ).toBeGreaterThanOrEqual(5)
    for (const family of reference.families) {
      expect(SHADE_NAMES.every((shade) => family.colors[shade])).toBe(true)
    }
  })

  it('keeps the cached reference immutable', () => {
    const reference = loadTailwindReference()
    const family = reference.families[0]
    expect(Object.isFrozen(reference)).toBe(true)
    expect(Object.isFrozen(reference.families)).toBe(true)
    expect(Object.isFrozen(family)).toBe(true)
    expect(Object.isFrozen(family.colors)).toBe(true)
    expect(Object.isFrozen(family.colors[50])).toBe(true)
  })
})

describe('exact seed mode', () => {
  it('infers the supplied Tailwind lime-300 and reproduces its raw palette', () => {
    const result = generatePalette({
      name: 'primary',
      color: 'oklch(89.7% 0.196 126.665)',
      seed: 'exact',
      anchor: 'auto',
      gamut: 'none',
    })
    expect(result.configuration.anchor).toBe(300)
    expect(result.configuration.anchorWasInferred).toBe(true)
    expect(result.shades[300].raw.l).toBeCloseTo(0.897, 12)
    expect(result.shades[300].raw.c).toBeCloseTo(0.196, 12)
    expect(result.shades[300].raw.h).toBeCloseTo(126.665, 12)
    expect(result.shades[50].css).toBe('oklch(98.6% 0.031 120.757)')
    expect(result.shades[950].css).toBe('oklch(27.4% 0.072 132.109)')
  })

  it('preserves an arbitrary hex exactly at its inferred anchor', () => {
    const result = generatePalette({ name: 'primary', color: '#89E5D2' })
    expect(result.configuration.anchor).toBe(300)
    expect(result.shades[300].hex).toBe('#89e5d2')
  })

  it('warns when an explicit anchor disagrees with the natural anchor', () => {
    const result = generatePalette({
      name: 'primary',
      color: '#89E5D2',
      seed: 'exact',
      anchor: 500,
    })
    expect(result.shades[500].hex).toBe('#89e5d2')
    expect(
      result.diagnostics.warnings.some((warning) => warning.includes('naturally resembles')),
    ).toBe(true)
  })
})

describe('canonical seed mode', () => {
  it('calculates a canonical mint-500 instead of inserting the pale seed', () => {
    const result = generatePalette({
      name: 'primary',
      color: '#89E5D2',
      seed: 'canonical',
      anchor: 500,
    })
    expect(result.configuration.anchor).toBe(500)
    expect(result.reference.neighbors).toEqual(['emerald', 'teal'])
    expect(result.shades[500].raw.l).toBeCloseTo(0.703, 2)
    expect(result.shades[500].raw.c).toBeCloseTo(0.145, 2)
    expect(result.shades[500].hex).not.toBe('#89e5d2')
  })

  it('defaults canonical mode to shade 500', () => {
    const result = generatePalette({
      name: 'brand',
      color: 'hsl(200 80% 50%)',
      seed: 'canonical',
    })
    expect(result.configuration.anchor).toBe(500)
    expect(result.configuration.anchorWasInferred).toBe(false)
  })
})

describe('hue paths and neutrals', () => {
  it('returns balanced and both neighboring chromatic variants', () => {
    const results = generateVariants({
      name: 'primary',
      color: '#89E5D2',
      seed: 'canonical',
    })
    expect(results.map((result) => result.configuration.huePath)).toEqual([
      'balanced',
      'emerald',
      'teal',
    ])
    expect(new Set(results.map((result) => result.shades[50].raw.h)).size).toBe(3)
  })

  it('rejects unrelated hue paths with useful choices', () => {
    expect(() =>
      generatePalette({
        name: 'primary',
        color: '#89E5D2',
        huePath: 'violet',
      }),
    ).toThrow(/balanced, emerald, teal/)
  })

  it('routes achromatic colors through the neutral model', () => {
    const result = generatePalette({
      name: 'surface',
      color: '#808080',
      seed: 'canonical',
    })
    expect(result.reference.kind).toBe('neutral')
    expect(result.reference.neighbors).toEqual(['neutral', 'neutral'])
  })

  it('continuously interpolates tinted neutral temperature profiles', () => {
    const result = generatePalette({
      name: 'surface',
      color: 'oklch(55% 0.01 180)',
      seed: 'exact',
      anchor: 500,
      gamut: 'none',
    })
    expect(result.reference.kind).toBe('neutral')
    expect(result.reference.neighbors).toEqual(['olive', 'mist'])
    expect(result.shades[500].raw).toEqual({ l: 0.55, c: 0.01, h: 180 })
    expect(result.diagnostics.lightnessMonotonic).toBe(true)
  })

  it('keeps very pale chromatic Tailwind colors on the chromatic model', () => {
    const red = chromatic.find((family) => family.name === 'red')
    expect(red).toBeDefined()
    const result = generatePalette({
      name: 'danger',
      color: red!.colors[50],
      seed: 'exact',
      anchor: 'auto',
      gamut: 'none',
    })
    expect(result.reference.kind).toBe('chromatic')
    expect(result.configuration.anchor).toBe(50)
  })
})

describe('invariants', () => {
  it('reconstructs every known family from every explicit anchor', () => {
    for (const family of chromatic) {
      for (const anchor of SHADE_NAMES) {
        const result = generatePaletteFromFamilies(
          {
            name: family.name,
            color: family.colors[anchor],
            seed: 'exact',
            anchor,
            gamut: 'none',
          },
          chromatic,
        )
        for (const shade of SHADE_NAMES) {
          expect(result.shades[shade].raw.l).toBeCloseTo(family.colors[shade].l, 10)
          expect(result.shades[shade].raw.c).toBeCloseTo(family.colors[shade].c, 10)
          expect(
            Math.abs(signedHueDelta(result.shades[shade].raw.h, family.colors[shade].h)),
          ).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('preserves every neutral input anchor and keeps its palette ordered', () => {
    for (const family of neutrals) {
      for (const anchor of SHADE_NAMES) {
        const result = generatePaletteFromFamilies(
          {
            name: family.name,
            color: family.colors[anchor],
            seed: 'exact',
            anchor,
            gamut: 'none',
          },
          neutrals,
        )
        expect(result.shades[anchor].raw.l).toBeCloseTo(family.colors[anchor].l, 12)
        expect(result.shades[anchor].raw.c).toBeCloseTo(family.colors[anchor].c, 12)
        expect(
          Math.abs(signedHueDelta(result.shades[anchor].raw.h, family.colors[anchor].h)),
        ).toBeLessThan(1e-9)
        expect(result.reference.kind).toBe('neutral')
        expect(result.diagnostics.lightnessMonotonic).toBe(true)
      }
    }
  })

  it('generates 10,000 deterministic valid random palettes', () => {
    let state = 0x89e5d2
    const random = () => {
      state = (1664525 * state + 1013904223) >>> 0
      return state / 0x1_0000_0000
    }

    for (let index = 0; index < 10_000; index += 1) {
      const input = {
        l: 0.05 + random() * 0.9,
        c: 0.005 + random() * 0.35,
        h: random() * 360,
      }
      const anchor = SHADE_NAMES[index % SHADE_NAMES.length]
      const first = generatePalette({
        name: 'random',
        color: input,
        seed: 'exact',
        anchor,
        gamut: 'none',
      })
      const second = generatePalette({
        name: 'random',
        color: input,
        seed: 'exact',
        anchor,
        gamut: 'none',
      })

      expect(first.shades[anchor].raw).toEqual(input)
      expect(second.shades).toEqual(first.shades)
      expect(first.diagnostics.lightnessMonotonic).toBe(true)
      for (const shade of SHADE_NAMES) {
        expect(Number.isFinite(first.shades[shade].raw.l)).toBe(true)
        expect(first.shades[shade].raw.c).toBeGreaterThanOrEqual(0)
      }
    }
  }, 15_000)

  it('reports ranked anchor confidence', () => {
    const candidates = inferAnchor({ l: 0.897, c: 0.196, h: 126.665 }, chromatic)
    expect(candidates[0].shade).toBe(300)
    expect(candidates.reduce((sum, candidate) => sum + candidate.confidence, 0)).toBeCloseTo(1, 10)
    expect(candidates[0].confidence).toBeGreaterThan(candidates[1].confidence)
  })

  it('rejects mixed reference kinds instead of depending on array order', () => {
    expect(() => inferAnchor({ l: 0.5, c: 0.01, h: 120 }, [chromatic[0], neutrals[0]])).toThrow(
      /same kind/,
    )
  })

  it('reports mathematically impossible extreme anchor placement', () => {
    const result = generatePalette({
      name: 'black',
      color: '#000',
      seed: 'exact',
      anchor: 500,
      gamut: 'none',
    })
    expect(result.diagnostics.lightnessMonotonic).toBe(false)
    expect(result.diagnostics.constraintsSatisfied).toBe(false)
    expect(result.diagnostics.warnings.some((warning) => warning.includes('impossible'))).toBe(true)
  })

  it('reports ignored alpha and exact-anchor gamut mapping', () => {
    const result = generatePalette({
      name: 'accent',
      color: 'color(display-p3 0 1 0 / 50%)',
      seed: 'exact',
      anchor: 500,
      gamut: 'srgb',
    })
    expect(result.input.alpha).toBe(0.5)
    expect(result.shades[500].inGamut).toBe(false)
    expect(result.diagnostics.warnings.some((warning) => warning.includes('alpha'))).toBe(true)
    expect(result.diagnostics.warnings.some((warning) => warning.includes('exact anchor'))).toBe(
      true,
    )
  })

  it('validates palette names', () => {
    expect(() => generatePalette({ name: 'not valid!', color: '#fff' })).toThrow(/Palette name/)
  })
})
