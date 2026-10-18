#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseNfrPerf, toK6Options } from "./nfr-perf.js";

/** eco-forge-perf <feature-dir> — turns nfr.md into a k6 options block printed to stdout. */
const dir = process.argv[2];
if (!dir) {
  console.error("usage: eco-forge-perf <feature-dir>  # reads <dir>/nfr.md, emits k6 options");
  process.exitCode = 1;
} else {
  let nfr = "";
  try {
    nfr = readFileSync(`${dir}/nfr.md`, "utf8");
  } catch {
    console.error(`no nfr.md in ${dir}`);
    process.exitCode = 1;
  }
  const perf = parseNfrPerf(nfr);
  for (const note of perf.notes) {
    console.error(`note: ${note}`);
  }
  process.stdout.write(toK6Options(perf));
}
