#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { doctorExitCode, formatDoctor, runDoctor } from "./commands/doctor.js";
import { formatInitResult, runInit } from "./commands/init.js";
import { packageInfo } from "./core/package-info.js";

const HELP = `Usage: eco-forge <command> [options]

Commands:
  init      Install eco-forge configuration into a project
  doctor    Check workstation prerequisites

init options:
  --dir <path>             Project directory (default: current directory)
  --profile <name>         Profile to apply (default: springboot-angular)
  --name <name>            Project name (default: directory name)
  --provider <p>           bedrock (default) | subscription (testing, synthetic data only)
  --classification <c>     client (default) | synthetic
  --aws-region <r>         India region for Bedrock (default: ap-south-1)
  --model-high <id>        In-region Bedrock model ID for the high tier
  --model-mid <id>         ... for the mid tier
  --model-low <id>         ... for the low tier
  --dry-run                Show what would change without writing
  --force                  Replace unmanaged conflicting files (originals are backed up)
  --json                   Machine-readable output

General:
  --help, -h               Show this help
  --version, -v            Show the eco-forge version
`;

export function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      dir: { type: "string" },
      profile: { type: "string" },
      name: { type: "string" },
      provider: { type: "string" },
      classification: { type: "string" },
      "aws-region": { type: "string" },
      "model-high": { type: "string" },
      "model-mid": { type: "string" },
      "model-low": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.version) {
    console.log(packageInfo().version);
    return 0;
  }
  const [command, ...rest] = positionals;
  if (values.help || command === undefined) {
    console.log(HELP);
    return command === undefined && !values.help ? 1 : 0;
  }
  if (rest.length > 0) {
    throw new UsageError(`Unexpected argument(s): ${rest.join(" ")}`);
  }

  const dir = values.dir ?? process.cwd();
  switch (command) {
    case "init": {
      const result = runInit({
        dir,
        profile: values.profile,
        name: values.name,
        provider: values.provider,
        classification: values.classification,
        awsRegion: values["aws-region"],
        modelHigh: values["model-high"],
        modelMid: values["model-mid"],
        modelLow: values["model-low"],
        dryRun: values["dry-run"],
        force: values.force,
      });
      console.log(
        values.json
          ? JSON.stringify(
              {
                ...result,
                actions: result.actions.map((a) => ({ kind: a.kind, dest: a.file.dest, reason: a.reason })),
              },
              null,
              2,
            )
          : formatInitResult(result),
      );
      return result.exitCode;
    }
    case "doctor": {
      const results = runDoctor(dir);
      console.log(values.json ? JSON.stringify(results, null, 2) : formatDoctor(results));
      return doctorExitCode(results);
    }
    default:
      throw new UsageError(`Unknown command "${command}". Run eco-forge --help.`);
  }
}

class UsageError extends Error {}

/** npm runs bins through symlinks (Linux) or shims (Windows), so compare real paths. */
function isEntrypoint(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) {
    return false;
  }
  try {
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`eco-forge: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
