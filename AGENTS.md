# Working on Lupinum Colors

Read this file before changing the repository. `README.md` explains the
product, `CONTRIBUTING.md` explains contributor expectations, and
`MAINTAINING.md` owns operational procedures.

## Product boundary

Lupinum Colors is a static, browser-based palette generator that places an
input color within the color principles inferred from Tailwind CSS. It does
not publish an npm package and has no production backend.

## Architecture

- `src/palette.ts`, `src/color.ts`, and `src/types.ts` own framework-neutral
  palette generation and color contracts.
- `src/app/` owns editor state and application-specific transformations.
- `src/components/` owns the Vue interface.
- `reference/` contains generated Tailwind color calibration data.
- `scripts/build-reference.ts` is the only path that regenerates that data.
- `public/` owns deployed static assets and discovery files.
- `test/` verifies generator behavior, state, accessibility, SSR, metadata,
  and CLI contracts.

Keep palette logic independent of Vue and browser APIs. Keep each important
concept in one source of truth. Prefer deletion, then simplification, then
replacement, and only then addition.

## Public contracts and invariants

- Canonical palette state uses OKLCH. HSL and HSV are derived views.
- The generated baseline and current committed palette are separate values.
- Shared palettes use the validated `SharedPaletteV1` URL-fragment contract.
  Do not include theme, temporary previews, undo history, or other cosmetic
  state in the payload.
- Browsers do not send URL fragments to the server. Do not describe shared
  links as remote storage.
- The build must verify the committed Tailwind reference version and digest.
- Preserve exact numeric fields, keyboard editing, Tailwind attribution, and
  the independence disclaimer.
- Keep the deployment static. Do not add accounts, a backend, remote palette
  storage, or npm publication without an explicit product decision.
- Keep the Workbench focused on editing. Put explanatory content in the
  in-app Guide and keep it available in prerendered HTML.

## Working method

1. Read the relevant source, tests, and current `git status` before editing.
2. Preserve unrelated user changes. Do not rewrite or discard them.
3. Make the smallest direct change that solves the stated problem.
4. Add focused tests when behavior, accessibility, or a public contract
   changes.
5. Update public documentation when supported behavior changes.
6. Use Conventional Commits for commit and pull-request titles.

Do not commit credentials, customer data, private palette data, local plans,
agent transcripts, generated scratch files, or temporary migration notes.
Track a migration only while real compatibility work remains.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm verify
pnpm docs:build
pnpm audit:all
pnpm release:verify
```

Run `pnpm verify` before handoff. Run `pnpm release:verify` before a production
deployment or open-source launch review.

## Prohibited actions

- Do not regenerate `reference/` through any path except
  `scripts/build-reference.ts`.
- Do not bypass the dependency release-age policy for convenience.
- Do not add `NPM_TOKEN`, package-release workflows, or a second package
  manager.
- Do not push, deploy, publish, transfer the repository, change DNS, or mutate
  external services unless the user explicitly authorizes that action.
- Do not weaken tests, accessibility, attribution, reference verification, or
  public contracts to make a check pass.

Follow `MAINTAINING.md` for deployment, rollback, dependency updates, and
incident response.
