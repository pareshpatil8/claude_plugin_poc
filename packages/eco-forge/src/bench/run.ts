import { spawnSync } from "node:child_process";
import { parseUsage } from "./metrics.js";
import type { BenchArm, BenchTask, RunResult, RunUsage } from "./types.js";

export interface RunnerOptions {
  readonly cwd: string;
  readonly repetitions: number;
  /** Injected for tests; defaults to invoking the real `claude` CLI. */
  readonly invoke?: (prompt: string, args: readonly string[], cwd: string) => { stdout: string; code: number };
  readonly check?: (command: string, cwd: string) => boolean;
}

const EMPTY: RunUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0, durationMs: 0, numTurns: 0 };

const realInvoke = (prompt: string, args: readonly string[], cwd: string): { stdout: string; code: number } => {
  const result = spawnSync("claude", ["-p", prompt, "--output-format", "json", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: result.stdout ?? "", code: result.status ?? 1 };
};

const realCheck = (command: string, cwd: string): boolean =>
  spawnSync(command, { cwd, shell: true, timeout: 120_000 }).status === 0;

export function runBench(tasks: readonly BenchTask[], arms: readonly BenchArm[], options: RunnerOptions): RunResult[] {
  const invoke = options.invoke ?? realInvoke;
  const check = options.check ?? realCheck;
  const results: RunResult[] = [];

  for (const arm of arms) {
    for (const task of tasks) {
      for (let rep = 1; rep <= options.repetitions; rep++) {
        results.push(runOne(task, arm, rep, options.cwd, invoke, check));
      }
    }
  }
  return results;
}

function runOne(
  task: BenchTask,
  arm: BenchArm,
  repetition: number,
  cwd: string,
  invoke: NonNullable<RunnerOptions["invoke"]>,
  check: NonNullable<RunnerOptions["check"]>,
): RunResult {
  let out;
  try {
    out = invoke(task.prompt, arm.claudeArgs, cwd);
  } catch (error) {
    return { taskId: task.id, armId: arm.id, repetition, passed: false, usage: EMPTY, error: (error as Error).message };
  }
  let usage: RunUsage;
  try {
    usage = parseUsage(out.stdout);
  } catch {
    return { taskId: task.id, armId: arm.id, repetition, passed: false, usage: EMPTY, error: "unparseable claude output" };
  }
  // Pass = the model finished AND (no check, or the check command succeeds).
  const passed = out.code === 0 && (task.check === undefined || check(task.check, cwd));
  return { taskId: task.id, armId: arm.id, repetition, passed, usage };
}
