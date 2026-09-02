// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import { clonePalette } from '../src/app/palette-tools'
import {
  channelMode,
  clearPreview,
  generate,
  historyIndex,
  inspectorTab,
  previewShades,
  seedColor,
  selectedShade,
  shades,
} from '../src/app/palette-store'
import PaletteInspector from '../src/components/PaletteInspector.vue'

describe('palette endpoint controls', () => {
  it('previews and applies neutral endpoints without changing the anchor', async () => {
    seedColor.value = '#d9e900'
    generate()
    const original = clonePalette(shades.value!)
    const middleBefore = { ...shades.value![500] }
    const wrapper = mount(PaletteInspector)

    expect(wrapper.text()).toContain('Scale ends')

    const neutral = wrapper.findAll('button').find((button) => button.text().trim() === 'Neutral')!
    await neutral.trigger('click')

    expect(previewShades.value).not.toBeNull()
    expect(previewShades.value![50].c).toBe(0)
    expect(previewShades.value![950].c).toBe(0)
    expect(previewShades.value![500]).toEqual(middleBefore)
    expect(wrapper.text()).toContain('Apply changes')
    expect(wrapper.text()).toContain('Adjusting scale ends across 4 shades')

    const apply = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Apply changes')!
    await apply.trigger('click')
    await wrapper.vm.$nextTick()

    expect(previewShades.value).toBeNull()
    expect(shades.value![50].c).toBe(0)
    expect(shades.value![950].c).toBe(0)
    expect(shades.value![500]).toEqual(middleBefore)
    expect(neutral.attributes('aria-pressed')).toBe('true')

    const twoShades = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '2 shades')!
    await twoShades.trigger('click')

    expect(previewShades.value).not.toBeNull()
    expect(previewShades.value![700]).toEqual(original[700])

    const cancel = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Discard preview')!
    await cancel.trigger('click')

    const fourShades = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '4 shades')!
    expect(previewShades.value).toBeNull()
    expect(fourShades.attributes('aria-pressed')).toBe('true')
    expect(shades.value![950].c).toBe(0)
    wrapper.unmount()
  })

  it('shares one endpoint draft across inspector instances and external cancellation', async () => {
    seedColor.value = '#d9e900'
    generate()
    const desktop = mount(PaletteInspector)
    const mobile = mount(PaletteInspector)

    const neutral = desktop.findAll('button').find((button) => button.text().trim() === 'Neutral')!
    await neutral.trigger('click')

    const mobileNeutral = mobile
      .findAll('button')
      .find((button) => button.text().trim() === 'Neutral')!
    expect(mobileNeutral.attributes('aria-pressed')).toBe('true')

    clearPreview()
    await desktop.vm.$nextTick()

    const desktopOriginal = desktop
      .findAll('button')
      .find((button) => button.text().trim() === 'Original')!
    const mobileOriginal = mobile
      .findAll('button')
      .find((button) => button.text().trim() === 'Original')!
    expect(previewShades.value).toBeNull()
    expect(desktopOriginal.attributes('aria-pressed')).toBe('true')
    expect(mobileOriginal.attributes('aria-pressed')).toBe('true')

    desktop.unmount()
    mobile.unmount()
  })
})

describe('exact shade controls', () => {
  it('edits the selected shade with one validated snapshot', async () => {
    seedColor.value = '#3b82f6'
    generate()
    selectedShade.value = 500
    channelMode.value = 'oklch'
    inspectorTab.value = 'shade'
    const wrapper = mount(PaletteInspector)
    const inputs = wrapper.findAll<HTMLInputElement>('.shade-fields input')
    expect(inputs).toHaveLength(3)
    expect(wrapper.text()).toContain('Shade 500')
    expect(wrapper.text()).toContain('Lightness')
    expect(wrapper.text()).toContain('Chroma')
    expect(wrapper.text()).toContain('Hue')

    const before = historyIndex.value
    inputs[1]!.element.value = '0.12'
    await inputs[1]!.trigger('input')
    await inputs[1]!.trigger('change')
    expect(shades.value![500].c).toBeCloseTo(0.12)
    expect(historyIndex.value).toBe(before + 1)
    await inputs[1]!.trigger('change')
    expect(historyIndex.value).toBe(before + 1)

    inputs[1]!.element.value = '2'
    await inputs[1]!.trigger('input')
    await inputs[1]!.trigger('change')
    expect(inputs[1]!.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Chroma must be between 0 and 0.4')
    expect(historyIndex.value).toBe(before + 1)

    await inputs[1]!.trigger('keydown', { key: 'Escape' })
    expect(inputs[1]!.element.value).not.toBe('2')
    wrapper.unmount()
  })

  it('switches the three derived fields with the active color model', async () => {
    generate()
    inspectorTab.value = 'shade'
    channelMode.value = 'hsv'
    const wrapper = mount(PaletteInspector)
    expect(wrapper.findAll('.shade-fields input')).toHaveLength(3)
    expect(wrapper.text()).toContain('Saturation')
    expect(wrapper.text()).toContain('Value')
    wrapper.unmount()
  })
})
