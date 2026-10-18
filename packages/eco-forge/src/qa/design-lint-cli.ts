#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { formatDesignScore, scoreDesign } from "./design-lint.js";

/** eco-forge-design-lint <feature-dir> — lints hld/lld/integration + openapi vs spec; exit 2 on defects. */
const dir = process.argv[2];
if (!dir) {
  console.error("usage: eco-forge-design-lint <feature-dir>");
  process.exitCode = 1;
} else {
  const read = (f: string): string => {
    try {
      return readFileSync(`${dir}/${f}`, "utf8");
    } catch {
      return "";
    }
  };
  const design = [read("hld.md"), read("lld.md"), read("integration.md")].join("\n");
  const score = scoreDesign({ spec: read("spec.md"), design, openapi: read("api/openapi.yaml") });
  console.log(formatDesignScore(score));
  process.exitCode = score.pass ? 0 : 2;
}
