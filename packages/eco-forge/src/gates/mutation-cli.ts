#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { formatMutation, gate, parsePit, parseStryker } from "./mutation.js";

const HELP = `Usage: eco-forge-mutation (--pit <mutations.xml> | --stryker <mutation-report.json>) --min <pct>

Reads a PIT or Stryker mutation report and fails (exit 1) if the mutation score is below --min.
eco-forge does not run the mutators; PIT (Maven) and Stryker (Angular) produce the reports.

  --pit <file>       PIT mutations.xml (target/pit-reports/mutations.xml)
  --stryker <file>   Stryker mutation-report.json (reports/mutation/mutation.json)
  --min <pct>        Minimum mutation score to pass (e.g. 60)
  --help, -h
`;

export function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    options: { pit: { type: "string" }, stryker: { type: "string" }, min: { type: "string" }, help: { type: "boolean", short: "h", default: false } },
  });
  if (values.help || (!values.pit && !values.stryker) || !values.min) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  const result = values.pit ? parsePit(readFileSync(values.pit, "utf8")) : parseStryker(readFileSync(values.stryker as string, "utf8"));
  const g = gate(result, Number(values.min));
  console.log(formatMutation(g));
  return g.pass ? 0 : 1;
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  process.exit(main(process.argv.slice(2)));
}
