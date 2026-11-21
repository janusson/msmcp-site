#!/usr/bin/env node
/**
 * Post-build contract, security, and accessibility checks for the MSMCP site.
 *
 * Pure helpers (`analyzeHtml`, `extractLocalAssetPaths`, `analyzeDist`) are
 * exported so `tests/site-contracts.test.mjs` can exercise positive and
 * negative regressions without waiting on a full build.
 *
 * Exits non-zero with a readable report when executed directly.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const INSTALL_COMMAND = "uvx --python 3.13 --from msmcp==1.0.2 msmcp";
export const CANONICAL_ORIGIN = "https://msmcp.dev";
export const MAX_HTML_BYTES = 120 * 1024;

/** The fifteen tools registered by the MSMCP 1.0.2 release. */
export const TOOLS = [
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

export const INSTRUMENT_CLASSES = ["generic", "orbitrap", "tof", "ion_trap", "triple_quad"];

export const ENV_VARS = [
  "MSMCP_ALLOWED_ROOT",
  "MSMCP_MAX_FILE_SIZE_BYTES",
  "MSMCP_MAX_SPECTRA",
  "MSMCP_MAX_REFERENCES",
  "MSMCP_MAX_TOTAL_BYTES",
  "MSMCP_REFERENCE_TTL_SECONDS",
  "MSMCP_EMBEDDING_BACKEND",
];

export const MAJOR_SECTIONS = ["top", "example", "why", "get-started", "tools", "docs"];

export const TRUSTED_EXTERNAL_HOSTS =
  /^https:\/\/(github\.com\/janusson|docs\.astral\.sh|pypi\.org\/project\/msmcp|fonts\.googleapis\.com|fonts\.gstatic\.com)/;

/** Parses JSON from the `<code>` element enclosing `marker`. */
export function parseJsonCodeBlock(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return undefined;
  const tagStart = html.lastIndexOf("<code", idx);
  const contentStart = html.indexOf(">", tagStart) + 1;
  const contentEnd = html.indexOf("</code>", idx);
  if (tagStart === -1 || contentStart <= 0 || contentEnd === -1) return undefined;
  try {
    return JSON.parse(html.slice(contentStart, contentEnd).replaceAll("&quot;", '"'));
  } catch {
    return undefined;
  }
}

/** Extracts local asset paths referenced by HTML metadata, styles, and media tags. */
export function extractLocalAssetPaths(html) {
  const refs = [
    ...[...html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<meta\s+name="twitter:image"\s+content="([^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*>/gi)]
      .filter((m) => /\brel="(?:icon|stylesheet|apple-touch-icon)"/i.test(m[0]))
      .map((m) => /\bhref="([^"]+)"/i.exec(m[0])?.[1])
      .filter(Boolean),
    ...[...html.matchAll(/<(?:img|source)\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]),
  ].filter((u) => !u.startsWith("data:"));

  const siteOrigin =
    /<meta\s+property="og:url"\s+content="(https?:\/\/[^/"]+)/i.exec(html)?.[1] ?? "";
  const localPaths = [];
  for (const ref of refs) {
    if (siteOrigin && ref.startsWith(siteOrigin)) {
      localPaths.push(ref.slice(siteOrigin.length));
    } else if (ref.startsWith("/")) {
      localPaths.push(ref);
    }
  }
  return [...new Set(localPaths)];
}

