import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('search metadata', () => {
  it('uses the Lupinum Colors domain and primary search intent consistently', () => {
    expect(indexHtml).toContain('<title>Tailwind Color Shade Generator — Lupinum Colors</title>')
    expect(indexHtml).toContain('<link rel="canonical" href="https://colors.lupinum.com/" />')
    expect(indexHtml).toContain('content="https://colors.lupinum.com/og-image.png"')
    expect(indexHtml).not.toContain('tsg.lupinum.com')
  })

  it('declares a site identity and free web application in structured data', () => {
    const structuredData = indexHtml.match(
      /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/,
    )?.[1]

    expect(structuredData).toBeDefined()
    const graph = JSON.parse(structuredData ?? '{}')['@graph'] as Array<Record<string, unknown>>

    expect(graph).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'WebSite', name: 'Lupinum Colors' }),
        expect.objectContaining({
          '@type': 'WebApplication',
          name: 'Tailwind shade generator',
          offers: expect.objectContaining({ price: '0' }),
        }),
      ]),
    )
  })
})
