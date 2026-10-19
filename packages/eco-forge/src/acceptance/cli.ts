#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatMarkdown, runKit, type Probe } from "./kit.js";

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

const realProbe: Probe = {
  which: (cmd) => {
    const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" });
    return r.status === 0 ? (r.stdout.split("\n")[0]?.trim() || null) : null;
  },
  version: (cmd, args) => {
    try {
      // java -version prints to stderr; capture both.
      const out = execFileSync(cmd, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 });
      return (out.split("\n")[0] ?? "").trim() || null;
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string };
      const text = (err.stderr || err.stdout || "").toString();
      return text.split("\n")[0]?.trim() || null;
    }
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