/** Runs all pure HTML structure, content, security, and accessibility assertions. */
export function analyzeHtml(html) {
  const checks = [];
  const check = (name, condition, detail = "") => {
    checks.push({ name, pass: Boolean(condition), detail });
  };

  // ---- structure & metadata ------------------------------------------------
  const h1s = html.match(/<h1\b/gi) ?? [];
  check("exactly one <h1>", h1s.length === 1, `found ${h1s.length}`);
  check("lang attribute on <html>", /<html[^>]+lang="[a-z-]+"/i.test(html));
  check("meta description present", /<meta\s+name="description"\s+content="[^"]{50,}"/i.test(html));

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const duplicateIds = [...new Set(ids.filter((id, idx) => ids.indexOf(id) !== idx))];
  check(
    `no duplicate id attributes (${ids.length} checked)`,
    duplicateIds.length === 0,
    duplicateIds.join(", "),
  );

  const headings = [...html.matchAll(/<(h[1-6])\b[^>]*>/gi)].map((m) => Number(m[1][1]));
  const headingJumps = [];
  if (headings.length > 0 && headings[0] !== 1) {
    headingJumps.push(`first heading is h${headings[0]}`);
  }
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) {
      headingJumps.push(`h${headings[i - 1]} -> h${headings[i]}`);
    }
  }
  check(
    `heading hierarchy does not skip levels (${headings.length} headings)`,
    headings.length > 0 && headingJumps.length === 0,
    headingJumps.join(", "),
  );

  const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html)?.[1] ?? "";
  const ogUrl = /<meta\s+property="og:url"\s+content="([^"]+)"/i.exec(html)?.[1] ?? "";
  check(
    "canonical and og:url match https://msmcp.dev/",
    canonical === `${CANONICAL_ORIGIN}/` && ogUrl === `${CANONICAL_ORIGIN}/`,
    `canonical=${canonical || "missing"}; og:url=${ogUrl || "missing"}`,
  );

  const ogImage = /<meta\s+property="og:image"\s+content="([^"]+)"/i.exec(html)?.[1] ?? "";
  const twitterImage = /<meta\s+name="twitter:image"\s+content="([^"]+)"/i.exec(html)?.[1] ?? "";
  check(
    "og:image and twitter:image match canonical asset",
    ogImage === `${CANONICAL_ORIGIN}/og.png` && twitterImage === ogImage,
    `og:image=${ogImage || "missing"}; twitter:image=${twitterImage || "missing"}`,
  );

  // ---- landmarks & navigation accessibility --------------------------------
  check(
    'skip link targets focusable <main id="main" tabindex="-1">',
    /<a\b[^>]*class="skip-link"[^>]*href="#main"/i.test(html) &&
      /<main\b[^>]*\bid="main"[^>]*\btabindex="-1"/i.test(html),
  );

  const navTags = [...html.matchAll(/<nav\b([^>]*)>/gi)].map((m) => m[1]);
  const navLabels = navTags
    .map((attrs) => /\baria-label="([^"]+)"/i.exec(attrs)?.[1] ?? "")
    .filter(Boolean);
  check(
    `every <nav> has a distinct aria-label (${navTags.length} checked)`,
    navTags.length > 0 &&
      navLabels.length === navTags.length &&
      new Set(navLabels).size === navTags.length,
    `labels=${navLabels.join(", ") || "none"}`,
  );

  // ---- in-page anchors -----------------------------------------------------
  const idSet = new Set(ids);
  const anchors = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
  const deadAnchors = [...new Set(anchors)].filter((a) => a === "" || !idSet.has(a));
  check(
    `every in-page anchor resolves (${new Set(anchors).size} targets)`,
    deadAnchors.length === 0,
    deadAnchors.map((a) => `#${a}`).join(", "),
  );

  // ---- claims about the software -------------------------------------------
  const missingTools = TOOLS.filter((t) => !html.includes(t));
  check(
    `all ${TOOLS.length} MSMCP tool names appear`,
    missingTools.length === 0,
    missingTools.join(", "),
  );

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
  check(
    "pinned PyPI quickstart is present and source cloning is not required",
    html.includes(INSTALL_COMMAND) &&
      !/git clone https:\/\/github\.com\/janusson\/MSMCP/i.test(html),
    "the first-screen command must install the published 1.0.2 distribution",
  );

  const zedServer = parseJsonCodeBlock(html, "&quot;context_servers&quot;")?.context_servers?.msmcp;
  check(
    "Zed stdio configuration is valid JSON and uses the pinned package command",
    zedServer?.command === "uvx" &&
      zedServer?.args?.join(" ") === "--python 3.13 --from msmcp==1.0.2 msmcp" &&
      zedServer?.env?.MSMCP_ALLOWED_ROOT === "/absolute/path/to/ms-data",
  );

  const mcpServer = parseJsonCodeBlock(html, "&quot;mcpServers&quot;")?.mcpServers?.msmcp;
  check(
    "Standard mcpServers configuration is valid JSON and uses the pinned package command",
    mcpServer?.command === "uvx" &&
      mcpServer?.args?.join(" ") === "--python 3.13 --from msmcp==1.0.2 msmcp" &&
      mcpServer?.env?.MSMCP_ALLOWED_ROOT === "/absolute/path/to/ms-data",
  );

  const missingClasses = INSTRUMENT_CLASSES.filter((c) => !html.includes(c));
  check(
    `all ${INSTRUMENT_CLASSES.length} instrument classes are documented`,
    missingClasses.length === 0,
    missingClasses.join(", "),
  );

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
    /fabricated demonstration spectra/i.test(html) &&
      /not an identification probability/i.test(html),
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

  // ---- link & active-content security hygiene ------------------------------
  const emptyTargets = [...html.matchAll(/\b(?:href|src)=""/gi)];
  check(
    "no empty href or src attributes",
    emptyTargets.length === 0,
    `found ${emptyTargets.length}`,
  );

  const dangerousUris = [
    ...html.matchAll(/\b(?:href|src)\s*=\s*"\s*(?:javascript:|vbscript:|data:text\/html)[^"]*"/gi),
  ].map((m) => m[0]);
  check(
    "no dangerous javascript:, vbscript:, or data:text/html URIs",
    dangerousUris.length === 0,
    dangerousUris.slice(0, 3).join(", "),
  );

  const scriptTags = html.match(/<script\b/gi) ?? [];
  check("no <script> elements in HTML", scriptTags.length === 0, `found ${scriptTags.length}`);

  const eventHandlerTags = [...html.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)]
    .map((m) => ({
      tag: m[0],
      // Strip attribute values before checking for on* attribute names so
      // descriptive text inside attributes (e.g. aria-label) is not flagged.
      bareAttrs: m[1].replace(/"[^"]*"|'[^']*'/g, " "),
    }))
    .filter(({ bareAttrs }) => /(?:^|\s)on[a-z]+\s*=/i.test(bareAttrs))
    .map(({ tag }) => tag.slice(0, 60));
  check(
    "no inline DOM event handler attributes",
    eventHandlerTags.length === 0,
    eventHandlerTags.slice(0, 3).join(", "),
  );

  const external = [...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi)].map((m) => ({
    href: m[1],
    tag: m[0],
  }));
  const insecure = external.filter((l) => l.href.startsWith("http://"));
  check("no insecure http:// links", insecure.length === 0, insecure.map((l) => l.href).join(", "));

  const unrel = external.filter(
    (l) => /\btarget="_blank"/i.test(l.tag) && !/\brel="[^"]*\bnoopener\b/i.test(l.tag),
  );
  check(
    `target="_blank" links carry rel="noopener" (${external.length} external links)`,
    unrel.length === 0,
    unrel.map((l) => l.href).join(", "),
  );

  const offRepo = external.filter((l) => !TRUSTED_EXTERNAL_HOSTS.test(l.href));
  check(
    "every external link points at a known-in-good-faith host",
    offRepo.length === 0,
    offRepo.map((l) => l.href).join(", "),
  );

  // ---- keyboard access to scrollable regions -------------------------------
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

  // ---- fonts ---------------------------------------------------------------
  const fontHref = /fonts\.googleapis\.com\/css2\?([^"]+)/.exec(html)?.[1] ?? "";
  check(
    "monospace face ships a real 600 weight",
    /Source\+Code\+Pro:wght@400;500;600/.test(fontHref) && !/JetBrains\+Mono/.test(fontHref),
    fontHref.slice(0, 90),
  );

  // ---- install path on the first screen ------------------------------------
  const runIdx = html.indexOf(INSTALL_COMMAND);
  const exampleIdx = html.indexOf('id="example"');
  check(
    "the PyPI install command appears before the example section",
    runIdx !== -1 && exampleIdx !== -1 && runIdx < exampleIdx,
    "the first screen must carry the pinned package command",
  );

  // ---- inline-boundary whitespace ------------------------------------------
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

  // ---- rendering accidents -------------------------------------------------
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

  // ---- section nesting inside <main> ---------------------------------------
  const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  const mainHtml = mainMatch?.[1] ?? "";
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
    bytes < MAX_HTML_BYTES,
  );

  return { checks, bytes };
}

