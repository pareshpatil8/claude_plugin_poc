#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { formatSpecScore, scoreSpec } from "./spec-lint.js";

/** eco-forge-spec-lint <feature-dir> — lints spec.md/nfr.md/data-catalog.md; exit 2 on blocking defects. */
const dir = process.argv[2];
if (!dir) {
  console.error("usage: eco-forge-spec-lint <feature-dir>");
  process.exitCode = 1;
} else {
  const read = (f: string): string => {
    try {
      return readFileSync(`${dir}/${f}`, "utf8");
    } catch {
      return "";
    }
  };
  const score = scoreSpec({ spec: read("spec.md"), nfr: read("nfr.md"), dataCatalog: read("data-catalog.md") });
  console.log(formatSpecScore(score));
  process.exitCode = score.pass ? 0 : 2;
}
