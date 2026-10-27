#!/usr/bin/env node
/**
 * Post-build contract checks for the MSMCP landing page.
 *
 * This page makes claims about software, so the things that break silently are
 * the things that matter: an anchor that no longer resolves, a tool name that
 * drifts from the tools the server actually exposes, two words welded
 * together by the template compiler, an external link that lost its
 * rel="noopener".  Each check below failed for a real reason at least once
 * while this page was built.
 *
 * Exits non-zero with a readable report.  Run via `make verify`.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { SITE } from "../astro.config.mjs";

const DIST = "dist/index.html";

/** The fifteen tools exposed by the release candidate (src/msmcp/tools/*.py). */
const TOOLS = [
  "ping",
  "load_mzml_summary",
  "list_spectra",
  "extract_chromatograms",
  "load_spectrum",
  "summarise_reference",
  "release_reference",
  "predict_adduct_offset",
  "annotate_isotopes",
  "validate_precursor",
  "compute_cosine",
  "generate_qc_summary",
  "search_library",
  "check_search_status",
  "cancel_search",
];

const failures = [];
const check = (name, condition, detail = "") => {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
    failures.push(name);
  }
};

if (!existsSync(DIST)) {
  console.error(
    `No build to verify: ${DIST} does not exist. Run \`make verify\` (it builds first).`,
  );
  process.exit(1);
}

const html = await readFile(DIST, "utf8");

// ---- structure -------------------------------------------------------------
const h1s = html.match(/<h1\b/g) ?? [];
check("exactly one <h1>", h1s.length === 1, `found ${h1s.length}`);
check("lang attribute on <html>", /<html[^>]+lang="[a-z-]+"/i.test(html));
check("meta description present", /<meta\s+name="description"\s+content="[^"]{50,}"/i.test(html));

// ---- in-page anchors -------------------------------------------------------
const idList = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const ids = new Set(idList);
check("element IDs are unique", ids.size === idList.length);
check(
  "skip link targets a focusable main landmark",
  /<main\b[^>]*id="main"[^>]*tabindex="-1"/.test(html),
);
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const deadAnchors = [...new Set(anchors)].filter((a) => a !== "" && !ids.has(a));
check(
  `every in-page anchor resolves (${new Set(anchors).size} targets)`,
  deadAnchors.length === 0,
  deadAnchors.join(", "),
);

// ---- claims about the software --------------------------------------------
const missingTools = TOOLS.filter((t) => !html.includes(t));
check(
  `all ${TOOLS.length} MSMCP tool names appear`,
  missingTools.length === 0,
  missingTools.join(", "),
);

// The tools section is a reference: one row per tool, each carrying a call.
// A tool added to the server but not to the page fails here instead of shipping
// a table that quietly stops matching the product.
const rows = [...html.matchAll(/data-tool="([^"]+)"/g)].map((m) => m[1]);
check(
  `tools table has one row per tool (${rows.length} rows)`,
  rows.length === TOOLS.length && new Set(rows).size === TOOLS.length,
  `duplicate or missing: ${TOOLS.filter((t) => !rows.includes(t)).join(", ") || "none"}`,
);

const emptyCalls = [
  ...html.matchAll(/data-tool="([^"]+)"[\s\S]*?<(?:pre|div)[^>]*><code>([^<]*)<\/code>/g),
]
  .filter((m) => !m[2].includes("("))
  .map((m) => m[1]);
check("every tool row carries a call", emptyCalls.length === 0, emptyCalls.join(", "));

