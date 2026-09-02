import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('repository policy', () => {
  it('remains a private deployed app with the standard verification commands', () => {
    const manifest = JSON.parse(read('package.json')) as {
      private?: boolean
      packageManager?: string
      scripts?: Record<string, string>
    }

    expect(manifest.private).toBe(true)
    expect(manifest.packageManager).toBe('pnpm@11.21.0')
    expect(manifest.scripts).toMatchObject({
      'audit:all': expect.any(String),
      'docs:build': expect.any(String),
      'release:verify': expect.any(String),
      verify: expect.any(String),
    })
    expect(manifest.scripts).not.toHaveProperty('publish')
  })

  it('keeps dependency quarantine and reviewed lifecycle scripts enabled', () => {
    const workspace = read('pnpm-workspace.yaml')
    expect(workspace).toContain('minimumReleaseAge: 1440')
    expect(workspace).toContain('minimumReleaseAgeStrict: true')
    expect(workspace).toContain('minimumReleaseAgeIgnoreMissingTime: false')
    expect(workspace).toContain('esbuild: true')
    expect(workspace).toContain('vue-demi: true')
  })

  it('keeps the public and deployment contracts present', () => {
    const readme = read('README.md')
    const license = read('LICENSE')
    const vercel = JSON.parse(read('vercel.json')) as {
      buildCommand?: string
      outputDirectory?: string
    }

    for (const heading of [
      '## Why use Lupinum Colors?',
      '## When to use it',
      '## Requirements',
      '## Installation',
      '## Quick start',
      '## Support and security',
      '## License',
    ]) {
      expect(readme).toContain(heading)
    }
    expect(license).toContain('MIT License')
    expect(license).toContain('Copyright (c) 2026 Lupinum OG')
    expect(vercel).toMatchObject({ buildCommand: 'pnpm build', outputDirectory: 'dist' })
  })

  it('builds without a valid deployment baseline and skips an unchanged commit', () => {
    const run = (previousSha: string) =>
      spawnSync(process.execPath, ['scripts/vercel-ignore.mjs'], {
        cwd: new URL('..', import.meta.url),
        env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previousSha },
      }).status

    expect(run('0000000000000000000000000000000000000000')).toBe(1)
    expect(run('HEAD')).toBe(0)
  })

  it('pins every external GitHub Action to a full commit SHA', () => {
    const workflow = read('.github/workflows/ci.yml')
    const references = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1])
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      expect(reference).toMatch(/^[^/]+\/[^/@]+(?:\/[^@]+)?@[0-9a-f]{40}$/)
    }
  })
})
