// @vitest-environment happy-dom

import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import {
  canRedo,
  canUndo,
  commitPalette,
  displayShades,
  generate,
  generationError,
  historyIndex,
  overlayConfigs,
  seedColor,
  shades,
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
    expect(html.match(/<button/g)).toHaveLength(11)
    expect(html).toContain('#f7f6f4')
  })

  it('keeps the strips and curves rendered after measurement', async () => {
    seedColor.value = '#F7F6F4'
    generate()
    const wrapper = mount(PaletteEditor)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.strip')).toHaveLength(11)
    expect(wrapper.findAll('.line')).toHaveLength(3)
    expect(wrapper.findAll('.handle')).toHaveLength(33)
  })

  it('keeps the complete workbench populated after generating from the UI', async () => {
    const wrapper = mount(App)
    await wrapper.get('#seed').setValue('#F7F6F4')
    await wrapper.get('button.generate').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.strip')).toHaveLength(11)
    expect(wrapper.findAll('.reference-row')).toHaveLength(3)
    expect(wrapper.findAll('.handle')).toHaveLength(33)
    expect(wrapper.text()).toContain('brand-500')
    wrapper.unmount()
  })

  it('supports application undo and redo shortcuts without hijacking text fields', async () => {
    seedColor.value = '#F7F6F4'
    generate()
    const wrapper = mount(App)
    const originalChroma = shades.value![500].c
    commitPalette(
      { ...shades.value!, 500: { ...shades.value![500], c: originalChroma * 0.5 } },
      'Test keyboard history',
    )

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
