// @vitest-environment happy-dom

import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  canRedo,
  canUndo,
  committedPaletteName,
  commitPalette,
  displayShades,
  gamut,
  generate,
  generationError,
  generationIssue,
  historyIndex,
  huePath,
  overlayConfigs,
  paletteName,
  seedColor,
  shades,
  warnings,
} from '../src/app/palette-store'
import App from '../src/App.vue'
import PaletteEditor from '../src/components/PaletteEditor.vue'

class TestResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    this.callback(
      [{ contentRect: { width: 1100, height: 560 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
  disconnect(): void {}
  unobserve(): void {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

describe('palette editor rendering', () => {
  it('renders every generated strip for a near-neutral exact seed', async () => {
    seedColor.value = '#F7F6F4'
    generate()

    expect(generationError.value).toBeNull()
    expect(displayShades.value).toHaveLength(11)
    expect(overlayConfigs.value).toHaveLength(3)

    const html = await renderToString(createSSRApp(PaletteEditor))
    expect(html.match(/class="strip"/g)).toHaveLength(11)
    expect(html).toContain('#f7f6f4')
  })

  it('keeps the strips and curves rendered after measurement', async () => {
    seedColor.value = '#F7F6F4'
    generate()
    const wrapper = mount(PaletteEditor)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.strip')).toHaveLength(11)
    expect(wrapper.findAll('.line')).toHaveLength(3)
    expect(wrapper.find('.line').attributes('d')).toContain(' C ')
    expect(wrapper.find('.pin-ring').exists()).toBe(false)
    expect(wrapper.findAll('.handle-hit')).toHaveLength(33)
    const firstHandle = wrapper.get('.handle-hit')
    expect(firstHandle.attributes('aria-label')).toContain('Lightness, shade')
    expect(firstHandle.attributes('aria-valuetext')).toMatch(/%$/)
    expect(wrapper.findAll('[data-marker="circle"]')).toHaveLength(11)
    expect(wrapper.findAll('[data-marker="square"]')).toHaveLength(11)
    expect(wrapper.findAll('[data-marker="diamond"]')).toHaveLength(11)
  })

  it('keeps the complete workbench populated after generating from the UI', async () => {
    const wrapper = mount(App)
    await wrapper.get('#seed').setValue('#F7F6F4')
    await wrapper.get('button.generate').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.strip')).toHaveLength(11)
    const referencesTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === 'References')
    await referencesTab!.trigger('mousedown', { button: 0 })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.reference-row')).toHaveLength(3)
    expect(
      wrapper
        .findAll<HTMLSelectElement>('.reference-controls select')
        .every((select) => Boolean(select.element.value)),
    ).toBe(true)
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Reference palette to add"]').element.value,
    ).not.toBe('')
    expect(wrapper.findAll('.handle-hit')).toHaveLength(33)
    expect(wrapper.text()).toContain('brand-500')
    wrapper.unmount()
  })

  it('names and marks shades adjusted to the selected display range', async () => {
    seedColor.value = '#d9e900'
    gamut.value = 'srgb'
    generate()
    const adjusted = displayShades.value.filter((shade) => !shade.inGamut)

    expect(adjusted.length).toBeGreaterThan(0)
    expect(warnings.value.join(' ')).toContain(
      `${adjusted.length === 1 ? 'Shade' : 'Shades'} ${adjusted.map((shade) => shade.shade).join(', ')}`,
    )
    expect(warnings.value.join(' ')).toContain('preview and exported values')

    const wrapper = mount(App)
    expect(wrapper.findAll('.gamut-indicator')).toHaveLength(adjusted.length)
    wrapper.unmount()
  })

  it('does not invent sRGB hex values for wider gamut output', async () => {
    seedColor.value = '#d9e900'
    gamut.value = 'display-p3'
    generate()

    expect(displayShades.value.every((shade) => shade.hex === undefined)).toBe(true)
    const wrapper = mount(PaletteEditor)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.strip-hex').every((label) => label.text() === '—')).toBe(true)
    wrapper.unmount()
  })

  it('keeps committed identity and hue state when generation fails for another input', async () => {
    paletteName.value = 'brand'
    seedColor.value = '#89E5D2'
    huePath.value = 'balanced'
    generate()
    huePath.value = 'emerald'

    const wrapper = mount(App)
    await wrapper.get('#name').setValue('not valid!')

    expect(committedPaletteName.value).toBe('brand')
    const exportTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === 'Export')!
    await exportTab.trigger('mousedown', { button: 0 })
    expect(wrapper.get('pre').text()).toContain('--color-brand-500')
    expect(wrapper.get('pre').text()).not.toContain('not valid!')

    generate()
    expect(generationError.value).toMatch(/Palette name/)
    expect(generationIssue.value?.field).toBe('name')
    expect(huePath.value).toBe('emerald')
    expect(committedPaletteName.value).toBe('brand')

    wrapper.unmount()
    paletteName.value = 'brand'
    huePath.value = 'balanced'
  })

  it('links generation errors to the invalid field and moves focus there', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('#name').setValue('not valid!')
    await wrapper.get('button.generate').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#name').attributes('aria-describedby')).toBe('name-error')
    expect(wrapper.get('#name-error').text()).toContain('Palette name')
    expect(document.activeElement).toBe(wrapper.get('#name').element)
    wrapper.unmount()
  })

  it('keeps the live palette fragment while moving to page sections', async () => {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    generate()
    const hash = window.location.hash
    const wrapper = mount(App)

    await wrapper.get('a[href="#how-it-works"]').trigger('click')
    expect(window.location.hash).toBe(hash)
    await wrapper.get('a[aria-label="Lupinum Colors, back to generator"]').trigger('click')
    expect(window.location.hash).toBe(hash)
    await wrapper.get('a.fixed[href="#main-content"]').trigger('click')
    expect(window.location.hash).toBe(hash)
    wrapper.unmount()
  })

  it('supports application undo and redo shortcuts without hijacking text fields', async () => {
    seedColor.value = '#F7F6F4'
    generate()
    const wrapper = mount(App)
    const originalChroma = shades.value![500].c
    commitPalette({ ...shades.value!, 500: { ...shades.value![500], c: originalChroma * 0.5 } })

    expect(canUndo.value).toBe(true)
    const committedIndex = historyIndex.value
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(undoEvent)
    await wrapper.vm.$nextTick()
    expect(undoEvent.defaultPrevented).toBe(true)
    expect(historyIndex.value).toBe(committedIndex - 1)
    expect(shades.value![500].c).toBe(originalChroma)
    expect(canRedo.value).toBe(true)

    const redoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(redoEvent)
    await wrapper.vm.$nextTick()
    expect(redoEvent.defaultPrevented).toBe(true)
    expect(historyIndex.value).toBe(committedIndex)
    expect(shades.value![500].c).toBe(originalChroma * 0.5)

    const seedInput = wrapper.get('#seed')
    const inputUndoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    seedInput.element.dispatchEvent(inputUndoEvent)
    expect(inputUndoEvent.defaultPrevented).toBe(false)
    expect(historyIndex.value).toBe(committedIndex)
    wrapper.unmount()
  })
})
