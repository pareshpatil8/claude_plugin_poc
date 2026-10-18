import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Ledger } from "../src/bench/ledger.js";
import { expandPlan } from "../src/bench/plan.js";
import { runSession } from "../src/bench/session.js";
import type { BenchArm, BenchTask, RunResult, RunUsage } from "../src/bench/types.js";
import { cleanupWorkspace, prepareWorkspace } from "../src/bench/workspace.js";

const usage = (cost: number): RunUsage => ({
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: cost,
  durationMs: 1000,
  numTurns: 1,
});

const tasks: BenchTask[] = [{ id: "t1", prompt: "p" }];
const arms: BenchArm[] = [
  { id: "vanilla", claudeArgs: [], description: "" },
  { id: "eco-full", claudeArgs: [], description: "" },
];

describe("runSession abort (usage exhaustion)", () => {
  it("does not record the aborting cell and stops with reason 'aborted'", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "eco-abort-"));
    try {
      const ledger = new Ledger(dir);
      const plan = expandPlan(tasks, arms, 1);
      let calls = 0;
      const runOne = (t: BenchTask, a: BenchArm, rep: number): RunResult => {
        calls++;
        // First cell succeeds; second hits the usage limit.
        if (calls === 1) {
          return { taskId: t.id, armId: a.id, repetition: rep, passed: true, usage: usage(1) };
        }
        return { taskId: t.id, armId: a.id, repetition: rep, passed: false, usage: usage(0), error: "usage-exhausted" };
      };
      const outcome = runSession(plan, ledger, runOne, { overallBudgetUsd: 1000, sessionBudgetUsd: 1000 }, {
        shouldAbort: (r) => r.error === "usage-exhausted",
      });
      assert.equal(outcome.stop, "aborted");
      assert.equal(outcome.ran, 1); // only the first cell recorded
      assert.equal(ledger.all().length, 1);

      // A fresh session resumes: the un-recorded cell is retried (now succeeds), matrix completes.
      const ledger2 = new Ledger(dir);
      const runOk = (t: BenchTask, a: BenchArm, rep: number): RunResult => ({
        taskId: t.id, armId: a.id, repetition: rep, passed: true, usage: usage(1),
      });
      const outcome2 = runSession(plan, ledger2, runOk, { overallBudgetUsd: 1000, sessionBudgetUsd: 1000 });
      assert.equal(outcome2.stop, "complete");
      assert.equal(outcome2.skipped, 1); // the one previously recorded cell
      assert.equal(ledger2.all().length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("prepareWorkspace", () => {
  it("copies the source, skips build output, and applies a regression exactly once", () => {
    const src = mkdtempSync(path.join(tmpdir(), "eco-src-"));
    try {
      mkdirSync(path.join(src, "src"), { recursive: true });
      mkdirSync(path.join(src, "target"), { recursive: true });
      writeFileSync(path.join(src, "src", "A.java"), "var bytes = new byte[8];", "utf8");
      writeFileSync(path.join(src, "target", "built.class"), "stale", "utf8");

      const ws = prepareWorkspace({
        sourceDir: src,
        arm: { id: "vanilla", eco: false },
        regression: { file: "src/A.java", find: "new byte[8]", replace: "new byte[6]" },
      });
      try {
        assert.equal(readFileSync(path.join(ws, "src", "A.java"), "utf8"), "var bytes = new byte[6];");
        assert.equal(existsSync(path.join(ws, "target")), false); // build output excluded
      } finally {
        cleanupWorkspace(ws);
      }
    } finally {
      rmSync(src, { recursive: true, force: true });
    }
  });

  it("writes addFiles (creating parent dirs) into the workspace", () => {
    const src = mkdtempSync(path.join(tmpdir(), "eco-src-"));
    try {
      writeFileSync(path.join(src, "pom.xml"), "<project/>", "utf8");
      const ws = prepareWorkspace({
        sourceDir: src,
        arm: { id: "vanilla", eco: false },
        addFiles: [{ path: "src/test/java/FooTest.java", content: "class FooTest {}" }],
      });
      try {
        assert.equal(readFileSync(path.join(ws, "src/test/java/FooTest.java"), "utf8"), "class FooTest {}");
      } finally {
        cleanupWorkspace(ws);
      }
    } finally {
      rmSync(src, { recursive: true, force: true });
    }
  });

  it("throws when the regression target is absent or ambiguous", () => {
    const src = mkdtempSync(path.join(tmpdir(), "eco-src-"));
    try {
      writeFileSync(path.join(src, "A.java"), "x x", "utf8");
      assert.throws(
        () => prepareWorkspace({ sourceDir: src, arm: { id: "v", eco: false }, regression: { file: "A.java", find: "x", replace: "y" } }),
        /occurs 2 time/,
      );
    } finally {
      rmSync(src, { recursive: true, force: true });
    }
  });

  it("requires ecoCliPath for an eco arm", () => {
    const src = mkdtempSync(path.join(tmpdir(), "eco-src-"));
    try {
      writeFileSync(path.join(src, "A.java"), "x", "utf8");
      assert.throws(() => prepareWorkspace({ sourceDir: src, arm: { id: "eco", eco: true } }), /ecoCliPath/);
    } finally {
      rmSync(src, { recursive: true, force: true });
    }
  });
});
