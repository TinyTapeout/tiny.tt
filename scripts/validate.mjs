#!/usr/bin/env node
/**
 * Parses, validates, and bundles the _redirects file.
 *
 * - Reads _redirects (Cloudflare Pages / Netlify standard format)
 * - Validates: source format, destination URLs, status codes, duplicates,
 *   reserved paths, and that exactly one /* catchall is present.
 * - Emits src/_redirects.generated.ts so the worker imports a typed,
 *   pre-parsed structure (no runtime parsing).
 *
 * Exit code is non-zero on any error so CI / Cloudflare builds fail loudly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_PATH = join(ROOT, "_redirects");
const OUT_PATH = join(ROOT, "src", "_redirects.generated.ts");

const SLUG_RE = /^\/([a-zA-Z0-9_-]+)$/;
const STATUS_RE = /^(301|302|307|308)$/;
const RESERVED = new Set(["_dashboard", "robots.txt", "favicon.ico"]);

const text = readFileSync(SRC_PATH, "utf8");
const errors = [];
const rules = new Map();
let fallback = null;

text.split(/\r?\n/).forEach((rawLine, idx) => {
  const lineNo = idx + 1;
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith("#")) return;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2 || parts.length > 3) {
    errors.push(`line ${lineNo}: expected "<source> <destination> [status]", got: ${rawLine}`);
    return;
  }
  const [source, destination, statusStr] = parts;

  if (!/^https?:\/\//i.test(destination)) {
    errors.push(
      `line ${lineNo}: destination must start with http:// or https://, got: ${destination}`,
    );
    return;
  }

  let status = 302;
  if (statusStr !== undefined) {
    if (!STATUS_RE.test(statusStr)) {
      errors.push(`line ${lineNo}: status must be 301, 302, 307, or 308 (got: ${statusStr})`);
      return;
    }
    status = Number(statusStr);
  }

  if (source === "/*") {
    if (fallback) {
      errors.push(`line ${lineNo}: duplicate /* catchall (also at line ${fallback.lineNo})`);
      return;
    }
    fallback = { destination, status, lineNo };
    return;
  }

  const m = source.match(SLUG_RE);
  if (!m) {
    errors.push(`line ${lineNo}: source must be /<slug> or /*, got: ${source}`);
    return;
  }
  const slug = m[1];
  if (RESERVED.has(slug)) {
    errors.push(`line ${lineNo}: "/${slug}" is reserved`);
    return;
  }
  if (rules.has(slug)) {
    errors.push(`line ${lineNo}: duplicate slug "${slug}"`);
    return;
  }
  rules.set(slug, { destination, status });
});

if (!fallback) {
  errors.push(`missing required catchall: add a "/* https://... 302" line at the bottom`);
}

if (errors.length) {
  console.error("_redirects has errors:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const sortedRules = Object.fromEntries([...rules.entries()].sort(([a], [b]) => a.localeCompare(b)));
const fallbackOut = { destination: fallback.destination, status: fallback.status };

const content = `// AUTO-GENERATED from /_redirects by scripts/validate.mjs - do not edit.
// To change redirects, edit /_redirects at the repo root.

export interface Rule { destination: string; status: number }

export const RULES: Readonly<Record<string, Rule>> = ${JSON.stringify(sortedRules, null, 2)} as const;

export const FALLBACK: Rule = ${JSON.stringify(fallbackOut, null, 2)} as const;
`;

writeFileSync(OUT_PATH, content);

console.log(
  `_redirects OK: ${rules.size} link${rules.size === 1 ? "" : "s"}, fallback to ${fallback.destination}`,
);
