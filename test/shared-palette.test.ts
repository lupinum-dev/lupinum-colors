// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  decodeSharedPalette,
  encodeSharedPalette,
  paletteToTuple,
  type SharedPaletteV1,
} from '../src/app/shared-palette'
import {
  applyPreview,
  beginContinuousEdit,
  commitPalette,
  endContinuousEdit,
  generate,
  generatedShades,
  historyIndex,
  paletteName,
  redo,
  resetToGenerated,
  restoreSharedPaletteFromHash,
  seedColor,
  setPreview,
  setShadeColor,
  shades,
  undo,
} from '../src/app/palette-store'
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
    generate()
    const afterGenerate = replaceState.mock.calls.length

    const shade = shades.value![500]
    beginContinuousEdit()
    setShadeColor(500, { ...shade, c: shade.c * 0.8 })
    setPreview(shades.value!, 'Preview only')
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate)

    endContinuousEdit()
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 1)
    const committed = clonePalette(shades.value!)
    commitPalette(committed)
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 1)

    undo()
    redo()
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 3)
    expect(historyIndex.value).toBe(1)

    resetToGenerated()
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 4)
    const endpointEdit = clonePalette(shades.value!)
    endpointEdit[50] = { ...endpointEdit[50], l: endpointEdit[50].l - 0.01 }
    setPreview(endpointEdit, 'Endpoint preview')
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 4)
    applyPreview()
    expect(replaceState).toHaveBeenCalledTimes(afterGenerate + 5)
  })

  it('restores the exact current palette and generated reset baseline', () => {
    const baseline = clonePalette(generatedShades.value!)
    const edited = clonePalette(shades.value!)
    edited[300] = { l: 0.72, c: 0.123, h: 287.5 }
    commitPalette(edited)
    const hash = window.location.hash

    seedColor.value = '#fff'
    generate()
    expect(restoreSharedPaletteFromHash(hash)).toBe('restored')
    expect(shades.value).toEqual(edited)
    expect(generatedShades.value).toEqual(baseline)
  })
})
