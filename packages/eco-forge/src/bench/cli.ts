#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Ledger } from "./ledger.js";
import { parseUsage } from "./metrics.js";
import { formatReport, summarise } from "./metrics.js";
import { expandPlan } from "./plan.js";
import { runSession } from "./session.js";
import type { BenchArm, BenchTask, RunResult, RunUsage } from "./types.js";
import { cleanupWorkspace, ensureDir, prepareWorkspace, type AddedFile, type TaskRegression } from "./workspace.js";
import { contextModeEnv, wireContextMode } from "./context-mode.js";
import { ponytailEnv, wirePonytail } from "./ponytail.js";
import { wireRtk } from "./rtk.js";

interface TaskConfig extends BenchTask {
  readonly title?: string;
  readonly kind?: string;
  readonly regression?: TaskRegression;
  readonly addFiles?: readonly AddedFile[];
  /** eco-arm slash command this task routes through (e.g. "eco-bugfix", "eco-dev"). */
  readonly ecoCommand?: string;
}

interface ArmConfig extends BenchArm {
  readonly eco: boolean;
  /** When true, the context-mode token tool is wired into this arm's workspace. */
  readonly contextMode?: boolean;
  /** When true, the ponytail "write minimum code" tool is wired into this arm's workspace. */
  readonly ponytail?: boolean;
  /** When true, the rtk shell-output compression tool is wired into this arm's workspace. */
  readonly rtk?: boolean;
}

const EMPTY: RunUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0, durationMs: 0, numTurns: 0 };
const USAGE_LIMIT = /usage limit|rate[_ ]?limit|overloaded|too many requests|\b429\b|quota|insufficient[_ ]quota|resource[_ ]exhausted/i;

const HELP = `Usage: eco-forge-bench <run|report> [options]

run options:
  --state <dir>            State directory holding the resumable ledger (required)
  --tasks <file>           tasks.json (required)
  --arms <file>            arms.json (required)
  --source <dir>           Pristine project to copy per run (required)
  --reps <n>               Repetitions per (arm,task) cell (default 1)
  --overall-budget <usd>   Hard ceiling across ALL sessions (default: unlimited)
  --session-budget <usd>   Stop this session at this spend (default: unlimited)
  --max-runs <n>           Safety stop after N runs this session
  --eco-cli <path>         Path to eco-forge dist/cli.js (default: alongside this CLI)
  --cm-root <path>         Install dir of context-mode (required for a context-mode arm)
  --ponytail-root <path>   Clone dir of ponytail (required for a ponytail arm)
  --rtk-bin <path>         Built rtk binary (required for an rtk arm)
  --rtk-assets <path>      rtk repo dir with .rtk/filters.toml + awareness (required for an rtk arm)
  --run-timeout <sec>      Per-run claude timeout in seconds (default 900)

report options:
  --state <dir>            State directory holding the ledger (required)
  --baseline <armId>       Baseline arm for the % column (default: vanilla)

General:
  --help, -h               Show this help
`;

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function classifyUsageExhausted(stdout: string, stderr: string, code: number): boolean {
  const text = `${stdout}\n${stderr}`;
  if (USAGE_LIMIT.test(text)) {
    return true;
  }
  // A parseable result that is an error with a 429-ish api status also counts.
  try {
    const parsed = JSON.parse(stdout) as { is_error?: boolean; api_error_status?: number | string };
    if (parsed.is_error && String(parsed.api_error_status ?? "").includes("429")) {
      return true;
    }
  } catch {
    // Non-JSON output on a non-zero exit with no usage-limit text is a normal failure, not exhaustion.
    void code;
  }
  return false;
}

function runCli(argv: readonly string[]): number {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (sub === "run") {
    return doRun(rest);
  }
  if (sub === "report") {
    return doReport(rest);
  }
  console.log(HELP);
  return sub === undefined || sub === "--help" || sub === "-h" ? 0 : 1;
}

