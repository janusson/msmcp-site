#!/usr/bin/env node
/**
 * Proactive external-link availability checker for the built site.
 *
 * Reads `dist/index.html`, deduplicates external HTTPS URLs (stripping
 * URL fragments, which servers do not receive), and verifies each endpoint
 * returns HTTP 2xx/3xx via HEAD with a GET fallback for hosts that disallow HEAD.
 *
 * Requires network access (`make check-links`). Kept separate from `make all`
 * so CI builds stay deterministic and offline-safe.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_HTML = "dist/index.html";
const REQUEST_TIMEOUT_MS = 10_000;
const HOST_DELAY_MS = 250;

/** Extracts deduplicated external `https://` request URLs from HTML anchors and stylesheets. */
export function extractExternalUrls(html) {
  const candidates = [
    ...[...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(https?:\/\/[^"]+)"/gi)].map(
      (m) => m[1],
    ),
  ];

  const unique = new Set();
  for (const rawUrl of candidates) {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    unique.add(parsed.toString());
  }
  return [...unique].sort();
}

async function fetchStatus(url, method) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "user-agent": "msmcp-site-link-check/1.0 (+https://msmcp.dev)",
      accept: "text/html,text/css,*/*;q=0.8",
    },
  });
  await response.body?.cancel();
  return response.status;
}

/** Probes one external URL, falling back from HEAD to GET when needed and retrying transient errors once. */
export async function probeUrl(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let status = await fetchStatus(url, "HEAD");
      if (status === 403 || status === 405 || status === 501) {
        status = await fetchStatus(url, "GET");
      }
      if (status >= 200 && status < 400) {
        return { url, ok: true, status };
      }
      if ((status === 429 || status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      return { url, ok: false, status };
    } catch (err) {
      if (attempt === 0) continue;
      return { url, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { url, ok: false, error: "exhausted retries" };
}

async function checkUrlsByHost(urls) {
  const byHost = new Map();
  for (const url of urls) {
    const host = new URL(url).hostname;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }

  const results = new Map();
  await Promise.all(
    [...byHost.values()].map(async (hostUrls) => {
      for (let i = 0; i < hostUrls.length; i += 1) {
        if (i > 0) await new Promise((resolve) => setTimeout(resolve, HOST_DELAY_MS));
        results.set(hostUrls[i], await probeUrl(hostUrls[i]));
      }
    }),
  );
  return urls.map((u) => results.get(u));
}

async function main() {
  const htmlPath = process.argv[2] ?? DEFAULT_HTML;
  if (!existsSync(htmlPath)) {
    console.error(`No built HTML found at ${htmlPath}. Run \`make build\` first.`);
    process.exit(1);
  }

  const urls = extractExternalUrls(readFileSync(htmlPath, "utf8"));
  const results = await checkUrlsByHost(urls);
  const failures = results.filter((r) => !r.ok);

  for (const r of results) {
    if (r.ok) {
      console.log(`  ok    ${r.status}  ${r.url}`);
    } else {
      console.log(`  FAIL  ${r.status ?? r.error}  ${r.url}`);
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`check-links: ${failures.length} external URL(s) failed.`);
    process.exit(1);
  }
  console.log(`check-links: all ${results.length} unique external URLs resolved.`);
}

const isEntrypoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  await main();
}
