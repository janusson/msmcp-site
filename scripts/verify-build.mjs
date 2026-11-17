#!/usr/bin/env node
/**
 * Post-build contract checks for the MSMCP landing page.
 *
 * This page makes claims about software, so the things that break silently are
 * the things that matter: an anchor that no longer resolves, a tool name that
 * drifts from the fifteen tools the 1.0.2 server actually exposes, two words welded
 * together by the template compiler, an external link that lost its
 * rel="noopener".  Each check below failed for a real reason at least once
 * while this page was built.
 *
 * Exits non-zero with a readable report. Run with `npm run build && node scripts/verify-build.mjs`.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const DIST = "dist/index.html";

/** The fifteen tools registered by the MSMCP 1.0.2 release. */
const TOOLS = [
  "ping",
  "load_mzml_summary",
  "list_spectra",
  "load_spectrum",
  "summarise_reference",
  "release_reference",
  "extract_chromatograms",
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
  console.error(`No build to verify: ${DIST} does not exist. Run \`npm run build\` first.`);
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
  rows.length === TOOLS.length &&
    new Set(rows).size === TOOLS.length &&
    TOOLS.every((tool) => rows.includes(tool)) &&
    rows.every((tool) => TOOLS.includes(tool)),
  `missing: ${TOOLS.filter((t) => !rows.includes(t)).join(", ") || "none"}; unexpected: ${rows.filter((t) => !TOOLS.includes(t)).join(", ") || "none"}`,
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
check("documented tool count matches the 1.0.2 tool surface", html.includes("15 tools"));
const installCommand = "uvx --python 3.13 --from msmcp==1.0.2 msmcp";
check(
  "pinned PyPI quickstart is present and source cloning is not required",
  html.includes(installCommand) && !/git clone https:\/\/github\.com\/janusson\/MSMCP/i.test(html),
  "the first-screen command must install the published 1.0.2 distribution",
);
const parseJsonCodeBlock = (marker) => {
  const idx = html.indexOf(marker);
  if (idx === -1) return undefined;
  const tagStart = html.lastIndexOf("<code", idx);
  const contentStart = html.indexOf(">", tagStart) + 1;
  const contentEnd = html.indexOf("</code>", idx);
  try {
    return JSON.parse(html.slice(contentStart, contentEnd).replaceAll("&quot;", '"'));
  } catch {
    return undefined;
  }
};

const zedServer = parseJsonCodeBlock("&quot;context_servers&quot;")?.context_servers?.msmcp;
check(
  "Zed stdio configuration is valid JSON and uses the pinned package command",
  zedServer?.command === "uvx" &&
    zedServer?.args?.join(" ") === "--python 3.13 --from msmcp==1.0.2 msmcp" &&
    zedServer?.env?.MSMCP_ALLOWED_ROOT === "/absolute/path/to/ms-data",
);
const mcpServer = parseJsonCodeBlock("&quot;mcpServers&quot;")?.mcpServers?.msmcp;
check(
  "Standard mcpServers configuration is valid JSON and uses the pinned package command",
  mcpServer?.command === "uvx" &&
    mcpServer?.args?.join(" ") === "--python 3.13 --from msmcp==1.0.2 msmcp" &&
    mcpServer?.env?.MSMCP_ALLOWED_ROOT === "/absolute/path/to/ms-data",
);
const INSTRUMENT_CLASSES = ["generic", "orbitrap", "tof", "ion_trap", "triple_quad"];
const missingClasses = INSTRUMENT_CLASSES.filter((c) => !html.includes(c));
check(
  `all ${INSTRUMENT_CLASSES.length} instrument classes are documented`,
  missingClasses.length === 0,
  missingClasses.join(", "),
);
const ENV_VARS = [
  "MSMCP_ALLOWED_ROOT",
  "MSMCP_MAX_FILE_SIZE_BYTES",
  "MSMCP_MAX_SPECTRA",
  "MSMCP_MAX_REFERENCES",
  "MSMCP_MAX_TOTAL_BYTES",
  "MSMCP_REFERENCE_TTL_SECONDS",
  "MSMCP_EMBEDDING_BACKEND",
];
const missingEnvVars = ENV_VARS.filter((v) => !html.includes(v));
check(
  `core configuration variables are documented (${ENV_VARS.length} checked)`,
  missingEnvVars.length === 0,
  missingEnvVars.join(", "),
);
check(
  "isotope figure states 0–0.10 (×10) scale rather than ×100",
  html.includes("0–0.10") && !/×100|one-hundred-fold/i.test(html),
);
check(
  "synthetic search example is explicitly not an identification",
  /fabricated demonstration spectra/i.test(html) && /not an identification probability/i.test(html),
);
check(
  "production search does not claim calibrated significance",
  /does not report p-values, q-values or calibrated FDR/i.test(html),
);
check(
  "glucose isotope output matches 1.0.2's documented precision",
  html.includes("181.0668") &&
    html.includes("0.0686") &&
    html.includes("182.0680") &&
    html.includes("0.0143") &&
    !/182\.0681|0\.0147|1\.47 %/.test(html),
);
check(
  "historical THC/q-value search results are absent",
  !/63,879|94\.9 s|q\s*≤\s*0\.05|EQ362902|Δ⁹-THC|0\.0125/.test(html),
);
check(
  "PyPI release, GitHub release, validation, and chromatogram docs are linked",
  html.includes("https://pypi.org/project/msmcp/1.0.2/") &&
    html.includes("https://github.com/janusson/MSMCP/releases/tag/1.0.2") &&
    html.includes("https://github.com/janusson/MSMCP/blob/1.0.2/SCIENTIFIC_VALIDATION.md") &&
    html.includes("https://github.com/janusson/MSMCP/blob/1.0.2/docs/chromatograms.md"),
);
const examples = [...html.matchAll(/data-example="(\d+)"/g)].map((m) => m[1]);
check(
  "three reproducible example links are documented",
  examples.length === 3 &&
    new Set(examples).size === 3 &&
    html.includes("/tree/1.0.2/examples") &&
    html.includes("SCIENTIFIC_VALIDATION.md#4-capability-2") &&
    html.includes("VALIDATION_SIMILARITY.md#reproduction"),
  `found ${examples.length} example links`,
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
  /^https:\/\/(github\.com\/janusson|docs\.astral\.sh|pypi\.org\/project\/msmcp|fonts\.googleapis\.com|fonts\.gstatic\.com)/;
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
const runIdx = html.indexOf(installCommand);
const exampleIdx = html.indexOf('id="example"');
check(
  "the PyPI install command appears before the example section",
  runIdx !== -1 && exampleIdx !== -1 && runIdx < exampleIdx,
  "the first screen must carry the pinned package command",
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

check(
  "job-ID placeholder is escaped and not parsed as an HTML tag",
  /check_search_status\(job_id=(?:&quot;|")&lt;job ID returned by search_library&gt;(?:&quot;|")\)/.test(
    html,
  ) && !/<\/?job\b/i.test(html),
);

check("no whitespace before punctuation after closing links", !/<\/a>\s+[.,]/.test(visible));

// ---- section nesting inside <main> -----------------------------------------
const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
const mainHtml = mainMatch?.[1] ?? "";
const MAJOR_SECTIONS = ["top", "example", "why", "get-started", "tools", "docs"];
const sectionDepths = new Map();
let depth = 0;
for (const tag of mainHtml.matchAll(/<(\/?)section\b([^>]*)>/gi)) {
  if (tag[1] === "/") {
    depth -= 1;
  } else {
    const id = /\bid="([^"]+)"/.exec(tag[2])?.[1];
    if (id && MAJOR_SECTIONS.includes(id)) {
      sectionDepths.set(id, depth);
    }
    depth += 1;
  }
}
const nestedSections = MAJOR_SECTIONS.filter((id) => sectionDepths.get(id) !== 0);
check(
  "major page sections are direct siblings inside <main>",
  Boolean(mainMatch) && depth === 0 && nestedSections.length === 0,
  `depth=${depth}; bad sections=${nestedSections.join(", ") || "none"}`,
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
