#!/usr/bin/env node
// Measures eco-forge gate catch rate against the planted-defect catalogue.
// Runs Semgrep (eco custom rules) on the planted files and matches each Semgrep-targeted defect
// by rule id. SCA and SpotBugs defects are marked measuredSeparately (proven in their own runs).
// Usage: node measure.mjs <semgrep.sarif>
import { readFileSync, writeFileSync } from "node:fs";

const [sarifPath] = process.argv.slice(2);
const catalogue = JSON.parse(readFileSync(new URL("./catalogue.json", import.meta.url), "utf8"));
const defects = catalogue.defects;

// Rule ids present in the Semgrep SARIF (leaf id after any config-path prefix).
const firedRules = new Set();
if (sarifPath) {
  const sarif = JSON.parse(readFileSync(sarifPath, "utf8"));
  for (const run of sarif.runs ?? []) {
    for (const r of run.results ?? []) {
      const leaf = (r.ruleId ?? "").split(".").pop();
      if (leaf) firedRules.add(leaf);
    }
  }
}

const rows = defects.map((d) => {
  const [engine, rule] = d.gate.split(":");
  let caught, how;
  if (engine === "semgrep") {
    caught = firedRules.has(rule);
    how = caught ? "fired in this run" : "NOT fired";
  } else {
    caught = d.measuredSeparately === true;
    how = d.measuredSeparately ? `measured separately (${d.note ?? d.gate})` : "not measured";
  }
  return { ...d, caught, how };
});

const semgrepRows = rows.filter((r) => r.gate.startsWith("semgrep:"));
const semgrepCaught = semgrepRows.filter((r) => r.caught).length;
const total = rows.length;
const caughtTotal = rows.filter((r) => r.caught).length;

const lines = [
  "# eco-forge gate catch-rate report",
  "",
  `Planted defects: **${total}**. Caught: **${caughtTotal}/${total}**.`,
  `Semgrep-targeted (measured live in this run): **${semgrepCaught}/${semgrepRows.length}**.`,
  "",
  "| Defect | Category | Gate | Caught | How |",
  "|--------|----------|------|--------|-----|",
  ...rows.map((r) => `| ${r.id} | ${r.category} | ${r.gate} | ${r.caught ? "YES" : "NO"} | ${r.how} |`),
  "",
  "Notes:",
  "- SCA (Trivy) and SpotBugs/FindSecBugs defects are marked measured-separately: each was proven",
  "  blocking in its own run (Log4Shell SCA; command injection + predictable RNG via FindSecBugs).",
  "- This report is reproducible: `mvn -Pquality` + Semgrep + Trivy regenerate every input.",
];
const report = lines.join("\n");
writeFileSync(new URL("./catch-rate.md", import.meta.url), report + "\n");
console.log(report);
process.exitCode = semgrepCaught === semgrepRows.length ? 0 : 1;
