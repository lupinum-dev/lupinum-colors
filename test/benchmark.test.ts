import { describe, expect, it } from 'vite-plus/test'
import { perceptualDistance } from '../src/color.js'
import { generatePaletteFromFamilies, inferAnchor } from '../src/palette.js'
import { loadTailwindFamilies } from '../src/tailwind-data.js'
import { SHADE_NAMES, type Shade } from '../src/types.js'

const families = loadTailwindFamilies('chromatic')

describe('leave-one-family-out benchmark', () => {
  it('reconstructs every family from its hue neighbors across all anchors', () => {
    let totalError = 0
    let samples = 0
    let worstError = 0
    let worstCase = ''
    const errorsByAnchor = new Map<Shade, number[]>()

    for (const target of families) {
      const training = families.filter((family) => family !== target)
      for (const anchor of SHADE_NAMES) {
        const generated = generatePaletteFromFamilies(
          {
            name: target.name,
            color: target.colors[anchor],
            seed: 'exact',
            anchor,
            gamut: 'none',
          },
          training,
        )
        let paletteError = 0
        for (const shade of SHADE_NAMES) {
          paletteError += perceptualDistance(target.colors[shade], generated.shades[shade].raw)
        }
        paletteError /= SHADE_NAMES.length
        totalError += paletteError
        samples += 1
        errorsByAnchor.set(anchor, [...(errorsByAnchor.get(anchor) ?? []), paletteError])
        if (paletteError > worstError) {
          worstError = paletteError
          worstCase = `${target.name}-${anchor}`
        }
      }
    }

    const meanError = totalError / samples
    console.log('\nAll-anchor reconstruction benchmark')
    for (const anchor of SHADE_NAMES) {
      const errors = errorsByAnchor.get(anchor) ?? []
      const mean = errors.reduce((sum, error) => sum + error, 0) / errors.length
      console.log(`${anchor}: mean ${mean.toFixed(4)}, worst ${Math.max(...errors).toFixed(4)}`)
    }
    console.log(`Overall mean: ${meanError.toFixed(4)}`)
    console.log(`Worst case: ${worstCase} at ${worstError.toFixed(4)}`)

    expect(meanError).toBeLessThan(0.0183)
    expect(worstError).toBeLessThan(0.064)
  })

  it('infers held-out anchors with at least baseline accuracy', () => {
    let correct = 0
    let total = 0
    for (const target of families) {
      const training = families.filter((family) => family !== target)
      for (const anchor of SHADE_NAMES) {
        if (inferAnchor(target.colors[anchor], training)[0].shade === anchor) correct += 1
        total += 1
      }
    }
    const accuracy = correct / total
    console.log(`Held-out anchor inference: ${correct}/${total} (${(accuracy * 100).toFixed(1)}%)`)
    expect(accuracy).toBeGreaterThanOrEqual(0.98)
  })
})
