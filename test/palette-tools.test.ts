import { describe, expect, it } from 'vite-plus/test'
import { rankReferences } from '../src/app/palette-tools'
import { loadTailwindFamilies } from '../src/tailwind-data'

const families = loadTailwindFamilies()
const rose = families.find((family) => family.name === 'rose')!

describe('reference ranking', () => {
  it('ranks an exact Tailwind family first', () => {
    const ranked = rankReferences(rose.colors, families)
    expect(ranked[0].family.name).toBe('rose')
    expect(ranked[0].meanDelta).toBeLessThan(1e-10)
    expect(ranked[0].score).toBeCloseTo(100, 8)
  })
})
