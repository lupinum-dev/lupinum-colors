# Maintaining Lupinum Colors

This file is the operational source of truth for maintainers. `AGENTS.md`
defines architecture and agent rules. `CONTRIBUTING.md` defines contributor
scope. `docs/WRITING.md` defines public writing rules.

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

Follow [docs/WRITING.md](docs/WRITING.md). Verify affected links and text in the
rendered application at desktop and mobile widths. Run `pnpm verify` before
review.

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
