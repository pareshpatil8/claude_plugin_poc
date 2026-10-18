import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReport, median, parseUsage, summarise, totalTokens } from "../src/bench/metrics.js";
import type { RunResult } from "../src/bench/types.js";

const CLAUDE_JSON = JSON.stringify({
  total_cost_usd: 0.06,
  duration_ms: 1500,
  num_turns: 3,
  usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 2000, cache_creation_input_tokens: 500 },
});

const run = (armId: string, passed: boolean, input: number, output: number): RunResult => ({
  taskId: "t1",
  armId,
  repetition: 1,
  passed,
  usage: { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: input / 1000, durationMs: 1000, numTurns: 1 },
});

describe("parseUsage", () => {
  it("reads the claude -p JSON shape", () => {
    const u = parseUsage(CLAUDE_JSON);
    assert.equal(u.inputTokens, 100);
    assert.equal(u.cacheCreationTokens, 500);
    assert.equal(u.costUsd, 0.06);
    assert.equal(totalTokens(u), 640); // 100 + 40 + 500, cache reads excluded
  });
  it("tolerates missing fields", () => {
    assert.equal(parseUsage("{}").inputTokens, 0);
  });
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), 0);
  });
});

describe("summarise", () => {
  it("computes pass rate and tokens per PASSING task", () => {
    const results = [
      run("eco", true, 100, 10),
      run("eco", true, 200, 20),
      run("eco", false, 50, 5), // a cheap failure must not lower the headline metric
    ];
    const [eco] = summarise(results);
    assert.equal(eco?.runs, 3);
    assert.ok(Math.abs((eco?.passRate ?? 0) - 2 / 3) < 1e-9);
    assert.equal(eco?.tokensPerPassingTask, 165); // median of 110 and 220
  });
  it("reports 0 tokens-per-passing-task when nothing passed", () => {
    assert.equal(summarise([run("x", false, 100, 10)])[0]?.tokensPerPassingTask, 0);
  });
});

describe("formatReport", () => {
  it("renders a delta against the baseline", () => {
    const summaries = summarise([
      run("vanilla", true, 1000, 0),
      run("eco", true, 600, 0),
    ]);
    const report = formatReport(summaries, "vanilla");
    assert.match(report, /tokens per passing task/);
    assert.match(report, /-40\.0%/); // eco is 40% fewer tokens
  });
});

describe("runBench (injected invoke/check)", () => {
  it("records pass/fail and usage per arm, repetition and check", async () => {
    const { runBench } = await import("../src/bench/run.js");
    const tasks = [{ id: "t1", prompt: "do x", check: "true" }];
    const arms = [
      { id: "vanilla", claudeArgs: [], description: "baseline" },
      { id: "eco", claudeArgs: ["--append-system-prompt", "terse"], description: "terse" },
    ];
    const results = runBench(tasks, arms, {
      cwd: ".",
      repetitions: 2,
      invoke: (_p, args) => ({
        stdout: JSON.stringify({ usage: { input_tokens: args.length > 0 ? 50 : 100, output_tokens: 10 } }),
        code: 0,
      }),
      check: (cmd) => cmd === "true",
    });
    assert.equal(results.length, 4);
    assert.ok(results.every((r) => r.passed));
    const eco = results.find((r) => r.armId === "eco");
    assert.equal(eco?.usage.inputTokens, 50);
  });

  it("marks a failing check as not passed", async () => {
    const { runBench } = await import("../src/bench/run.js");
    const results = runBench([{ id: "t", prompt: "p", check: "false" }], [{ id: "a", claudeArgs: [], description: "" }], {
      cwd: ".",
      repetitions: 1,
      invoke: () => ({ stdout: JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }), code: 0 }),
      check: () => false,
    });
    assert.equal(results[0]?.passed, false);
  });
});
