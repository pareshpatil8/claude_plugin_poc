#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseNpmAudit, parseTrivy, type ScaFinding } from "./sca.js";
import { formatTriage, triage, blocking, type ImportProbe } from "./reachability.js";

/**
 * eco-forge-sca --trivy <json> --npm <json> --src <dir> [--block critical,high]
 * Parses SCA reports, runs reachability triage, prints decisions, exits 2 if any finding is
 * reachable + act-on severity + unfixed (block-escalate). Unreachable findings are reported as
 * candidate waivers (with evidence) for the security agent / a human to confirm.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** First-party import probe: grep the source tree for the package's distinctive name. */
function makeProbe(srcDir: string | undefined): ImportProbe {
  if (!srcDir) {
    return () => true; // no source to inspect: assume reachable (safe default)
  }
  const cache = new Map<string, boolean>();
  return (f: ScaFinding) => {
    // For maven coordinates group:artifact, search the artifact and group tail; for npm, the name.
    const needles = f.pkg.includes(":")
      ? [f.pkg.split(":").pop() as string, (f.pkg.split(":")[0] ?? "").split(".").pop() as string]
      : [f.pkg.replace(/^@[^/]+\//, "")];
    const key = needles.join("|");
    const hit = cache.get(key);
    if (hit !== undefined) {
      return hit;
    }
    let found = false;
    for (const needle of needles) {
      if (!needle || needle.length < 3) {
        continue;
      }
      try {
        execFileSync("grep", ["-rqiI", "--include=*.java", "--include=*.ts", "--include=*.html", needle, srcDir], { stdio: "ignore" });
        found = true;
        break;
      } catch {
        // grep exit 1 = not found
      }
    }
    cache.set(key, found);
    return found;
  };
}

function main(): number {
  const findings: ScaFinding[] = [];
  const trivy = arg("--trivy");
  const npm = arg("--npm");
  if (trivy) {
    findings.push(...parseTrivy(readFileSync(trivy, "utf8")));
  }
  if (npm) {
    findings.push(...parseNpmAudit(readFileSync(npm, "utf8")));
  }
  if (findings.length === 0 && !trivy && !npm) {
    console.error("usage: eco-forge-sca --trivy <json> --npm <json> --src <dir> [--block critical,high]");
    return 1;
  }
  const triaged = triage(findings, makeProbe(arg("--src")));
  console.log(formatTriage(triaged));
  return blocking(triaged).length > 0 ? 2 : 0;
}

process.exitCode = main();
