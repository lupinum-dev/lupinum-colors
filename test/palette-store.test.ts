// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { adjustEnd, anchor, commit, committedPaletteName, commitShade, endsState, gamut, generate, generatedShades, generationError, history, historyIndex, huePath, nameIsValid, paletteName, redo, referenceName, referenceRanks, seedColor, seedMode, shades, undo, updateGeneration } from '../src/app/palette-store'
import { clonePalette } from '../src/app/palette-tools'
import { emptyEnds } from '../src/app/scale-ends'
beforeEach(() => {
  history.value = []; historyIndex.value = -1
  paletteName.value = 'brand'; seedColor.value = '#3b82f6'; seedMode.value = 'exact'; anchor.value = 'auto'; gamut.value = 'srgb'; huePath.value = 'balanced'; referenceName.value = ''
  generate()
})
describe('workbench palette state', () => {
  it('undoes regeneration back to edited shades, source and baseline', () => {
    const baseline = clonePalette(generatedShades.value!)
    commitShade(300, { l: 0.72, c: 0.123, h: 287.5 })
    const edited = clonePalette(shades.value!)
    seedColor.value = '#6f5bd6'
    expect(generate()).toEqual({ ok: true, replaced: 1 })
    undo()
    expect(shades.value).toEqual(edited)
    expect(seedColor.value).toBe('#3b82f6')
    expect(generatedShades.value).toEqual(baseline)
  })
  it('keeps the last palette for invalid color input', () => {
    const previous = clonePalette(shades.value!)
    seedColor.value = '#6f5bd'
    expect(generate()).toEqual({ ok: false })
    expect(generationError.value).toContain('#6f5bd')
    expect(shades.value).toEqual(previous)
  })
  it('keeps invalid names out of generation and tokens', () => {
    paletteName.value = 'not valid!'
    expect(nameIsValid.value).toBe(false)
    expect(committedPaletteName.value).toBe('brand')
    expect(generate().ok).toBe(true)
  })
  it('undoes and redoes both end colors and adjustment state', () => {
    const previous = shades.value![950].c
    adjustEnd('dark', { chroma: 0 }); commit(); undo()
    expect(shades.value![950].c).toBe(previous)
    expect(endsState.value.dark).toEqual(emptyEnds().dark)
    redo()
    expect(shades.value![950].c).toBe(0)
    expect(endsState.value.dark.chroma).toBe(0)
  })
  it('defaults to the best comparison and preserves Nothing', () => {
    expect(referenceName.value).toBe(referenceRanks.value[0]!.family.name)
    referenceName.value = 'none'; generate()
    expect(referenceName.value).toBe('none')
  })
  it('records settings-only regeneration for undo and sharing', () => {
    updateGeneration({ gamut: 'display-p3' })
    expect(history.value).toHaveLength(2)
    undo(); expect(gamut.value).toBe('srgb')
    redo(); expect(gamut.value).toBe('display-p3')
  })
})
