# Working on Lupinum Colors

## Architecture

- `src/palette.ts`, `src/color.ts`, and `src/types.ts` own framework-neutral
  palette generation and color contracts.
- `src/app/` owns editor state and application-specific transformations.
- `src/components/` owns the Vue interface.
- `reference/` contains generated Tailwind color calibration data.
- `scripts/build-reference.ts` is the only path that regenerates that data.
- `public/` owns deployed static assets and discovery files.
- `test/` verifies generator, state, accessibility, SSR, metadata, and CLI
  invariants.

This repository deploys one static application. It does not publish an npm
package and has no production backend.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm docs:build
pnpm audit:all
pnpm release:verify
```

Run `pnpm verify` before handoff. Run `pnpm release:verify` before a production
deployment or open-source launch review.

## Invariants

- Canonical palette state uses OKLCH. HSL and HSV are derived views.
- The generated baseline and current committed palette are separate values.
- Shared palette state uses the validated `SharedPaletteV1` URL-fragment
  contract. Do not put theme, temporary previews, undo history, or other
  cosmetics into the shared payload.
- URL fragments must not be described as server-side storage. Browsers do not
  send fragments in HTTP requests.
- The build must verify the committed Tailwind reference version and digest.
- Keep palette editing available through exact numeric fields and keyboard
  input, not pointer input alone.
- Preserve a static deployment. Do not add a backend, account system, or remote
  palette storage without an explicit product decision.
- Do not add npm publication workflows, package release files, or `NPM_TOKEN`.
- Do not bypass the 24-hour dependency quarantine. A temporary exception must
  name one exact version, reason, owner, and removal date.
- Keep public text in Lupinum Controlled English as defined in
  `docs/WRITING.md`.
- Preserve Tailwind attribution and the independence disclaimer.

## Deployment

Vercel deploys the repository root. Pull requests use previews. Current `main`
deploys production. Follow `MAINTAINING.md` for verification and rollback.

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
