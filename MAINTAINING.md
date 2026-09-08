# Maintaining Lupinum Colors

This file is the operational source of truth for maintainers.
`CONTRIBUTING.md` defines contributor scope.

## Architecture and boundaries

- `src/palette.ts`, `src/color.ts`, and `src/types.ts` own framework-neutral palette generation and color contracts.
- `src/app/` owns editor state and application transformations.
- `src/components/` owns the Vue interface.
- `reference/` contains generated Tailwind calibration data. Only `scripts/build-reference.ts` regenerates it.
- Canonical palette state uses OKLCH. HSL and HSV are derived views.
- Shared palettes use the validated URL-fragment contract. Browsers do not send fragments to the server.
- Keep the deployment static. Do not add accounts, a backend, remote palette storage, or npm publication without an explicit product decision.
- Preserve keyboard and numeric editing, Tailwind attribution, and the independence disclaimer.

## Normal change

```sh
pnpm install --frozen-lockfile
pnpm verify
```

Open a focused pull request. Review the Vercel preview when the interface,
metadata, or build changes. Merge only after required checks pass.

## Quick fix

Keep the change narrow. Add a regression test when behavior changes. Run
`pnpm verify`. Use the normal pull-request and deployment path.

## Large change

Open an issue first. State the user problem, compatibility effect, test plan,
and rollback. Keep migrations explicit. Remove obsolete paths after a hard
cutover when no released contract needs them.

## Dependency update

Renovate owns routine dependency updates. Dependabot alerts provide security
visibility. Review lockfile changes and lifecycle scripts. Do not bypass the
24-hour release-age policy for convenience.

```sh
pnpm install --frozen-lockfile
pnpm audit:all
pnpm verify
```

## Documentation or interface copy

Use plain, direct public copy. Verify affected links and text in the rendered
application at desktop and mobile widths. Run `pnpm verify` before review.

## Deployment

Lupinum Colors uses continuous deployment. It does not use package versions,
Changesets, npm publication, or a release workflow.

Before merge:

1. Run `pnpm release:verify`.
2. Review the complete pull-request diff.
3. Verify the Vercel preview and primary palette journey.
4. Confirm that the preview uses the intended source commit.

After merge, Vercel deploys current `main` from the repository root. Verify:

- palette generation, exact editing, undo, redo, reset, sharing, and export;
- keyboard focus, mobile inspector behavior, and light and dark themes;
- canonical metadata, icons, social image, robots, sitemap, and a real `404`;
- GitHub, Discord, privacy, legal notice, and feedback links;
- browser console and required network requests; and
- the production deployment ID and source commit.

## Rollback

Promote the last known-good Vercel deployment. Then revert or fix the
responsible commit through a pull request. Record the failed and restored
deployment IDs. Do not leave production and `main` different without an
incident note.

## Credential or supply-chain incident

Stop deployments. Revoke the affected credential, review GitHub and Vercel
logs, and rotate it in the owning service. Never commit replacement secrets.
Confirm that old deployments cannot read a replacement value.

## Open-source launch gates

The repository is ready to become public only when the `Launch checklist`
issue proves the GitHub, Vercel, DNS, legal, and production settings that files
cannot prove.

## Agent-operated local checks

The agent handles local startup, implementation, browser exploration, required
checks and cleanup. The product owner supplies the intended outcome and decides
material product tradeoffs. Existing deployment authorization still applies.
This repository adopts the unpublished shared agent-led development 0.1 draft
at revision `bace3d8d7f50fb6d5768a04e32c217ea6910b142`. This development workflow
does not establish production conformance.

Use an unused loopback port and start the existing development command:

```sh
pnpm dev --host 127.0.0.1 --port <unused-port> --strictPort
```

The server is ready when Vite+ prints the matching `Local` URL. Open that exact
URL in an owned disposable browser session and confirm that the page title and
the `Tailwind shade generator` heading render without a Vite error overlay or
browser console errors. Keep the process and browser session running across
edits. This static app needs no test accounts, mailbox, backend, credentials or
authentication adapter. Use synthetic colors and palette names.

For palette changes, explore input validation and recovery, exact editing,
keyboard editing, undo and redo, reset, reload, and the current share URL in a
separate tab. Inspect rendered tokens when export changes. Check visible text,
screenshots and the phone inspector at a relevant narrow viewport. Investigate
console errors and failed interactions before classifying defects. Use
`pnpm exec vp test <test-file>` for a relevant focused test and `pnpm verify`
for the final gate. Before a deployment, also run `pnpm release:verify` and a
fresh `pnpm preview` against the completed build. Pure documentation changes do
not need an unrelated palette journey.

To stop, close every owned browser tab, press `Ctrl-C` in each owned server,
remove any explicit viewport override or temporary browser profile, and run:

```sh
lsof -nP -iTCP:<port> -sTCP:LISTEN
```

No output means the port is released. Report what was actually checked, any
failed checks and remaining gaps. A local preview falls back to the app for an
unknown path, so it does not prove the hosted Vercel `404` behavior.

### Adoption evidence — 8 September 2026

- **Proven:** Node 24.18.0 and the pnpm 11.23.0 `packageManager` authority
  installed the frozen lockfile. The normal dev command printed its URL in less
  than six seconds with no human intervention or new runtime adapter. Invalid
  input produced a useful field error and recovered immediately with synthetic
  input. Browser exploration confirmed generation, keyboard and exact edits,
  undo, redo, reset, reload, separate-tab share restoration, the rendered
  Tailwind export, light and dark theme persistence, and the mobile inspector at
  390 by 844 pixels. Escape closed the inspector, the document had no horizontal
  overflow, and no browser warnings or errors were recorded.
- **Proven:** `pnpm release:verify` reported no known dependency
  vulnerabilities, 87 passing tests, no lint or type errors, a verified Tailwind
  4.3.3 reference, and successful client, SSR and prerender builds. A fresh
  built-preview session confirmed the prerendered guide, canonical and social
  metadata, palette generation and a 13-line Tailwind export.
- **Proven:** under heavy unrelated CPU load, the 10,000-palette invariant test
  completed after its former 15-second timeout in two consecutive runs. The
  assertions and sample count remain unchanged; only that CPU-bound test's
  timeout is now 60 seconds so contention does not create a false failure.
- **Proven:** the current production alias serves commit
  `2a5b55198efcc3e582383d48851f50a5c39fd3d0` through GitHub deployment
  `6226381219`. The root returned `200` and a synthetic missing path returned
  Vercel's real `404`. This proves the current deployment, not this unmerged
  change.
- **Not applicable:** accounts, roles, authentication, a backend, persistent
  server data, mail and other external effects.
- **Unverified:** clipboard contents after the browser reported `Copied`, the
  other export formats, this branch on a hosted preview or production, and other
  operating systems.
- **Cleanup:** the owned browser tabs and local development and preview servers
  were closed, viewport overrides were reset, and their loopback ports were
  released. No test data or credentials remained.
