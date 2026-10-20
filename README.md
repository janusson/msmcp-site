# msmcp-site

Source for [msmcp.dev](https://msmcp.dev), the single-page project website for
[MSMCP](https://github.com/janusson/MSMCP), a local Model Context Protocol server
for computational mass spectrometry.

**Hosting: GitHub Pages. Cloudflare supplies DNS only, not Pages or Workers.**
The framework, dark visual design and static/no-client-JavaScript architecture are
preserved. This repository does not contain the Python server or the author's
[personal site](https://www.ericjanusson.ca).

## Stack

- Astro 7, static output; versions are pinned by `package-lock.json`.
- Tailwind CSS 4 via `@tailwindcss/vite`; tokens in `src/styles/global.css`.
- Inter and JetBrains Mono via Google Fonts. Browsers contact Google's font CDN;
  there is no analytics script or application backend.
- Node 24 for CI and local development (see `.node-version`).

## Develop and validate

```sh
npm ci
make check         # Astro/TypeScript checks and Prettier
make verify        # production build, then static contract/internal-link checks
make all           # both, in CI order
```

`make dev` and `make preview` run local development/preview servers; `make build`
only writes `dist/`. None of these commands deploys the site. After `npm ci`, the
Makefile may run `npm install` once to create its existing dependency stamp.

`scripts/verify-build.mjs` checks:

- One H1, language, description, unique IDs, and a focusable skip-link destination.
- Every fragment and local `href`/`src` resolves in `dist/`, including CSS/assets.
- All 14 tools found in server main at `7d3e8a4` (checked 18 October 2026).
- Illustrative workflow labelling, candidate-not-identification framing, explicit
  uncalibrated search/pending integration, dependency blocker and open PR #63.
- No historical q-value table, FDR hit-count claim, invented package-install path,
  or unsupported adoption claim.
- Exact canonical and OpenGraph home URL, sitemap and robots consistency, social
  image/favicon existence, HTTPS links, bounded external destinations and no
  client-side script.
- Template leaks and words welded together across Astro inline boundaries.

These are static regression checks, not proof of scientific correctness or server
compatibility. External links are not fetched in the offline CI gate. Recheck
live destinations separately when changing them, including README fragments.

### Browser review

After layout changes, render the production build, not only the development page.
Review at 320, 390, 768 and 1440 CSS pixels, with JavaScript disabled, and check:

- No document-level horizontal overflow; long code scrolls inside its own block.
- Header navigation wraps, all links stay reachable, and anchors clear the header.
- Tab reaches the skip link first and moves focus to main; code blocks can be
  focused and scrolled with the keyboard.
- Isotope labels and minor-peak descriptions remain readable on narrow screens.
- Reduced-motion preference disables smooth scrolling; focus indicators and
  contrast remain visible.

## Content and scientific boundaries

The page describes source capabilities, not universal compatibility or a newly
published server release. The server's current main requires **Python >=3.13**
and **MCP SDK >=2.0**. The imaging `massflow` dependency/name collision with a
separate analytical MassFlow project is unresolved independently of this site;
installation instructions are explicitly not a clean-install validation.

The old acquisition transcript, timings, candidate table and q-values have been
removed. No new acquisition results or benchmark numbers were invented. The new
workflow is explicitly illustrative, uses placeholders for the chosen index and
returned handles, and starts with `list_spectra` to avoid searching an MS1 survey
scan against an MS/MS library.

The server maintenance inventory at `MSMCP/docs/maintenance-state.md` (local
handoff inspected 18 October 2026) records **pending similarity-only search**:
ranked candidates, no calibrated p/q values or significance filtering. This is
not yet a main/release claim. Neither old significance output nor a high cosine
score establishes an identification or error-rate control. The site makes no
FDR, confidence, identification-accuracy or all-formats/transports/instruments
validation claim. [Chromatogram PR #63](https://github.com/janusson/MSMCP/pull/63)
was open and unmerged at inspection and is labelled accordingly.

The glucose figure was rechecked with `annotate_isotopes("C6H12O6")` on 18 October
2026: M = 180.0634 Da / 1.0000, M+1 = 181.0668 Da / 0.0686, M+2 = 182.0681 Da /
0.0147. These are rounded neutral isotopologue masses, not precursor m/z. The
minor-peak panel uses an abundance scale of 0–0.08; it is not a “100×” zoom or a
full isotope fine-structure simulation.

### Maintenance map

| Content                                                                | File                                                                 | Recheck when                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Messaging, workflow, install/client JSON, limitations, tool list, docs | `src/pages/index.astro`                                              | Main/tool signatures, packaging or scientific contracts change |
| Reference-aware tool flow                                              | `src/components/ReferenceFlow.astro`                                 | Reference API changes                                          |
| Glucose isotope plot                                                   | `src/components/IsotopeFigure.astro`                                 | Isotope calculations change; rerun the tool                    |
| Navigation and author links                                            | `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro` | Destinations change                                            |
| Canonical origin                                                       | `astro.config.mjs`                                                   | Domain changes                                                 |
| Social metadata and landmarks                                          | `src/layouts/BaseLayout.astro`                                       | Layout or metadata changes                                     |
| Discovery files                                                        | `public/robots.txt`, `public/sitemap.xml`                            | Canonical origin or page inventory changes                     |
| Static regression checks                                               | `scripts/verify-build.mjs`                                           | Any of the above changes                                       |

## Hosting and approval boundary

Verified read-only on 18 October 2026:

- MSMCP's GitHub homepage is `https://msmcp.dev`.
- Canonical repository: `https://github.com/janusson/MSMCP`.
- Author profile: `https://github.com/janusson`; its blog field points to
  `https://www.ericjanusson.ca`, which serves the author's site.
- GitHub Pages API for `janusson/msmcp-site`: `build_type=workflow`,
  `cname=msmcp.dev`, `https_enforced=true`.
- `https://msmcp.dev` responds over HTTPS with `200` and `server: GitHub.com`.
- Apex DNS resolves to GitHub Pages addresses `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

### Existing configuration (unchanged)

`.github/workflows/pages.yml` contains three jobs:

1. **Gate:** Node from `.node-version`, `npm ci`, then `make all`.
2. **Build:** depends on Gate; `withastro/action@v6` builds and uploads an artifact.
3. **Deploy:** `actions/deploy-pages@v5`, guarded by
   `github.ref == 'refs/heads/main'`, to the `github-pages` environment.

Pull requests run Gate and Build but skip Deploy. A feature-branch push does not
match the workflow's main-only push trigger. A PR is therefore safe for review
without publishing; **merging to main will trigger the existing deployment**.
Do not merge, dispatch the workflow on main, publish a release, or change DNS or
hosting settings without separate owner approval. This maintenance task does none
of those things.

Pages settings already select GitHub Actions with the custom domain `msmcp.dev`.
There is intentionally no `public/CNAME`: with a custom Actions publishing source,
the repository Pages setting is authoritative. Do not add a second deployment
workflow, switch hosts, or create Cloudflare configuration for this static-site
maintenance task.

To verify existing hosting without deploying:

```sh
gh api repos/janusson/msmcp-site/pages --jq '{cname,build_type,https_enforced}'
dig +short msmcp.dev
curl -sSI https://msmcp.dev
```

Review the focused website PR and its CI before authorizing a merge/deployment.
Server dependency resolution and integration/calibration work remain separate
approvals, not prerequisites to building this static website and not silently
completed by its publication.

MIT licensed — see [LICENSE](LICENSE). Copyright © 2026 Eric Janusson.
