# msmcp-site

Source for the [MSMCP](https://github.com/janusson/MSMCP) project site — a single
landing page for the Model Context Protocol server for computational mass
spectrometry.

MSMCP puts your own mass spectrometry data in front of an AI client: it is an
open-source MCP server that lets Claude, Zed or any other MCP host read your
mzML, MGF and imzML files and work on them with real chemistry — precursor and
isotope calculations, MS/MS library matching, QC.

The site's job is narrow: inside thirty seconds, a mass spectrometrist or a
scientific-software developer should understand what MSMCP does, see a real
workflow, and find a working path to installation. It is one page — not a docs
portal, not a blog, and not a marketing site.

**Live at:** https://msmcp.dev — deployed from this repository to GitHub Pages
(see [Deployment](#deployment))

---

## Stack

| Piece     | Choice                                     | Why                                                                                                                                                                       |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | **Astro 7** (static output)                | The same framework as the personal site, so the toolchain, conventions and deployment shape are already familiar. Static output means no runtime, no server, no database. |
| Styling   | **Tailwind CSS 4** via `@tailwindcss/vite` | Tokens live in `src/styles/global.css` under `@theme`, exactly as on the personal site.                                                                                   |
| Fonts     | Inter + JetBrains Mono (Google Fonts CDN)  | Reused from the personal site, with `preconnect`.                                                                                                                         |
| Scripts   | None                                       | No client-side JavaScript is shipped. The mobile layout wraps instead of hiding behind a drawer, and the figures are CSS positioned from data.                            |

Nothing else. No analytics, no trackers, no cookie banner, no newsletter, no
backend, no contact form, no separate documentation engine.

## Local development

Requires Node 20+ (CI uses 24).

```bash
make deps          # npm install, stamped so it only runs when package files change
make dev           # Astro dev server with HMR at http://localhost:4321
make build         # static build into dist/
make preview       # serve the production build locally
```

The gate, in the order CI runs it:

```bash
make check         # astro check (types) + prettier --check   — fast, no build
make verify        # build, then assert the built HTML        — the real gate
make all           # check, then verify
```

`scripts/verify-build.mjs` is a post-build contract check rather than a unit-test
suite, because this project has no application logic to unit-test. It asserts the
things that break silently on a static page making claims about software:

- exactly one `<h1>`, a `lang`, and a meta description;
- **every in-page `#anchor` resolves** — a dead nav link is the most likely
  regression on a one-page site;
- **all fourteen MSMCP tool names still appear**, and the tools reference has
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

| Content                                          | Lives in                                                                 | Re-check when                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The transcribed workflow, hit table, and timings | `src/pages/index.astro` — the `hits` array and the transcript markup     | `search_library` scoring, the report format, or the null model changes. The numbers came from a single recorded run (see below); they are a record, not a live benchmark. |
| The isotope envelope                             | `src/components/IsotopeFigure.astro` — the `peaks` array                 | `annotate_isotopes` maths changes. Re-run the tool and paste its output.                                                                                                  |
| The tool list (13 names)                         | `src/pages/index.astro` — `tools`; guarded by `scripts/verify-build.mjs` | A tool is added, renamed or removed in `src/msmcp/tools/`.                                                                                                                |
| Install commands                                 | `src/pages/index.astro` — `installSnippet`                               | The distribution story changes (PyPI, `server.json`, a container).                                                                                                        |
| Document links                                   | `src/pages/index.astro` — `docs`                                         | A file is renamed or moved in the MSMCP repository.                                                                                                                       |

**Cardinal rule for edits:** every number and every code block on the page must be
something the software actually printed or a file that actually exists. No
benchmark, testimonial, adoption figure or security guarantee is invented. If a
claim cannot be reproduced, it comes off the page rather than getting softened.

## Provenance of the example on the page

The workflow in the "Example" section is a real run, not an illustration:

- **Query:** spectrum #966 of a Bruker maXis LC–MS/MS acquisition (RT 3.795 min,
  precursor m/z 315.2321, 220 peaks). The acquisition's filename is deliberately
  not published on the page.
- **Library:** MassBank's public MSP library, 63,879 spectra, read from disk
  through the same `SecurityPolicy` as the query.
- **Scoring:** `classical` — greedy peak matching, ±0.02 Da — with the report's own
  FDR threshold. Top candidate 0.8309 cosine, q = 0.0125; the runner-ups are
  progesterone, a constitutional isomer at the same precursor m/z.
- **The ppm verdict** (0.32 ppm) was produced by calling `validate_precursor`
  against MassBank's reference mass, and is reproducible in one tool call.
- **The isotope envelope** is `annotate_isotopes("C6H12O6")` output, transcribed
  without rounding. Note that the MSMCP README's inline example of this tool shows
  older values (`M+1` at 181.0721, `[M+H]+` at +1.006728 Da); the tool itself
  prints 181.0668 and +1.007276 Da, which is what the page uses.

## Accessibility and performance notes

- Semantic landmarks (`header`, `main`, `nav`, `footer`), one `<h1>`, a skip link,
  visible focus rings, and `<table>` markup with `<caption>`/`scope` for the hit
  table rather than a styled div grid.
- Figures carry `role="img"` with a full text description, so the plotted values
  reach a screen reader.
- Colour contrast targets WCAG AA against the dark canvas; the palette is a dark
  sibling of the personal site's Kanagawa Dragon tokens rather than a copy.
- No JavaScript, no web fonts beyond two families, one HTML document (~28 KB) and
  one small CSS file. `prefers-reduced-motion` is respected (there is no animation
  to disable, but smooth scrolling is switched off for users who ask).

---

_MIT licensed — see [LICENSE](LICENSE). Copyright (c) 2026 Eric Janusson._
