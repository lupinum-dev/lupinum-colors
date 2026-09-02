// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'
import ProductGuide from '@/components/ProductGuide.vue'

describe('Lupinum Colors product guide', () => {
  it('explains the method, local processing, and product independence', async () => {
    const wrapper = mount(ProductGuide, { props: { tailwindVersion: '4.3.3' } })

    expect(wrapper.text()).toContain('Color scales you can explain')
    expect(wrapper.text()).toContain('all 26 color families in Tailwind CSS 4.3.3')

    const accordionTriggers = wrapper.findAll('[data-slot="accordion-trigger"]')
    expect(accordionTriggers).toHaveLength(4)

    await accordionTriggers[0]!.trigger('click')
    expect(accordionTriggers[0]!.attributes('data-state')).toBe('open')

    await accordionTriggers[2]!.trigger('click')
    expect(wrapper.text()).toContain('your palette values are not sent to Lupinum')

    await accordionTriggers[3]!.trigger('click')
    expect(wrapper.text()).toContain('not affiliated with or endorsed by Tailwind Labs')
  })

  it('links to Lupinum with campaign attribution', () => {
    const wrapper = mount(ProductGuide)
    const contactLink = wrapper.get('a[href*="lupinum.com/kontakt"]')

    expect(contactLink.attributes('href')).toContain('utm_campaign=lupinum-colors')
    expect(contactLink.text()).toBe('Discuss a project with Lupinum')
  })

  it('links to the public source, license, and community', () => {
    const wrapper = mount(ProductGuide)

    expect(wrapper.get('a[href="https://github.com/lupinum-dev/lupinum-colors"]').text()).toBe(
      'Source',
    )
    expect(wrapper.get('a[href$="/blob/main/LICENSE"]').text()).toBe('MIT License')
    expect(wrapper.get('a[href="https://discord.gg/RPH6SeA36N"]').text()).toBe('Discord')
  })
})
