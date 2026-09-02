// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import ProductGuide from '@/components/ProductGuide.vue'

describe('Lupinum Colors product guide', () => {
  it('explains the method, local processing, and product independence', () => {
    const wrapper = mount(ProductGuide, { props: { tailwindVersion: '4.3.3' } })

    expect(wrapper.text()).toContain('Color scales you can explain')
    expect(wrapper.text()).toContain('all 26 color families in Tailwind CSS 4.3.3')
    expect(wrapper.text()).toContain('your palette values are not sent to Lupinum')
    expect(wrapper.text()).toContain('not affiliated with or endorsed by Tailwind Labs')
  })

  it('links to Lupinum with campaign attribution', () => {
    const wrapper = mount(ProductGuide)
    const contactLink = wrapper.get('a[href*="lupinum.com/kontakt"]')

    expect(contactLink.attributes('href')).toContain('utm_campaign=lupinum-colors')
    expect(contactLink.text()).toBe('Discuss a project with Lupinum')
  })
})
