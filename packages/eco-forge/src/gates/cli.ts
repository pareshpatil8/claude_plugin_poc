#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { applyPolicy, type GateConfig, type Waiver } from "./policy.js";
import { fingerprints, parseSarif, reduce, type Severity } from "./sarif.js";

/**
 * eco-forge-gate <sarif...> [--baseline file] [--waivers file] [--block sev,sev] [--write-baseline file]
 * Reduces SARIF to new findings, applies the waiver policy, prints a compact report, exits 2 if
 * any new finding blocks. This is what the GitLab MR pipeline calls after the scanners run.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): number {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".sarif") || a.endsWith(".json"));
  if (files.length === 0) {
    console.error("usage: eco-forge-gate <sarif...> [--baseline f] [--waivers f] [--block critical,high]");
    return 1;
  }
  const findings = files.flatMap((f) => parseSarif(readFileSync(f, "utf8")));
  const baseline = new Set<string>(arg("--baseline") ? (JSON.parse(readFileSync(arg("--baseline") as string, "utf8")) as string[]) : []);
  const { newFindings, suppressedByBaseline, duplicates } = reduce(findings, baseline);

  const block = (arg("--block") ?? "critical,high").split(",") as Severity[];
  const waivers: Waiver[] = arg("--waivers") ? (JSON.parse(readFileSync(arg("--waivers") as string, "utf8")) as Waiver[]) : [];
  const config: GateConfig = { blockSeverities: block, requireApprover: true, requireExpiry: true, maxDurationDays: 90 };
  const result = applyPolicy(newFindings, waivers, config);

  console.log(`eco-forge gate: ${findings.length} raw, ${newFindings.length} new (${suppressedByBaseline} baselined, ${duplicates} duplicate)`);
  for (const f of result.blocking) {
    console.log(`  BLOCK [${f.severity}] ${f.ruleId} ${f.file}:${f.line} — ${f.message}`);
  }
  for (const w of result.invalidWaivers) {
    console.log(`  invalid waiver ${w.waiver.fingerprint}: ${w.problem}`);
  }
  const baselineOut = arg("--write-baseline");
  if (baselineOut) {
    writeFileSync(baselineOut, JSON.stringify(fingerprints(findings), null, 2));
  }
  console.log(result.pass ? "GATE PASS" : `GATE FAIL (${result.blocking.length} blocking)`);
  return result.pass ? 0 : 2;
}

process.exitCode = main();
