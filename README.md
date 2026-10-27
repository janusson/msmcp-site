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
- Inter and Source Code Pro via Google Fonts. Browsers contact Google's font
  CDN; there is no analytics script or application backend.
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
- All 15 tools advertised by the release candidate, with one call row each.
- Illustrative workflow labelling, candidate-not-identification framing,
  uncalibrated search, context gating and the core/optional imaging boundary.
- Chromatogram extraction is presented as shipped, not as an open PR.
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
and **MCP SDK >=2.0**. The candidate core package installs from a built wheel in
a fresh Python 3.13 environment without `massflow`; the optional `msmcp[imaging]`
extra is separate, and its `massflow` package name collides with the analytical
MassFlow project. Core mzML/MGF works without either. The package is not yet
published to PyPI, so the page documents the source path.

The old acquisition transcript, timings, candidate table and q-values have been
removed. No new acquisition results or benchmark numbers were invented. The new
workflow is explicitly illustrative, uses placeholders for the chosen index and
returned handles, and starts with `list_spectra` to avoid searching an MS1 survey
scan against an MS/MS library.

The release candidate (`MSMCP` 1.0.2) ships the similarity-only search contract
`msmcp.search.similarity.v1`: ranked candidates, no calibrated p/q values or
significance filtering. Issue #79's acquisition-context gate is integrated: MS1
queries are refused, incompatible precursor/polarity/charge/adduct context is
excluded before ranking, and missing context remains labelled unknown. Neither a
high cosine score nor a context match establishes an identification or
error-rate control. The site makes no FDR, confidence, identification-accuracy or
all-formats/transports/instruments validation claim. Chromatogram extraction
(PR #63) is integrated as a bounded tool.

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

- exactly one `<h1>`, a `lang`, and a meta description;
- **every in-page `#anchor` resolves** — a dead nav link is the most likely
  regression on a one-page site;
- **all fifteen MSMCP tool names still appear**, and the tools reference has
  exactly one `data-tool` row per tool with a call in it, so a renamed or added
  tool cannot drift the page out of sync with the server;
- the hero phrasing and the "candidates, not identifications" framing are intact;
- no `http://` links, `target="_blank"` implies `rel="noopener"`, and no external
  link points outside a small allowlist of trusted hosts;
- no `undefined` / `NaN` / `[object Object]` template leaks, and the document stays
  under 120 KB.

## Layout checks (what the gate cannot catch)

`make check` and `make verify` prove the HTML is sound. Neither can prove the page
_looks_ right, and both were green while two real layout defects were live:

- the document scrolled horizontally on a 390 px viewport (593 px wide) because a
  `<pre>` inside a CSS grid item stretches the track — grid items default to
  `min-width: auto`, so the item needs `min-w-0` for the block to scroll instead;
- three pairs of words were welded together (`server-side:validate_precursor`,
  `withscoring_method`, `belong inGitHub Issues`) because Astro trims whitespace
  around an inline tag when the source breaks the line there — the fix is an
  explicit `{" "}`.

The second class is now asserted by `scripts/verify-build.mjs`, since it is
invisible in the HTML source. The first is not, and cannot be: **after any layout
change, render the page and look at it.** It was checked in headless Chromium at
1440×1000 and 390×844; screenshots and the render method are recorded in
`~/Hermes/Artifacts/msmcp-site/` (`screenshots/` and `REPORT.md`).

## Project layout

```
.
├── astro.config.mjs          # `site` origin — the single source of the canonical URL
├── Makefile                  # deps / dev / build / check / verify / all
├── public/
│   ├── favicon.svg
│   └── og.png                # 1200x630 link-preview card, from scripts/make-og-card.py
├── scripts/
│   ├── make-og-card.py       # regenerates og.png by hand when the headline changes
│   └── verify-build.mjs      # post-build contract checks
├── src/
│   ├── components/
│   │   ├── IsotopeFigure.astro   # glucose isotope envelope, from real tool output
│   │   ├── ReferenceFlow.astro   # the data-reference mechanism, drawn
│   │   ├── SiteFooter.astro
│   │   └── SiteHeader.astro
│   ├── layouts/BaseLayout.astro  # head, meta/OG, skip link, header, footer
│   ├── pages/index.astro         # the whole page
│   └── styles/global.css         # @theme tokens + a handful of primitives
└── .github/workflows/pages.yml   # gate, then deploy to GitHub Pages
```

## Deployment

**Host: GitHub Pages · domain: `msmcp.dev` · DNS: Cloudflare (DNS only).**
`.github/workflows/pages.yml` is Astro's official deployment workflow —
`withastro/action@v6` installs, builds and uploads the site, and
`actions/deploy-pages@v5` publishes it — with one addition: a `gate` job that
`build` depends on. `withastro/action` installs, builds and uploads in a single
step, so there is no seam to run a check between its build and its upload; a
separate job is the only way a red gate can be kept from reaching Pages. Pull
requests run the gate and the build and stop before the deploy job.

The site has a build step, so Pages must publish **from GitHub Actions**, not from
a branch: the repository holds Astro sources, `dist/` is gitignored, and a branch
source would publish this repository's Markdown instead of the built site.

### Repository settings (one-time, owner action)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Pages → Custom domain: `msmcp.dev`**, then Save.

   Set this in the settings UI, **not** with a `CNAME` file. When the publishing
   source is a custom GitHub Actions workflow, GitHub ignores any `CNAME` file and
   the repository setting is the source of truth — which is why this repository
   deliberately has no `public/CNAME`, and why adding one back would have no effect.

Account-level domain verification for `msmcp.dev` is already complete (the
`_github-pages-challenge-janusson` TXT record is live in the zone). That is a
separate thing from the two settings above, and it needs nothing further.

### Do not pick a starter workflow from the Pages gallery

When you enable Pages, the **Source → GitHub Actions** control offers a searchable
gallery of starter workflows. Choosing the Astro one commits `.github/workflows/astro.yml`
to `main`: a second, competing deployment workflow that does not use
`withastro/action`, hardcodes Node 20, runs no checks, and — before this branch is
merged — fails immediately at "Detect package manager", because no `package.json`
exists on `main` yet. Two workflows deploying one Pages site is a race, not
belt-and-braces.

Set **Source: GitHub Actions** and leave the gallery alone. This repository already
has the deployment workflow, and that starter file is deliberately not present: it
was committed on 2026-10-11 and removed by this branch.

### DNS records required at Cloudflare

The zone is registered with Cloudflare and served by Cloudflare's nameservers, but
Cloudflare is **DNS only** here — GitHub Pages serves the site and GitHub's
custom-domain certificate provides HTTPS.

`msmcp.dev` is an apex domain, so it takes `A` records; an apex cannot have a
CNAME. GitHub also publishes IPv6 addresses and recommends an `A` record alongside
any `AAAA`.

| Type    | Name              | Value                 | Proxy    |
| ------- | ----------------- | --------------------- | -------- |
| `A`     | `msmcp.dev` (`@`) | `185.199.108.153`     | DNS only |
| `A`     | `msmcp.dev` (`@`) | `185.199.109.153`     | DNS only |
| `A`     | `msmcp.dev` (`@`) | `185.199.110.153`     | DNS only |
| `A`     | `msmcp.dev` (`@`) | `185.199.111.153`     | DNS only |
| `AAAA`  | `msmcp.dev` (`@`) | `2606:50c0:8000::153` | DNS only |
| `AAAA`  | `msmcp.dev` (`@`) | `2606:50c0:8001::153` | DNS only |
| `AAAA`  | `msmcp.dev` (`@`) | `2606:50c0:8002::153` | DNS only |
| `AAAA`  | `msmcp.dev` (`@`) | `2606:50c0:8003::153` | DNS only |
| `CNAME` | `www`             | `janusson.github.io`  | DNS only |

**Every one of these must be DNS-only (grey cloud).** With Cloudflare's proxy in
front, the certificate challenge cannot reach GitHub, so GitHub cannot issue the
certificate for the domain, _Enforce HTTPS_ stays unavailable, and the HTTPS in
use would be Cloudflare's rather than GitHub's. The proxy stays off.

`www.msmcp.dev` then redirects to the apex automatically: GitHub creates redirects
between the apex and the `www` variant once the records for both resolve to Pages.
No redirect rule is needed. GitHub's documentation is explicit that `www` is the
only subdomain that may accompany an apex domain, and that wildcard records must
never be used.

### HTTPS

`.dev` is on the HSTS preload list, so browsers refuse plain `http://` with no
fallback: `https://msmcp.dev` is unreachable until GitHub's certificate exists.
GitHub issues it automatically once the records resolve; DNS changes can take up to
24 hours. When the certificate is issued, tick **Enforce HTTPS** under
Settings → Pages.

### Verify a deploy

```bash
dig +short msmcp.dev                                     # expect the four 185.199.10x.153 addresses
dig +short www.msmcp.dev CNAME                           # expect janusson.github.io.
curl -sSI https://msmcp.dev | head -3                    # expect 200 once the certificate is issued
curl -sSI https://www.msmcp.dev | head -3                # expect a redirect to the apex
```

The Actions run is the other check: the `Gate`, `Build` and `Deploy` jobs appear
separately, and a failed gate means the build never ran and nothing was published.

After an authorized merge to `main`, verify the deployment without changing
anything else:

```bash
gh run list --repo janusson/msmcp-site --workflow pages.yml --limit 3
# Expect Gate -> Build -> Deploy all successful on the merge commit.
gh run view <run-id> --repo janusson/msmcp-site --log-failed
# Expect no failed step; Gate must include `make all` and its 15-tool contract.
curl -sS https://msmcp.dev/ | grep -E 'canonical|og:url|<title>'
# Expect <title>MSMCP — a local MCP server for mass spectrometry</title>,
# canonical https://msmcp.dev/, and no q-value table or PyPI install claim.
curl -sS https://msmcp.dev/robots.txt
curl -sS https://msmcp.dev/sitemap.xml
curl -sSI https://www.msmcp.dev | head -5
```

Render the deployed page at 390 px and 1440 px and confirm there is no
document-level horizontal overflow, every nav anchor resolves, and the visible
tool count is 15. The site is static, so a successful deploy plus those checks is
the complete post-merge verification.

### Hosting history

Cloudflare Pages was considered, because the domain is registered at Cloudflare, and
rejected: this repository exists in order to host the site, so a second host for the
same content would split the canonical URL. Cloudflare's role is DNS only — no
Pages, Workers, server or backend. `msmcp.ericjanusson.ca` was the host proposed in
the original brief; `msmcp.dev` is what was registered. To change the canonical
origin, edit `site` in `astro.config.mjs` and the custom domain in
Settings → Pages.

## Maintaining the page

Where the load-bearing content lives, and what has to be re-checked when MSMCP
changes:

| Content                   | Lives in                                                             | Re-check when                                                                                              |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The illustrative workflow | `src/pages/index.astro` — the `workflow` array                       | A tool signature, the search contract or the install path changes. It is illustrative, not a recorded run. |
| The isotope envelope      | `src/components/IsotopeFigure.astro` — the `peaks` array             | `annotate_isotopes` maths changes. Re-run the tool and paste its output.                                   |
| The tool list (15 names)  | `src/pages/index.astro` — `toolGuide`; guarded by `verify-build.mjs` | A tool is added, renamed or removed in `src/msmcp/tools/`.                                                 |
| Install commands          | `src/pages/index.astro` — `installSnippet`                           | The distribution story changes (PyPI, `server.json`, a container).                                         |
| Document links            | `src/pages/index.astro` — `docs`                                     | A file is renamed or moved in the MSMCP repository.                                                        |

**Cardinal rule for edits:** every number and every code block on the page must be
something the software actually printed or a file that actually exists. No
benchmark, testimonial, adoption figure or security guarantee is invented. If a
claim cannot be reproduced, it comes off the page rather than getting softened.

## Provenance of the examples on the page

The workflow in the "Example" section is explicitly **illustrative**, not a
recorded acquisition or benchmark. It uses placeholders for the chosen spectrum
index and returned handles, and no acquisition or library is bundled.

The glucose isotope figure is real `annotate_isotopes("C6H12O6")` output: M =
180.0634 Da / 1.0000, M+1 = 181.0668 Da / 0.0686, M+2 = 182.0681 Da / 0.0147.
These are rounded neutral isotopologue masses, not precursor m/z. The minor-peak
panel uses an abundance scale of 0–0.08; it is not a "100×" zoom or a full isotope
fine-structure simulation.

No q-values, FDR-controlled hit counts, benchmark timings or identification
confidence figures appear on the page.

## Accessibility and performance notes

- Semantic landmarks (`header`, `main`, `nav`, `footer`), one `<h1>`, a skip link,
  visible focus rings, and keyboard-reachable scrollable code blocks.
- Figures carry `role="img"` with a full text description, so the plotted values
  reach a screen reader.
- Colour contrast targets WCAG AA against the dark canvas; the palette is a dark
  sibling of the personal site's Kanagawa Dragon tokens rather than a copy.
- No JavaScript, no web fonts beyond two families, one HTML document (~28 KB) and
  one small CSS file. `prefers-reduced-motion` is respected (there is no animation
  to disable, but smooth scrolling is switched off for users who ask).

---

_MIT licensed — see [LICENSE](LICENSE). Copyright (c) 2026 Eric Janusson._
