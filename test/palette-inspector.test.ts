// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import { clonePalette } from '../src/app/palette-tools'
import { generate, previewShades, seedColor, shades } from '../src/app/palette-store'
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
})