check(
  "hero headline uses the approved phrasing",
  html.includes("Ask your AI assistant about your mass spectrometry data."),
);
check(
  "hero answers what the server is for, in plain words",
  /Claude/.test(html) && /MCP host/.test(html) && /Model Context Protocol/.test(html),
  "the first screen must name an AI client, not only tool categories",
);
check(
  "no fabricated install path (PyPI claim absent)",
  !/pip install msmcp|pypi\.org\/project\/msmcp/i.test(html),
  "page must not imply a published package",
);
check(
  "search results are labelled as candidates, not identifications",
  /candidate library matches/i.test(html) && /not validated compound identifications/i.test(html),
);
check(
  "example is explicitly illustrative, not a real acquisition claim",
  /Illustrative MCP tool calls/.test(html) && !/transcript below is a real run/.test(html),
);
check(
  "no historical q-value table or FDR hit-count claim",
  !/<th\b[^>]*>q-value|hits above the FDR threshold|false-discovery threshold buys/i.test(html),
);
check(
  "uncalibrated search is disclosed without a q-value claim",
  /Search significance is uncalibrated/.test(html) &&
    /no FDR, p-value, q-value or identification-confidence claim/.test(html),
);
check(
  "chromatogram extraction is presented as shipped",
  html.includes("extract_chromatograms") && !/open PR #63/.test(html),
);
check(
  "installation boundary is stated accurately",
  /installs from a built wheel in a fresh Python 3.13 environment/.test(html) &&
    /massflow[\s\S]{0,80}not a core dependency/.test(html) &&
    /MCP SDK 2.0\+/.test(html),
  "core install, optional imaging extra and SDK requirement must be explicit",
);
check(
  "context gating is disclosed",
  /MS1 or non-MS2 queries/.test(html) && /context-eligibility counts/.test(html),
);
check(
  "no unverified testimonial or adoption claim",
  !/\b(testimonial|trusted by|used by \d|industry standard)\b/i.test(html),
);

// ---- link hygiene ----------------------------------------------------------
const external = [...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].map((m) => ({
  href: m[1],
  tag: m[0],
}));
const insecure = external.filter((l) => l.href.startsWith("http://"));
check("no insecure http:// links", insecure.length === 0, insecure.map((l) => l.href).join(", "));

const unrel = external.filter(
  (l) => /target="_blank"/.test(l.tag) && !/rel="[^"]*noopener/.test(l.tag),
);
check(
  `target="_blank" links carry rel="noopener" (${external.length} external links)`,
  unrel.length === 0,
  unrel.map((l) => l.href).join(", "),
);

const offRepo = external.filter(({ href }) => {
  const url = new URL(href);
  return !(
    (url.hostname === "github.com" && /^\/janusson(?:\/|$)/.test(url.pathname)) ||
    url.hostname === "docs.astral.sh" ||
    url.hostname === "www.ericjanusson.ca"
  );
});
check(
  "every external link points at a known-in-good-faith host",
  offRepo.length === 0,
  offRepo.map((l) => l.href).join(", "),
);

for (const href of [
  "https://github.com/janusson/MSMCP",
  "https://github.com/janusson",
  "https://www.ericjanusson.ca",
]) {
  check(
    `canonical destination is linked: ${href}`,
    external.some((link) => link.href === href),
  );
}

