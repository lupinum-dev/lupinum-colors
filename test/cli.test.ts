import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { parseArguments, runCli } from '../src/cli.js'

afterEach(() => vi.restoreAllMocks())

describe('CLI', () => {
  it('parses the complete option set', () => {
    expect(
      parseArguments([
        'primary',
        '#89E5D2',
        '--seed',
        'canonical',
        '--at',
        '500',
        '--hue-path',
        'emerald',
        '--gamut',
        'display-p3',
        '--format',
        'json',
        '--inspect',
        '--explain',
      ]),
    ).toMatchObject({
      name: 'primary',
      color: '#89E5D2',
      seed: 'canonical',
      anchor: 500,
      huePath: 'emerald',
      gamut: 'display-p3',
      format: 'json',
      inspect: true,
      explain: true,
    })
  })

  it('prints all required JSON data', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const options = parseArguments(['primary', '#89E5D2', '--seed', 'exact', '--format', 'json'])
    const [result] = runCli(options)
    expect(result.input.original).toBe('#89E5D2')
    expect(result.configuration.anchor).toBe(300)
    expect(result.shades[300]).toMatchObject({ hex: '#89e5d2' })
    expect(result.shades[300].contrastOnWhite).toBeTypeOf('number')
    expect(output).toHaveBeenCalledOnce()
    expect(output.mock.calls[0][0]).toContain('"tailwindVersion"')
  })

  it('prints Tailwind @theme variables', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    runCli(parseArguments(['brand', '#89E5D2', '--seed', 'canonical', '--format', 'tailwind']))
    const text = output.mock.calls.flat().join('\n')
    expect(text).toContain('@theme {')
    expect(text).toContain('--color-brand-500:')
    expect(text).toContain('}')
  })

  it('rejects invalid options', () => {
    expect(() => parseArguments(['primary', '#fff', '--seed', 'maybe'])).toThrow(
      /--seed must be one of/,
    )
    expect(() => parseArguments(['primary', '#fff', '--at', '450'])).toThrow(/--at must be auto/)
  })
})
