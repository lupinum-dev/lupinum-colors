// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  decodeSharedPalette,
  encodeSharedPalette,
  paletteToTuple,
  type SharedPaletteV1,
} from '../src/app/shared-palette'
import { adjustEnd, commit, commitShade, endsState, generate, generatedShades, history, historyIndex, paletteName, redo, restoreSharedPaletteFromHash, seedColor, setShadeColor, shades, undo } from '../src/app/palette-store'
import { emptyEnds } from '../src/app/scale-ends'
import { clonePalette } from '../src/app/palette-tools'

function currentPayload(): SharedPaletteV1 {
  return {
    v: 1,
    r: [paletteName.value, seedColor.value, 'exact', 'auto', 'srgb', 'balanced'],
    b: paletteToTuple(generatedShades.value!),
    p: paletteToTuple(shades.value!),
  }
}

function encodeUnknown(value: unknown): string {
  return encodeJson(JSON.stringify(value))
}

function encodeJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const binary = String.fromCharCode(...bytes)
  return `#palette=${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
}

beforeEach(() => {
  paletteName.value = 'brand'
  seedColor.value = '#3b82f6'
  generate()
})

describe('share palette codec', () => {
  it('round trips exact palettes and Unicode-safe UTF-8 data', () => {
    const payload = currentPayload()
    payload.r[0] = 'blå'
    expect(decodeSharedPalette(encodeSharedPalette(payload))).toEqual(payload)
  })

  it.each([
    ['malformed base64', () => '#palette=%%%'],
    ['oversized payload', () => `#palette=${'a'.repeat(12_001)}`],
    ['unknown version', () => encodeUnknown({ ...currentPayload(), v: 2 })],
    ['missing shades', () => encodeUnknown({ ...currentPayload(), p: [] })],
    [
      'invalid enum',
      () =>
        encodeUnknown({
          ...currentPayload(),
          r: ['brand', '#fff', 'magic', 'auto', 'srgb', 'balanced'],
        }),
    ],
    [
      'invalid hue path',
      () =>
        encodeUnknown({
          ...currentPayload(),
          r: ['brand', '#fff', 'exact', 'auto', 'srgb', 'madeup'],
        }),
    ],
    [
      'NaN value',
      () => encodeJson(JSON.stringify(currentPayload()).replace(/"p":\[\[[^,]+/, '"p":[[NaN')),
    ],
    [
      'infinite value',
      () => encodeJson(JSON.stringify(currentPayload()).replace(/"p":\[\[[^,]+/, '"p":[[Infinity')),
    ],
    [
      'non-finite value',
      () =>
        encodeUnknown({
          ...currentPayload(),
          p: [[null, 0, 0], ...currentPayload().p.slice(1)],
        }),
    ],
    [
      'out-of-range value',
      () => encodeUnknown({ ...currentPayload(), p: [[2, 0, 0], ...currentPayload().p.slice(1)] }),
    ],
  ])('rejects %s', (_label, hash) => {
    expect(() => decodeSharedPalette(hash())).toThrow()
  })
})

describe('live palette URL state', () => {
  it('updates only for committed palette states', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    replaceState.mockClear()
    setShadeColor(500, { ...shades.value![500], c: 0.12 })
    expect(replaceState).toHaveBeenCalledTimes(0)
    commit()
    expect(replaceState).toHaveBeenCalledTimes(1)
    commit()
    expect(replaceState).toHaveBeenCalledTimes(1)
    undo()
    redo()
    expect(replaceState).toHaveBeenCalledTimes(3)
    adjustEnd('dark', { chroma: 0 })
    expect(replaceState).toHaveBeenCalledTimes(3)
    commit()
    expect(replaceState).toHaveBeenCalledTimes(4)
    replaceState.mockRestore()
  })

  it('restores the exact current palette and generated reset baseline', () => {
    const baseline = clonePalette(generatedShades.value!)
    const edited = clonePalette(shades.value!)
    edited[300] = { l: 0.72, c: 0.123, h: 287.5 }
    commitShade(300, edited[300])
    const hash = window.location.hash

    seedColor.value = '#fff'
    generate()
    expect(restoreSharedPaletteFromHash(hash)).toBe('restored')
    expect(shades.value).toEqual(edited)
    expect(generatedShades.value).toEqual(baseline)
    expect(endsState.value).toEqual(emptyEnds())
    expect(history.value).toHaveLength(1)
    expect(historyIndex.value).toBe(0)
  })
})
