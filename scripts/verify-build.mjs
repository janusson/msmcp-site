#!/usr/bin/env node
/**
 * Post-build contract checks for the MSMCP landing page.
 *
 * This page makes claims about software, so the things that break silently are
 * the things that matter: an anchor that no longer resolves, a tool name that
 * drifts from the thirteen the server actually exposes, two words welded
 * together by the template compiler, an external link that lost its
 * rel="noopener".  Each check below failed for a real reason at least once
 * while this page was built.
 *
 * Exits non-zero with a readable report.  Run via `make verify`.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const DIST = "dist/index.html";

/** The thirteen tools exposed by MSMCP 1.0.0 (src/msmcp/tools/*.py). */
const TOOLS = [
  "ping",
  "load_mzml_summary",
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
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const deadAnchors = [...new Set(anchors)].filter((a) => a !== "" && !ids.has(a));
check(
  `every in-page anchor resolves (${new Set(anchors).size} targets)`,
  deadAnchors.length === 0,
  deadAnchors.join(", "),
);

// ---- claims about the software --------------------------------------------
const missingTools = TOOLS.filter((t) => !html.includes(t));
check("all 13 MSMCP tool names appear", missingTools.length === 0, missingTools.join(", "));

check(
  "hero headline uses the approved phrasing",
  html.includes("Ask questions of mass spectrometry data—directly."),
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

const TRUSTED =
  /^https:\/\/(github\.com\/janusson|docs\.astral\.sh|fonts\.googleapis\.com|fonts\.gstatic\.com)/;
const offRepo = external.filter((l) => !TRUSTED.test(l.href));
check(
  "every external link points at a known-in-good-faith host",
  offRepo.length === 0,
  offRepo.map((l) => l.href).join(", "),
);

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
