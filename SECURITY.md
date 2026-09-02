# Security policy

## Supported version

The production deployment at `https://colors.lupinum.com/` and the current
`main` branch receive security fixes. Older commits and preview deployments are
not supported versions.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/lupinum-dev/lupinum-colors/security/advisories/new).
Do not open a public issue for an undisclosed vulnerability.

Include:

- the affected page or source commit;
- reproduction steps or a proof of concept;
- realistic impact;
- affected browsers or platforms;
- known mitigations; and
- a safe way to contact you.

Do not include production credentials or unrelated personal data. Maintainers
aim to acknowledge a complete report within three business days and provide a
status update within seven business days.

Please do not publish exploit details until a fix or coordinated mitigation is
available.

## Security boundaries

- The production application is static and has no application backend.
- Palette values and names stay in the browser. Shared palette state uses a URL
  fragment, which browsers do not send in HTTP requests.
- GitHub Actions must use immutable commit SHAs and minimum permissions.
- Dependency installs use the committed lockfile and the repository's 24-hour
  release-age policy.
- Deployment credentials must not be committed to this repository.
