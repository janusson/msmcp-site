import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CANONICAL_ORIGIN,
  ENV_VARS,
  INSTALL_COMMAND,
  INSTRUMENT_CLASSES,
  MAJOR_SECTIONS,
  TOOLS,
  analyzeDist,
  analyzeHtml,
  extractLocalAssetPaths,
} from "../scripts/verify-build.mjs";
import { extractExternalUrls } from "../scripts/check-links.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function buildValidHtmlFixture() {
  const toolRows = TOOLS.map(
    (tool) => `<tr data-tool="${tool}"><td><pre><code>${tool}()</code></pre></td></tr>`,
  ).join("");
  const exampleCards = [1, 2, 3]
    .map(
      (n) =>
        `<li data-example="${n}"><a href="https://github.com/janusson/MSMCP/tree/1.0.2/examples" target="_blank" rel="noopener">Example ${n}</a></li>`,
    )
    .join("");
  const zedConfig = JSON.stringify({
    context_servers: {
      msmcp: {
        command: "uvx",
        args: ["--python", "3.13", "--from", "msmcp==1.0.2", "msmcp"],
        env: { MSMCP_ALLOWED_ROOT: "/absolute/path/to/ms-data" },
      },
    },
  }).replaceAll('"', "&quot;");
  const mcpConfig = JSON.stringify({
    mcpServers: {
      msmcp: {
        command: "uvx",
        args: ["--python", "3.13", "--from", "msmcp==1.0.2", "msmcp"],
        env: { MSMCP_ALLOWED_ROOT: "/absolute/path/to/ms-data" },
      },
    },
  }).replaceAll('"', "&quot;");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MSMCP</title>
    <meta name="description" content="An open-source MCP server that lets an AI assistant inspect your mass spectrometry data locally." />
    <link rel="canonical" href="${CANONICAL_ORIGIN}/" />
    <meta property="og:url" content="${CANONICAL_ORIGIN}/" />
    <meta property="og:image" content="${CANONICAL_ORIGIN}/og.png" />
    <meta name="twitter:image" content="${CANONICAL_ORIGIN}/og.png" />
    <link rel="icon" href="/favicon.svg" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap" />
    <link rel="stylesheet" href="/_astro/index.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header>
      <nav aria-label="Primary">
        ${MAJOR_SECTIONS.map((id) => `<a href="#${id}">${id}</a>`).join("")}
      </nav>
    </header>
    <main id="main" tabindex="-1">
      <section id="top">
        <h1>Ask your AI assistant about your mass spectrometry data.</h1>
        <p>Claude or any MCP host via Model Context Protocol across 15 tools.</p>
        <pre class="mono-block" tabindex="0"><code>${INSTALL_COMMAND}</code></pre>
      </section>
      <section id="example">
        <h2>Example</h2>
        <p>Uses fabricated demonstration spectra (not an identification probability) with scale 0–0.10. Production search does not report p-values, q-values or calibrated FDR.</p>
        <p>Glucose envelope: 181.0668 (0.0686), 182.0680 (0.0143).</p>
      </section>
      <section id="why">
        <h2>Why MSMCP</h2>
        <p>Classes: ${INSTRUMENT_CLASSES.join(", ")}.</p>
      </section>
      <section id="get-started">
        <h2>Get started</h2>
        <pre><code>${zedConfig}</code></pre>
        <pre><code>${mcpConfig}</code></pre>
        <p>Variables: ${ENV_VARS.join(", ")}</p>
      </section>
      <section id="tools">
        <h2>Tools</h2>
        <nav aria-label="Tool categories"><a href="#tools">All</a></nav>
        <p>check_search_status(job_id="&lt;job ID returned by search_library&gt;")</p>
        <table><tbody>${toolRows}</tbody></table>
      </section>
      <section id="docs">
        <h2>Docs</h2>
        <ul>
          <li><a href="https://pypi.org/project/msmcp/1.0.2/" target="_blank" rel="noopener">PyPI</a></li>
          <li><a href="https://github.com/janusson/MSMCP/releases/tag/1.0.2" target="_blank" rel="noopener">Release</a></li>
          <li><a href="https://github.com/janusson/MSMCP/blob/1.0.2/SCIENTIFIC_VALIDATION.md#4-capability-2" target="_blank" rel="noopener">Validation</a></li>
          <li><a href="https://github.com/janusson/MSMCP/blob/1.0.2/docs/chromatograms.md" target="_blank" rel="noopener">Chromatograms</a></li>
          <li><a href="https://github.com/janusson/MSMCP/blob/1.0.2/VALIDATION_SIMILARITY.md#reproduction" target="_blank" rel="noopener">Similarity</a></li>
          ${exampleCards}
        </ul>
      </section>
    </main>
    <footer>
      <nav aria-label="Footer"><a href="https://docs.astral.sh/uv/" target="_blank" rel="noopener">uv</a></nav>
    </footer>
  </body>
