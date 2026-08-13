// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { displayShades, generate, paletteName, seedColor } from '../src/app/palette-store'
import AnalysisWorkspace from '../src/components/AnalysisWorkspace.vue'
import ContrastGrid from '../src/components/ContrastGrid.vue'
import PalettePreview from '../src/components/PalettePreview.vue'

beforeEach(() => {
  paletteName.value = 'brand'
  seedColor.value = '#3b82f6'
  generate()
})

describe('analysis workspace', () => {
  it('switches between preview, contrast, and token tools', async () => {
    const wrapper = mount(AnalysisWorkspace, {
      props: { name: 'brand', shades: displayShades.value, appTheme: 'light' },
    })

    expect(wrapper.text()).toContain('Palette preview')
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs.find((tab) => tab.text() === 'Contrast')!.trigger('mousedown', { button: 0 })
    expect(wrapper.text()).toContain('Contrast matrix')
    await tabs.find((tab) => tab.text() === 'Tokens')!.trigger('mousedown', { button: 0 })
    expect(wrapper.text()).toContain('Production tokens')
  })

  it('lets the preview appearance differ from the app theme', async () => {
    const wrapper = mount(PalettePreview, {
      props: { name: 'brand', shades: displayShades.value, appTheme: 'light' },
    })

    expect(wrapper.get('.preview-stage').classes()).not.toContain('preview-dark')
    await wrapper.get('button[value="components"]').trigger('click')
    expect(wrapper.get<HTMLSelectElement>('#preview-role').element.value).toBe('designer')
    await wrapper.get('button[value="dark"]').trigger('click')
    expect(wrapper.get('.preview-stage').classes()).toContain('preview-dark')
    await wrapper.get('button[value="auto"]').trigger('click')
    expect(wrapper.get('.preview-stage').classes()).not.toContain('preview-dark')
  })
})

describe('contrast analysis', () => {
  it('renders every pair and reports requirements without hiding cells', async () => {
    const wrapper = mount(ContrastGrid, {
      props: { name: 'brand', shades: displayShades.value },
    })

    expect(wrapper.findAll('.matrix-cell')).toHaveLength(169)
    expect(wrapper.text()).toContain('brand-950 on brand-50')
    await wrapper.get('button[value="all"]').trigger('click')
    expect(wrapper.text()).toContain('169 combinations')
    expect(wrapper.findAll('.matrix-cell')).toHaveLength(169)
  })

  it('pins, swaps, and navigates pairs with one roving tab stop', async () => {
    const wrapper = mount(ContrastGrid, {
      props: { name: 'brand', shades: displayShades.value },
      attachTo: document.body,
    })
    const cells = wrapper.findAll<HTMLButtonElement>('.matrix-cell')

    expect(cells.filter((cell) => cell.attributes('tabindex') === '0')).toHaveLength(1)
    expect(cells[24]!.attributes('tabindex')).toBe('0')

    await cells[24]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.findAll('.matrix-cell')[25]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[25]!.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.findAll('.matrix-cell')[38]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[38]!.trigger('keydown', { key: 'Home' })
    expect(wrapper.findAll('.matrix-cell')[26]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[26]!.trigger('keydown', { key: 'End' })
    expect(wrapper.findAll('.matrix-cell')[38]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[38]!.trigger('keydown', { key: 'Home', ctrlKey: true })
    expect(wrapper.findAll('.matrix-cell')[0]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[0]!.trigger('keydown', { key: 'End', metaKey: true })
    expect(wrapper.findAll('.matrix-cell')[168]!.attributes('tabindex')).toBe('0')
    await wrapper.findAll('.matrix-cell')[168]!.trigger('keydown', { key: ' ' })
    expect(wrapper.text()).toContain('black on black')
    await wrapper.findAll('.matrix-cell')[0]!.trigger('focus')
    expect(wrapper.text()).toContain('white on white')
    await wrapper.findAll('.matrix-cell')[0]!.trigger('keydown', { key: 'Escape' })
    expect(wrapper.text()).toContain('black on black')

    await wrapper.findAll('.matrix-cell')[1]!.trigger('click')
    expect(wrapper.text()).toContain('brand-50 on white')
    await wrapper.get('.pair-detail button').trigger('click')
    expect(wrapper.text()).toContain('white on brand-50')
    wrapper.unmount()
  })
})