function doRun(args: readonly string[]): number {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      state: { type: "string" },
      tasks: { type: "string" },
      arms: { type: "string" },
      source: { type: "string" },
      reps: { type: "string" },
      "overall-budget": { type: "string" },
      "session-budget": { type: "string" },
      "max-runs": { type: "string" },
      "eco-cli": { type: "string" },
      "cm-root": { type: "string" },
      "ponytail-root": { type: "string" },
      "rtk-bin": { type: "string" },
      "rtk-assets": { type: "string" },
      "run-timeout": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help || !values.state || !values.tasks || !values.arms || !values.source) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }

  const stateDir = path.resolve(values.state);
  ensureDir(stateDir);
  const logsDir = path.join(stateDir, "logs");
  ensureDir(logsDir);
  const sourceDir = path.resolve(values.source);
  const reps = values.reps ? Number(values.reps) : 1;
  const runTimeoutMs = (values["run-timeout"] ? Number(values["run-timeout"]) : 900) * 1000;
  const ecoCliPath = values["eco-cli"]
    ? path.resolve(values["eco-cli"])
    : path.resolve(fileURLToPath(new URL("../cli.js", import.meta.url)));
  const cmRoot = values["cm-root"] ? path.resolve(values["cm-root"]) : undefined;
  const ponytailRoot = values["ponytail-root"] ? path.resolve(values["ponytail-root"]) : undefined;
  const rtkBin = values["rtk-bin"] ? path.resolve(values["rtk-bin"]) : undefined;
  const rtkAssets = values["rtk-assets"] ? path.resolve(values["rtk-assets"]) : undefined;

  const tasks = loadJson<TaskConfig[]>(values.tasks);
  const arms = loadJson<ArmConfig[]>(values.arms);
  const plan = expandPlan(tasks, arms, reps);
  const ledger = new Ledger(stateDir);

  const armById = new Map(arms.map((a) => [a.id, a]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const caps = {
    overallBudgetUsd: values["overall-budget"] ? Number(values["overall-budget"]) : Number.POSITIVE_INFINITY,
    sessionBudgetUsd: values["session-budget"] ? Number(values["session-budget"]) : Number.POSITIVE_INFINITY,
    ...(values["max-runs"] ? { maxRunsThisSession: Number(values["max-runs"]) } : {}),
  };

  const runOne = (task: BenchTask, arm: BenchArm, rep: number): RunResult => {
    const armCfg = armById.get(arm.id) as ArmConfig;
    const taskCfg = taskById.get(task.id) as TaskConfig;
    const base: RunResult = { taskId: task.id, armId: arm.id, repetition: rep, passed: false, usage: EMPTY };
    let ws: string | undefined;
    try {
      ws = prepareWorkspace({
        sourceDir,
        arm: { id: armCfg.id, eco: armCfg.eco },
        ...(taskCfg.regression ? { regression: taskCfg.regression } : {}),
        ...(taskCfg.addFiles ? { addFiles: taskCfg.addFiles } : {}),
        ...(armCfg.eco ? { ecoCliPath } : {}),
      });
      // The eco arm routes the task through its slash command; vanilla gets the raw prompt.
      const prompt = armCfg.eco && taskCfg.ecoCommand ? `/${taskCfg.ecoCommand} ${task.prompt}` : task.prompt;
      const claudeArgs = [...(armCfg.claudeArgs ?? [])];
      let spawnEnv = process.env;
      if (armCfg.contextMode) {
        if (!cmRoot) {
          throw new Error("--cm-root is required for a context-mode arm");
        }
        const cmCfg = { cmRoot, storageDir: path.join(ws, ".ctxstore") };
        wireContextMode(ws, cmCfg);
        claudeArgs.push("--mcp-config", path.join(ws, ".mcp.json"));
        spawnEnv = { ...process.env, ...contextModeEnv(cmCfg) };
      }
      if (armCfg.ponytail) {
        if (!ponytailRoot) {
          throw new Error("--ponytail-root is required for a ponytail arm");
        }
        const pcfg = { root: ponytailRoot };
        wirePonytail(ws, pcfg);
        spawnEnv = { ...spawnEnv, ...ponytailEnv(pcfg) };
      }
      if (armCfg.rtk) {
        if (!rtkBin || !rtkAssets) {
          throw new Error("--rtk-bin and --rtk-assets are required for an rtk arm");
        }
        wireRtk(ws, { bin: rtkBin, assetsRoot: rtkAssets });
      }
      const invoked = spawnSync("claude", ["-p", prompt, "--output-format", "json", ...claudeArgs], {
        cwd: ws,
        encoding: "utf8",
        timeout: runTimeoutMs,
        maxBuffer: 128 * 1024 * 1024,
        env: spawnEnv,
      });
      const stdout = invoked.stdout ?? "";
      const stderr = invoked.stderr ?? "";
      const code = invoked.status ?? 1;
      writeFileSync(path.join(logsDir, `${arm.id}__${task.id}__${rep}.json`), stdout || stderr, "utf8");

      if (classifyUsageExhausted(stdout, stderr, code)) {
        return { ...base, error: "usage-exhausted" };
      }
      let usage: RunUsage;
      try {
        usage = parseUsage(stdout);
      } catch {
        return { ...base, error: "unparseable claude output" };
      }
      const checkOk = task.check === undefined || spawnSync(task.check, { cwd: ws, shell: true, timeout: 300_000 }).status === 0;
      return { ...base, passed: code === 0 && checkOk, usage };
    } catch (error) {
      return { ...base, error: (error as Error).message };
    } finally {
      if (ws) {
        cleanupWorkspace(ws);
      }
    }
  };

  const outcome = runSession(plan, ledger, runOne, caps, {
    shouldAbort: (r) => r.error === "usage-exhausted",
    onProgress: (cell, result, totalSpent) => {
      const status = result.passed ? "PASS" : `FAIL${result.error ? ` (${result.error})` : ""}`;
      console.log(
        `  [${cell.key}] ${status}  cost=$${result.usage.costUsd.toFixed(4)}  turns=${result.usage.numTurns}  total=$${totalSpent.toFixed(2)}`,
      );
    },
  });

  console.log(
    `\nran ${outcome.ran}, skipped ${outcome.skipped}, session spent $${outcome.sessionSpentUsd.toFixed(2)}, ` +
      `total spent $${outcome.totalSpentUsd.toFixed(2)}, remaining ${outcome.remaining}, stop ${outcome.stop}`,
  );
  if (outcome.stop === "aborted") {
    console.log("Usage limit hit — this cell was NOT recorded; re-run the same command after the limit resets to continue.");
  }
  return 0;
}

function doReport(args: readonly string[]): number {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      state: { type: "string" },
      baseline: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help || !values.state) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  const ledger = new Ledger(path.resolve(values.state));
  const results = ledger.all();
  if (results.length === 0) {
    console.log("No runs recorded yet.");
    return 0;
  }
  console.log(formatReport(summarise(results), values.baseline ?? "vanilla"));
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
  process.exit(runCli(process.argv.slice(2)));
}

export { runCli };
