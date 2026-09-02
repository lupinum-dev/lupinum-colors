# Contributing

Thanks for contributing to Lupinum Colors.

## Before you start

Open an issue before a non-trivial feature or architectural change. Small bug
fixes and documentation corrections can go directly to a focused pull request.

Do not include private palette data, credentials, or undisclosed security
details in an issue, test fixture, screenshot, or pull request.

## Setup

Use the Node.js and pnpm versions declared in `package.json`. Install the
committed dependency graph:

```sh
pnpm install --frozen-lockfile
```

Do not regenerate the lockfile with npm, Yarn, Bun, or another pnpm release.
Do not bypass the repository's dependency release-age policy.

Start the application:

```sh
pnpm dev
```

## Make a change

- Keep each pull request focused on one user outcome.
- Preserve canonical OKLCH palette state.
- Add focused tests when behavior or a public contract changes.
- Update public text when the interface or workflow changes.
- Include desktop and mobile images for a visual change.
- Follow [docs/WRITING.md](docs/WRITING.md) for public prose.

## Verify the result

Run the complete local gate before review:

```sh
pnpm verify
```

Explain any check that you could not run. For an interface change, also verify
the affected journey with a keyboard and at a narrow viewport.

## Pull requests

Describe the result, verification, and main risk. Address current review
threads before merge. Do not force-push shared work without agreement.

This repository deploys an application. It does not publish an npm package.
Do not add npm publication workflows, package release files, or `NPM_TOKEN`.
