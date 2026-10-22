#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatMarkdown, runKit, type Probe } from "./kit.js";

// On Windows, `java`/`mvn` are often .cmd/.exe or App Execution Aliases that a bare
// execFile cannot resolve, so run version probes through the shell there.
const USE_SHELL = process.platform === "win32";

const HELP = `Usage: eco-forge-acceptance [--out <dir>] [--json]

Runs the read-only pre-prod acceptance suite and writes a self-documenting report.
It never reads secret values, never deploys, never mutates anything.

Options:
  --out <dir>   Directory to write acceptance-report.md and .json (default: current dir)
  --json        Also print the JSON report to stdout
  --help, -h    Show this help

Optional environment variables it will verify when set (endpoints only; values never printed):
  CLAUDE_CODE_USE_BEDROCK, AWS_REGION, ANTHROPIC_MODEL (and *_DEFAULT_* model IDs),
  GITLAB_URL, VAULT_ADDR, OIDC_DISCOVERY_URL, DEFECTDOJO_URL, DEPENDENCYTRACK_URL
`;

export const realProbe: Probe = {
  which: (cmd) => {
    const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" });
    return r.status === 0 ? (r.stdout.split("\n")[0]?.trim() || null) : null;
  },
  version: (cmd, args) => {
    // `java -version` writes to stderr and exits 0; `node --version` writes to stdout.
    // spawnSync never throws on a non-zero exit, so combine both streams regardless of
    // exit code and take the first non-empty line.
    const r = spawnSync(cmd, [...args], { encoding: "utf8", timeout: 15_000, shell: USE_SHELL });
    if (r.error) return null;
    const text = ((r.stdout ?? "") + (r.stderr ?? "")).trim();
    const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
    return first ?? null;
  },
  envSet: (name) => process.env[name] !== undefined && process.env[name] !== "",
  envValue: (name) => process.env[name],
  httpStatus: async (url) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(url, { method: "GET", signal: ctrl.signal });
      clearTimeout(t);
      return res.status;
    } catch {
      return null;
    }
  },
  fileExists: (p) => existsSync(p),
};

export async function main(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({ args: [...argv], options: { out: { type: "string" }, json: { type: "boolean", default: false }, help: { type: "boolean", short: "h", default: false } } });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const outDir = path.resolve(values.out ?? ".");
  mkdirSync(outDir, { recursive: true });

  const report = await runKit(realProbe);
  const md = formatMarkdown(report);
  writeFileSync(path.join(outDir, "acceptance-report.md"), md + "\n", "utf8");
  writeFileSync(path.join(outDir, "acceptance-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(md);
  if (values.json) {
    console.log("\n" + JSON.stringify(report, null, 2));
  }
  console.log(`\nWrote ${path.join(outDir, "acceptance-report.md")} and acceptance-report.json`);
  // Exit 0 even when checks fail: the report is the deliverable; CI can gate on the JSON verdict.
  return 0;
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