</html>`;
}

function getFailureNames(html) {
  return analyzeHtml(html)
    .checks.filter((c) => !c.pass)
    .map((c) => c.name);
}

describe("analyzeHtml security & contract regressions", () => {
  it("passes cleanly on a valid baseline fixture", () => {
    const failures = getFailureNames(buildValidHtmlFixture());
    assert.deepEqual(failures, []);
  });

  for (const href of [
    "https://github.com/janusson",
    "https://github.com/janusson/MSMCP/issues",
    "https://github.com/janusson/MSMCP/blob/main/LICENSE#license",
    "https://pypi.org/project/msmcp",
    "https://pypi.org/project/msmcp/1.0.2/?source=site#files",
    "https://docs.astral.sh",
    "https://docs.astral.sh/uv/guides/",
    "https://fonts.googleapis.com/css2?family=Inter&display=swap",
    "https://fonts.gstatic.com/s/inter/v1/font.woff2",
    "https://DOCS.ASTRAL.SH:443/uv/",
  ]) {
    it(`allows the intended external destination ${href}`, () => {
      const html = buildValidHtmlFixture().replace(
        "</body>",
        `<a href="${href}" target="_blank" rel="noopener">Allowed</a></body>`,
      );
      assert.deepEqual(getFailureNames(html), []);
    });
  }

  for (const href of [
    "https://docs.astral.sh.evil.example/uv/",
    "https://fonts.googleapis.com.evil.example/css2",
    "https://fonts.gstatic.com.evil.example/font.woff2",
    "https://github.com.evil.example/janusson/MSMCP",
    "https://pypi.org.evil.example/project/msmcp/",
    "https://github.com/janusson-elsewhere",
    "https://github.com/janusson_elsewhere/MSMCP",
    "https://github.com/elsewhere/MSMCP",
    "https://pypi.org/project/msmcp-elsewhere/",
    "https://pypi.org/project/another-package/",
    "https://github.com/janusson%2Felsewhere",
    "https://github.com/janusson/../elsewhere",
    "https://pypi.org/project/msmcp/../another-package/",
    "https://docs.astral.sh@evil.example/uv/",
    "https://user:password@docs.astral.sh/uv/",
    "https://user@github.com/janusson/MSMCP",
    "http://docs.astral.sh/uv/",
    "HTTP://github.com/janusson/MSMCP",
    "ftp://docs.astral.sh/uv/",
    "//docs.astral.sh/uv/",
    "https://docs.astral.sh:8443/uv/",
    "https://[invalid/",
  ]) {
    it(`rejects an untrusted external destination and identifies it: ${href}`, () => {
      const html = buildValidHtmlFixture().replace(
        "</body>",
        `<a href="${href}" target="_blank" rel="noopener">Rejected</a></body>`,
      );
      const check = analyzeHtml(html).checks.find(
        (c) => c.name === "every external link points at a known-in-good-faith host",
      );
      assert.equal(check.pass, false, `unexpectedly trusted ${href}`);
      assert.ok(check.detail.includes(href), `diagnostic must identify ${href}`);
    });
  }

  it("checks external font link destinations as well as anchors", () => {
    const html = buildValidHtmlFixture().replace(
      "https://fonts.googleapis.com/css2",
      "https://fonts.googleapis.com.evil.example/css2",
    );
    const check = analyzeHtml(html).checks.find(
      (c) => c.name === "every external link points at a known-in-good-faith host",
    );
    assert.equal(check.pass, false);
    assert.ok(check.detail.includes("https://fonts.googleapis.com.evil.example/css2"));
  });

  it("rejects duplicate ids and dead in-page anchors", () => {
    const html = buildValidHtmlFixture().replace(
      "<p>Glucose envelope:",
      '<p id="top"><a href="#missing-section">bad</a> Glucose envelope:',
    );
    const failures = getFailureNames(html);
    assert.ok(failures.some((n) => n.includes("duplicate id")));
    assert.ok(failures.some((n) => n.includes("in-page anchor resolves")));
  });

  it("rejects skipped heading hierarchy levels", () => {
    const html = buildValidHtmlFixture().replace("<h2>Example</h2>", "<h4>Example</h4>");
    const failures = getFailureNames(html);
    assert.ok(failures.some((n) => n.includes("heading hierarchy")));
  });

  it("rejects unlabeled or duplicate <nav> landmarks and missing skip-link focus target", () => {
    const html = buildValidHtmlFixture()
      .replace('aria-label="Tool categories"', "")
      .replace('tabindex="-1"', "");
    const failures = getFailureNames(html);
    assert.ok(failures.some((n) => n.includes("aria-label")));
    assert.ok(failures.some((n) => n.includes("skip link")));
  });

  it("rejects injected <script>, inline event handlers, javascript: URIs, http:// links, untrusted hosts, and missing rel=noopener", () => {
    const mutated = buildValidHtmlFixture()
      .replace("</body>", "<script>alert(1)</script></body>")
      .replace("<footer", '<footer onclick="evil()"')
      .replace(
        '<a href="#top">top</a>',
        '<a href="#top">top</a><a href="javascript:alert(1)">js</a><a href="http://example.com" target="_blank">ext</a>',
      );
    const failures = getFailureNames(mutated);
    assert.ok(failures.includes("no <script> elements in HTML"));
    assert.ok(failures.includes("no inline DOM event handler attributes"));
    assert.ok(failures.includes("no dangerous javascript:, vbscript:, or data:text/html URIs"));
    assert.ok(failures.includes("no insecure http:// links"));
    assert.ok(failures.some((n) => n.includes('rel="noopener"')));
    assert.ok(failures.includes("every external link points at a known-in-good-faith host"));
  });

  it("ignores descriptive 'on*' substrings inside quoted attribute values", () => {
    const html = buildValidHtmlFixture().replace(
      'aria-label="Footer"',
      'aria-label="Footer onClick=demo reference"',
    );
    const failures = getFailureNames(html);
    assert.ok(!failures.includes("no inline DOM event handler attributes"));
  });

  it("rejects welded inline words, template leaks, unescaped <job>, punctuation spacing, and nested major sections", () => {
    const mutated = buildValidHtmlFixture()
      .replace("Claude or any MCP host", "server-side:<code>validate_precursor</code> undefined")
      .replace("182.0680", "182.0680 <job>")
      .replace("PyPI</a>", "PyPI</a> .")
      .replace('<section id="why">', '<section id="outer"><section id="why">')
      .replace("</main>", "</section></main>");
    const failures = getFailureNames(mutated);
    assert.ok(failures.includes("no words welded together across an inline tag boundary"));
    assert.ok(failures.includes("no template leaks in the output"));
    assert.ok(failures.includes("job-ID placeholder is escaped and not parsed as an HTML tag"));
    assert.ok(failures.includes("no whitespace before punctuation after closing links"));
    assert.ok(failures.includes("major page sections are direct siblings inside <main>"));
  });

  it("rejects duplicate or missing tool rows and HTML exceeding 120 KB", () => {
    const mutated =
      buildValidHtmlFixture().replace('data-tool="ping"', 'data-tool="unknown_tool"') +
      " ".repeat(125 * 1024);
    const failures = getFailureNames(mutated);
    assert.ok(failures.some((n) => n.includes("tools table has one row per tool")));
    assert.ok(failures.some((n) => n.includes("under 120 KB")));
  });
});

describe("extractLocalAssetPaths and analyzeDist", () => {
  it("extracts local metadata, icon, stylesheet, and media paths while ignoring external CDNs", () => {
    const assets = extractLocalAssetPaths(buildValidHtmlFixture());
    assert.deepEqual(assets.sort(), ["/_astro/index.css", "/favicon.svg", "/og.png"]);
  });

  it("passes on a valid dist directory and catches missing CSS, JS bundles, and bad robots/sitemap", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "msmcp-dist-"));
    try {
      mkdirSync(path.join(tmpDir, "_astro"), { recursive: true });
      writeFileSync(path.join(tmpDir, "index.html"), buildValidHtmlFixture());
      writeFileSync(path.join(tmpDir, "_astro", "index.css"), "body{color:#fff}");
      writeFileSync(path.join(tmpDir, "favicon.svg"), "<svg/>");
      writeFileSync(path.join(tmpDir, "og.png"), "PNG");
      writeFileSync(
        path.join(tmpDir, "robots.txt"),
        `User-agent: *\nAllow: /\n\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`,
      );
      writeFileSync(
        path.join(tmpDir, "sitemap.xml"),
        `<urlset><url><loc>${CANONICAL_ORIGIN}/</loc></url></urlset>\n`,
      );

      const cleanResult = analyzeDist(tmpDir);
      assert.deepEqual(
        cleanResult.checks.filter((c) => !c.pass),
        [],
      );

      // Inject a JS bundle and truncate CSS to confirm dist guards trigger.
      writeFileSync(path.join(tmpDir, "_astro", "bad.js"), "console.log(1);");
      writeFileSync(path.join(tmpDir, "_astro", "index.css"), "");
      writeFileSync(path.join(tmpDir, "robots.txt"), "User-agent: *\n");

      const dirtyFailures = analyzeDist(tmpDir)
        .checks.filter((c) => !c.pass)
        .map((c) => c.name);
      assert.ok(dirtyFailures.includes("zero JavaScript files emitted in build output"));
      assert.ok(dirtyFailures.some((n) => n.includes("built stylesheet bundle is non-empty")));
      assert.ok(dirtyFailures.some((n) => n.includes("referenced local assets exist")));
      assert.ok(dirtyFailures.includes("robots.txt exists and references the HTTPS sitemap"));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("extractExternalUrls", () => {
  it("strips fragments, includes Google Fonts stylesheet, and deduplicates URLs", () => {
    const urls = extractExternalUrls(buildValidHtmlFixture());
    assert.ok(urls.includes("https://pypi.org/project/msmcp/1.0.2/"));
    assert.ok(
      urls.includes("https://github.com/janusson/MSMCP/blob/1.0.2/SCIENTIFIC_VALIDATION.md"),
    );
    assert.ok(urls.every((u) => !u.includes("#")));
  });
});

describe("repository configuration and dependency lockfile contracts", () => {
  it("keeps package.json dependency specs synchronized with package-lock.json", () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8"));
    const rootLock = lock.packages?.[""] ?? {};

    assert.equal(lock.lockfileVersion, 3);
    assert.deepEqual(rootLock.dependencies, pkg.dependencies);
    assert.deepEqual(rootLock.devDependencies, pkg.devDependencies);

    for (const dep of [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]) {
      const entry = lock.packages?.[`node_modules/${dep}`];
      assert.ok(entry, `Missing node_modules/${dep} in package-lock.json`);
      assert.match(entry.integrity ?? "", /^sha512-/);
    }
  });

  it("keeps canonical domain, Node version, and Dependabot configuration aligned", () => {
    const astroConfig = readFileSync(path.join(REPO_ROOT, "astro.config.mjs"), "utf8");
    const robots = readFileSync(path.join(REPO_ROOT, "public/robots.txt"), "utf8");
    const sitemap = readFileSync(path.join(REPO_ROOT, "public/sitemap.xml"), "utf8");
    const nodeVersion = readFileSync(path.join(REPO_ROOT, ".node-version"), "utf8").trim();
    const pagesWorkflow = readFileSync(path.join(REPO_ROOT, ".github/workflows/pages.yml"), "utf8");
    const maintenanceWorkflow = readFileSync(
      path.join(REPO_ROOT, ".github/workflows/weekly-maintenance.yml"),
      "utf8",
    );
    const dependabot = readFileSync(path.join(REPO_ROOT, ".github/dependabot.yml"), "utf8");
    const prettierConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, ".prettierrc"), "utf8"));

    assert.ok(astroConfig.includes(`"${CANONICAL_ORIGIN}"`));
    assert.ok(robots.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`));
    assert.ok(sitemap.includes(`<loc>${CANONICAL_ORIGIN}/</loc>`));
    assert.match(nodeVersion, /^\d+$/);
    assert.ok(pagesWorkflow.includes("node-version-file: .node-version"));
    assert.ok(
      maintenanceWorkflow.includes("node-version-file: .node-version") ||
        maintenanceWorkflow.includes(`node-version: "${nodeVersion}"`),
      `weekly-maintenance.yml Node version must match .node-version (${nodeVersion})`,
    );
    assert.ok(dependabot.includes("package-ecosystem: npm"));
    assert.ok(dependabot.includes("package-ecosystem: github-actions"));
    assert.ok(Array.isArray(prettierConfig.plugins));
  });
});
