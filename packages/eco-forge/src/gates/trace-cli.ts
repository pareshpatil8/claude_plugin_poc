#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { checkTraceability, formatTrace } from "./trace.js";

/**
 * eco-forge-trace <feature-dir> [--tests glob]
 * Reads <feature-dir>/spec.md and uat.md, scans test files for REQ-IDs, and exits 2 if any
 * requirement lacks a test or UAT case, or any orphan reference exists.
 */
async function main(): Promise<number> {
  const featureDir = process.argv[2];
  if (!featureDir) {
    console.error("usage: eco-forge-trace <feature-dir> [--tests <glob>]");
    return 1;
  }
  const testsGlobIndex = process.argv.indexOf("--tests");
  const testsGlob = testsGlobIndex >= 0 ? process.argv[testsGlobIndex + 1] : "**/*{Test,test,spec}.*";

  const read = (f: string): string => {
    try {
      return readFileSync(`${featureDir}/${f}`, "utf8");
    } catch {
      return "";
    }
  };

  let tests = "";
  for await (const file of glob(testsGlob as string)) {
    try {
      tests += readFileSync(file, "utf8") + "\n";
    } catch {
      // ignore unreadable matches
    }
  }

  const report = checkTraceability({ spec: read("spec.md"), tests, uat: read("uat.md") });
  console.log(formatTrace(report));
  return report.pass ? 0 : 2;
}

main().then((code) => {
  process.exitCode = code;
});