/** Walks `dir` recursively and returns relative paths. */
function listFilesRecursive(dir, prefix = "") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(path.join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/** Verifies the built `dist/` directory: HTML contracts, local assets, JS-free bundle, robots, and sitemap. */
export function analyzeDist(distDir = "dist") {
  const indexPath = path.join(distDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      `No build to verify: ${indexPath} does not exist. Run \`npm run build\` first.`,
    );
  }

  const html = readFileSync(indexPath, "utf8");
  const { checks, bytes } = analyzeHtml(html);
  const check = (name, condition, detail = "") => {
    checks.push({ name, pass: Boolean(condition), detail });
  };

  // Referenced local assets exist and are non-empty.
  const localRefs = extractLocalAssetPaths(html);
  const badAssets = localRefs.filter((assetRef) => {
    const cleanRef = assetRef.replace(/^\/+/, "");
    const target = path.join(distDir, cleanRef);
    return !existsSync(target) || statSync(target).size === 0;
  });
  check(
    `referenced local assets exist and are non-empty (${localRefs.length} checked)`,
    localRefs.length > 0 && badAssets.length === 0,
    badAssets.join(", "),
  );

  // Zero client-side JS files anywhere in dist/ + non-empty CSS bundle.
  const builtFiles = listFilesRecursive(distDir);
  const jsFiles = builtFiles.filter((f) => /\.(?:m?js|cjs)$/i.test(f));
  check("zero JavaScript files emitted in build output", jsFiles.length === 0, jsFiles.join(", "));

  const cssFiles = builtFiles.filter((f) => f.endsWith(".css"));
  const emptyCss = cssFiles.filter((f) => statSync(path.join(distDir, f)).size === 0);
  check(
    `built stylesheet bundle is non-empty (${cssFiles.length} CSS file)`,
    cssFiles.length > 0 && emptyCss.length === 0,
    emptyCss.join(", "),
  );

  // robots.txt + sitemap.xml static crawl hygiene.
  const robotsPath = path.join(distDir, "robots.txt");
  const robots = existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "";
  check(
    "robots.txt exists and references the HTTPS sitemap",
    /User-agent:\s*\*/i.test(robots) &&
      /Allow:\s*\//i.test(robots) &&
      robots.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`),
  );

  const sitemapPath = path.join(distDir, "sitemap.xml");
  const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
  check(
    "sitemap.xml exists and lists the canonical HTTPS URL",
    sitemap.includes("<urlset") &&
      sitemap.includes(`<loc>${CANONICAL_ORIGIN}/</loc>`) &&
      !sitemap.includes("http://www.msmcp") &&
      !/<loc>\s*http:\/\//i.test(sitemap),
  );

  return { checks, bytes };
}

function main() {
  let result;
  try {
    result = analyzeDist("dist");
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const failures = [];
  for (const item of result.checks) {
    if (item.pass) {
      console.log(`  ok    ${item.name}`);
    } else {
      console.log(`  FAIL  ${item.name}${item.detail ? ` -- ${item.detail}` : ""}`);
      failures.push(item.name);
    }
  }

  console.log("");
  if (failures.length) {
    console.error(`verify-build: ${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(
    `verify-build: all ${result.checks.length} checks passed (${(result.bytes / 1024).toFixed(1)} KB of HTML).`,
  );
}

const isEntrypoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main();
}
