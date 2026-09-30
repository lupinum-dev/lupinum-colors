// @vitest-environment happy-dom
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import App from '../src/App.vue'
import {
  anchor,
  commitShade,
  displayShades,
  gamut,
  generate,
  history,
  historyIndex,
  huePath,
  paletteName,
  referenceName,
  seedColor,
  seedMode,
  selectedShade,
  shades,
} from '../src/app/palette-store'
import { dismissToast } from '../src/app/toast'
class TestResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    this.callback(
      [{ contentRect: { width: 700 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
  disconnect(): void {}
  unobserve(): void {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver)
let wrapper: VueWrapper | undefined
beforeEach(() => {
  history.value = []
  historyIndex.value = -1
  paletteName.value = 'brand'
  seedColor.value = '#3b82f6'
  seedMode.value = 'exact'
  anchor.value = 'auto'
  gamut.value = 'srgb'
  huePath.value = 'balanced'
  referenceName.value = ''
  generate()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  dismissToast()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function render(): VueWrapper {
  wrapper = mount(App, { attachTo: document.body })
  return wrapper
}
describe('approved workbench', () => {
  it('keeps swatches, the Guide and attribution in prerendered HTML', async () => {
    const html = await renderToString(createSSRApp(App))
    expect(html.match(/role="radio"/g)).toHaveLength(11)
    for (const text of [
      'Copy for Tailwind',
      'Tailwind CSS',
      'not affiliated with or endorsed by Tailwind Labs',
      'Color scales you can explain',
    ])
      expect(html).toContain(text)
  })
  it('has no tabs or alternate editing spaces in the app panel', () => {
    const app = render().get('.app')
    expect(app.findAll('[role="tab"]')).toHaveLength(0)
    expect(app.text()).not.toMatch(/HSV|HSL/)
  })
  it('moves the single swatch tab stop, focus and selected-shade identity together', async () => {
    const w = render(),
      radios = w.findAll('.sw')
    expect(radios.filter((r) => r.attributes('tabindex') === '0')).toHaveLength(1)
    const index = radios.findIndex((r) => r.attributes('tabindex') === '0')
    await radios[index]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(radios[index + 1]!.element)
    expect(w.get('.shade h3').text()).toContain(`Shade ${selectedShade.value}`)
  })
  it('edits and navigates curve handles with one tab stop per lane', async () => {
    const w = render(),
      handles = w.findAll('circle[role="slider"]')
    expect(handles).toHaveLength(33)
    expect(handles.filter((h) => h.attributes('tabindex') === '0')).toHaveLength(3)
    const shade = selectedShade.value,
      previous = shades.value![shade].l,
      index = historyIndex.value
    await w.get(`#h-l-${shade}`).trigger('keydown', { key: 'ArrowUp' })
    expect(shades.value![shade].l).toBeCloseTo(previous + 0.001, 12)
    expect(historyIndex.value).toBe(index + 1)
    await w.get(`#h-l-${shade}`).trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement?.id).toBe(`h-l-${selectedShade.value}`)
  })
  it('validates exact fields and commits each changed value once', async () => {
    const w = render(),
      input = w.get('#f-c'),
      index = historyIndex.value
    await input.setValue('0.12')
    await input.trigger('change')
    expect(shades.value![selectedShade.value].c).toBe(0.12)
    expect(historyIndex.value).toBe(index + 1)
    await input.trigger('change')
    expect(historyIndex.value).toBe(index + 1)
    await input.setValue('2')
    await input.trigger('change')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('Chroma must be between 0 and 0.4.')
    await input.trigger('keydown', { key: 'Escape' })
    expect((input.element as HTMLInputElement).value).toBe('0.120')
  })
  it('generates from typing only after the 260 ms debounce', async () => {
    vi.useFakeTimers()
    const w = render(),
      previous = shades.value
    await w.get('#seed').setValue('#6f5bd6')
    expect(shades.value).toBe(previous)
    await vi.advanceTimersByTimeAsync(259)
    expect(shades.value).toBe(previous)
    await vi.advanceTimersByTimeAsync(1)
    expect(shades.value).not.toBe(previous)
    expect(w.get('.use').text()).toBe('Exact at 500')
  })
  it('handles global undo without hijacking source-field undo', async () => {
    const w = render()
    commitShade(300, { l: 0.72, c: 0.123, h: 287.5 })
    const index = historyIndex.value
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(historyIndex.value).toBe(index - 1)
    const inputEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    w.get('#seed').element.dispatchEvent(inputEvent)
    expect(inputEvent.defaultPrevented).toBe(false)
  })
  it('copies Tailwind tokens directly and opens code for clipboard failure recovery', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blocked'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const w = render(),
      copy = w.get('button[aria-label="Copy for Tailwind"]')
    await copy.trigger('click')
    await flushPromises()
    expect(writeText.mock.calls[0]![0]).toContain('@theme {')
    expect(writeText.mock.calls[0]![0]).toContain('--color-brand-500')
    expect(w.get('[role="status"][aria-live="polite"]').text()).toBe(
      'Copied Tailwind @theme block for brand, 11 colors.',
    )
    await copy.trigger('click')
    await flushPromises()
    expect(w.get('[role="status"][aria-live="polite"]').text()).toBe(
      'Copy was blocked. Select the code and copy it manually.',
    )
    expect(document.querySelector('[aria-label="Export code"]')?.textContent).toContain('@theme {')
  })
  it('labels all four end sliders and resets a named Zinc stop', async () => {
    seedColor.value = '#6f5bd6'
    generate()
    const w = render()
    expect(
      w
        .findAll('input[type="range"]')
        .map((r) => w.get(`label[for="${r.attributes('id')}"]`).text()),
    ).toEqual(['Color', 'Depth', 'Color', 'Brightness'])
    const original = shades.value![950].c
    await w
      .findAll('.stop')
      .find((s) => s.text() === 'Zinc')!
      .trigger('click')
    expect(shades.value![950].c).toBeCloseTo(0.005, 9)
    await w.get('[aria-label="Reset color of dark shades"]').trigger('click')
    expect(shades.value![950].c).toBe(original)
  })
  it('protects an anchor at 800 and describes the shorter dark tail', () => {
    seedColor.value = '#315d3b'
    generate()
    const w = render()
    expect(w.get('.grp').text()).toContain('900 to 950')
  })
  it('shows gamut mapping and never invents HEX for Display P3', async () => {
    seedColor.value = '#d9e900'
    generate()
    const w = render(),
      mapped = displayShades.value.filter((e) => !e.inGamut)
    expect(mapped.length).toBeGreaterThan(0)
    expect(w.findAll('.sw-icons [title="Mapped to the display range"]')).toHaveLength(mapped.length)
    expect(w.get('.notice').text()).toContain(mapped.map((e) => e.shade).join(', '))
    gamut.value = 'display-p3'
    generate()
    await nextTick()
    expect(w.findAll('.sw-hex').every((e) => e.text() === '')).toBe(true)
    expect(w.get('button[aria-label^="Copy HEX"]').attributes('disabled')).toBeDefined()
  })
  it('shows ten preview pairs and toggles all 169 matrix cells', async () => {
    const w = render()
    expect(w.findAll('.pairs tbody tr')).toHaveLength(10)
    await w.get('button[aria-controls="matrix"]').trigger('click')
    expect(w.findAll('.matrix td')).toHaveLength(169)
    await w.get('button[aria-controls="matrix"]').trigger('click')
    expect(w.find('#matrix').exists()).toBe(false)
  })
  it('keeps the shared palette fragment when navigating to the Guide', async () => {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    const w = render(),
      hash = window.location.hash
    await w.get('a[href="#how-it-works"]').trigger('click')
    expect(window.location.hash).toBe(hash)
  })
})