// Resolve every local href/src, not just fragment-only navigation and OG images.
const brokenLocal = [];
for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const url = new URL(raw, `${SITE}/`);
  if (url.origin !== SITE) continue;
  const pathname = decodeURIComponent(url.pathname);
  const path = resolve("dist", `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
  if (!path.startsWith(`${resolve("dist")}${sep}`) || !existsSync(path)) {
    brokenLocal.push(raw);
  } else if (url.hash) {
    const target = await readFile(path, "utf8");
    if (!target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) brokenLocal.push(raw);
  }
}
check(
  "every internal href/src resolves in the production build",
  brokenLocal.length === 0,
  brokenLocal.join(", "),
);

// ---- canonical origin & discovery ------------------------------------------
check(
  "canonical and OpenGraph origin stay https://msmcp.dev/",
  SITE === "https://msmcp.dev" &&
    html.includes(`rel="canonical" href="${SITE}/"`) &&
    html.includes(`property="og:url" content="${SITE}/"`),
);
const robots = await readFile("dist/robots.txt", "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
check("robots points at the canonical sitemap", robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
check("sitemap lists the canonical home page", sitemap.includes(`<loc>${SITE}/</loc>`));
check("static page ships no client-side scripts", !/<script\b/i.test(html));

// ---- referenced local assets ----------------------------------------------
// An og:image pointing at a file the build never emitted is invisible in a
// browser and broken everywhere the link is shared.
const localRefs = [
  ...html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/g),
  ...html.matchAll(/<link\s+rel="icon"[^>]*href="([^"]+)"/g),
]
  .map((m) => m[1])
  .filter((u) => !u.startsWith("data:"));
const siteOrigin = /<meta\s+property="og:url"\s+content="(https?:\/\/[^/"]+)/.exec(html)?.[1] ?? "";
const missingAssets = localRefs
  .map((u) => (siteOrigin && u.startsWith(siteOrigin) ? u.slice(siteOrigin.length) : u))
  .filter((path) => !existsSync(`dist${path}`));
check(
  `referenced local assets exist (${localRefs.length} checked)`,
  missingAssets.length === 0,
  missingAssets.join(", "),
);

// ---- keyboard access to scrollable regions --------------------------------
// A block that scrolls horizontally is unreachable by keyboard unless it can
// take focus; axe reports `scrollable-region-focusable` at serious impact, and
// only at the narrow viewport where it actually overflows.  Blocks that wrap
// (`whitespace-pre-wrap` + `overflow-wrap:anywhere`) cannot overflow, so they
// are exempt rather than carrying a focus stop that does nothing.
const scrollable = (html.match(/<(?:pre|div|table)\b[^>]*>/g) ?? []).filter(
  (t) => /mono-block|overflow-x-auto/.test(t) && !/whitespace-pre-wrap/.test(t),
);
const unfocusable = scrollable.filter((t) => !/tabindex="0"/.test(t));
check(
  `scrollable regions are keyboard reachable (${scrollable.length} checked)`,
  unfocusable.length === 0,
  unfocusable
    .slice(0, 2)
    .map((t) => t.slice(0, 60))
    .join(" | "),
);

// ---- fonts -----------------------------------------------------------------
// JetBrains Mono ships 400/500 while five labels ask for 600, so the browser
// synthesises the bold. Source Code Pro carries a real 600 and a third of the
// bytes. A font swap that silently drops the weight would undo that.
const fontHref = /fonts\.googleapis\.com\/css2\?([^"]+)/.exec(html)?.[1] ?? "";
check(
  "monospace face ships a real 600 weight",
  /Source\+Code\+Pro:wght@400;500;600/.test(fontHref) && !/JetBrains\+Mono/.test(fontHref),
  fontHref.slice(0, 90),
);

// ---- install path on the first screen --------------------------------------
const runIdx = html.indexOf("uv run msmcp");
const exampleIdx = html.indexOf('id="example"');
check(
  "a runnable command appears before the example section",
  runIdx !== -1 && exampleIdx !== -1 && runIdx < exampleIdx,
  "the hero must carry the install, not only a link down the page",
);

// ---- inline-boundary whitespace --------------------------------------------
// Astro's compiler trims whitespace around an inline tag when the source breaks
// the line there, silently welding two words together ("server-side:" +
// "validate_precursor").  The HTML still parses, so only a rendered page reveals
// it -- assert it here instead.
const INLINE = "span|code|a|em|strong|b|i|sup|sub|abbr|kbd|samp|var|time|mark|small";
const visible = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
const welded = [];
for (const re of [
  new RegExp(`[A-Za-z0-9,.;:)\\]](<(?:${INLINE})\\b[^>]*>(?=[A-Za-z0-9]))`, "g"),
  new RegExp(`[A-Za-z0-9]<\\/(?:${INLINE})>(?=[A-Za-z0-9])`, "g"),
]) {
  for (const m of visible.matchAll(re)) {
    welded.push(visible.slice(Math.max(0, m.index - 30), m.index + 44).replace(/\s+/g, " "));
  }
}
check(
  "no words welded together across an inline tag boundary",
  welded.length === 0,
  welded.slice(0, 4).join(" || "),
);

// ---- rendering accidents ---------------------------------------------------
check(
  "no template leaks in the output",
  !/\b(undefined|\[object Object\]|NaN)\b/.test(html.replace(/<!--[\s\S]*?-->/g, "")),
);

const bytes = Buffer.byteLength(html);
check(
  `page is a single document under 120 KB (${(bytes / 1024).toFixed(1)} KB)`,
  bytes < 120 * 1024,
);

console.log("");
if (failures.length) {
  console.error(`verify-build: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log(`verify-build: all checks passed (${(bytes / 1024).toFixed(1)} KB of HTML).`);
