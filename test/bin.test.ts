import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

describe('executable entrypoint', () => {
  it('runs the real CLI process', () => {
    const output = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'src/bin.ts', 'primary', '#89E5D2', '--seed', 'exact', '--format', 'css'],
      { cwd: projectRoot, encoding: 'utf8' },
    )
    expect(output).toContain(':root {')
    expect(output).toContain('--color-primary-300: oklch(85.901% 0.0927 179.245);')
  })

  it('returns a failing exit code and useful error for bad input', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/bin.ts', 'primary', 'not-a-color'],
      { cwd: projectRoot, encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Invalid color')
  })
})
