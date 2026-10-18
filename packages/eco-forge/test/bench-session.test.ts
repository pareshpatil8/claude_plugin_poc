import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Ledger } from "../src/bench/ledger.js";
import { expandPlan } from "../src/bench/plan.js";
import { runSession } from "../src/bench/session.js";
import type { BenchArm, BenchTask, RunResult } from "../src/bench/types.js";

const tasks: BenchTask[] = [{ id: "t1", prompt: "a" }, { id: "t2", prompt: "b" }];
const arms: BenchArm[] = [{ id: "vanilla", claudeArgs: [], description: "" }, { id: "eco", claudeArgs: [], description: "" }];
const tmp = () => mkdtempSync(path.join(tmpdir(), "eco-bench-"));

const result = (cost: number, passed = true): RunResult => ({
  taskId: "t", armId: "a", repetition: 1, passed,
  usage: { inputTokens: 10, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: cost, durationMs: 1, numTurns: 1 },
});

describe("expandPlan", () => {
  it("produces arm×task×rep cells, rep-major", () => {
    const plan = expandPlan(tasks, arms, 2);
    assert.equal(plan.cells.length, 8); // 2 tasks × 2 arms × 2 reps
    assert.equal(plan.cells[0]?.rep, 1);
    assert.equal(plan.cells.at(-1)?.rep, 2);
    assert.equal(new Set(plan.cells.map((c) => c.key)).size, 8); // all keys unique
  });
});

describe("runSession resume + caps", () => {
  it("runs the whole matrix when budget allows", () => {
    const plan = expandPlan(tasks, arms, 1);
    const ledger = new Ledger(tmp());
    const out = runSession(plan, ledger, () => result(0.1), { overallBudgetUsd: 100, sessionBudgetUsd: 100 });
    assert.equal(out.ran, 4);
    assert.equal(out.stop, "complete");
    assert.equal(out.remaining, 0);
  });

  it("stops at the session budget and resumes next session from the ledger", () => {
    const dir = tmp();
    const plan = expandPlan(tasks, arms, 2); // 8 cells
    // Session 1: ~$1/run, session cap $3 -> runs ~3 then stops.
    const s1 = runSession(plan, new Ledger(dir), () => result(1), { overallBudgetUsd: 100, sessionBudgetUsd: 3 });
    assert.equal(s1.stop, "session-budget");
    assert.ok(s1.ran >= 2 && s1.ran <= 3, `ran ${s1.ran}`);
    // Session 2: fresh Ledger on same dir re-reads completed cells and continues.
    const ledger2 = new Ledger(dir);
    assert.equal(ledger2.all().length, s1.ran);
    const s2 = runSession(plan, ledger2, () => result(1), { overallBudgetUsd: 100, sessionBudgetUsd: 100 });
    assert.equal(s2.skipped, s1.ran); // already-done cells skipped
    assert.equal(s2.ran + s1.ran, 8);
    assert.equal(s2.remaining, 0);
    assert.equal(s2.stop, "complete");
  });

  it("never exceeds the overall budget across sessions", () => {
    const dir = tmp();
    const plan = expandPlan(tasks, arms, 3); // 12 cells @ $1 = $12 if unrun
    let spent = 0;
    for (let i = 0; i < 5; i++) {
      const out = runSession(plan, new Ledger(dir), () => result(1), { overallBudgetUsd: 5, sessionBudgetUsd: 100 });
      spent = out.totalSpentUsd;
      if (out.stop === "complete") break;
    }
    assert.ok(spent <= 5, `spent ${spent} must not exceed overall budget 5`);
  });

  it("honours maxRunsThisSession", () => {
    const plan = expandPlan(tasks, arms, 2);
    const out = runSession(plan, new Ledger(tmp()), () => result(0.01), { overallBudgetUsd: 100, sessionBudgetUsd: 100, maxRunsThisSession: 2 });
    assert.equal(out.ran, 2);
    assert.equal(out.stop, "max-runs");
  });
});
