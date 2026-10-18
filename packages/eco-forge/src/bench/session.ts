import type { Ledger } from "./ledger.js";
import { expandPlan } from "./plan.js";
import type { BenchPlan, Cell } from "./plan.js";
import type { BenchArm, BenchTask, RunResult } from "./types.js";

export interface SessionCaps {
  /** Hard stop once cumulative spend across ALL sessions reaches this (USD). */
  readonly overallBudgetUsd: number;
  /** Hard stop once THIS session's spend reaches this (USD). */
  readonly sessionBudgetUsd: number;
  /** Safety stop after this many runs in one session. */
  readonly maxRunsThisSession?: number;
}

export type RunOne = (task: BenchTask, arm: BenchArm, rep: number) => RunResult;

export type StopReason = "complete" | "overall-budget" | "session-budget" | "max-runs" | "aborted";

export interface SessionHooks {
  readonly onProgress?: (cell: Cell, result: RunResult, totalSpent: number) => void;
  /**
   * Returns true when a run's result is a transient environmental failure (e.g. the subscription
   * usage limit was hit) that must NOT be recorded — the cell stays pending so the next session
   * retries it after the limit resets. The run that triggered the abort is discarded.
   */
  readonly shouldAbort?: (result: RunResult) => boolean;
}

export interface SessionOutcome {
  readonly ran: number;
  readonly skipped: number;
  readonly sessionSpentUsd: number;
  readonly totalSpentUsd: number;
  readonly remaining: number;
  readonly stop: StopReason;
}

/**
 * Runs as many matrix cells as the budget allows, then stops cleanly — the next session resumes
 * from the ledger. Before each run it checks both caps; it never starts a run that could push
 * spend over a cap based on the average cost so far (so the ceiling is a guarantee, not a hope).
 */
export function runSession(
  plan: BenchPlan,
  ledger: Ledger,
  runOne: RunOne,
  caps: SessionCaps,
  hooksOrProgress?: SessionHooks | ((cell: Cell, result: RunResult, totalSpent: number) => void),
): SessionOutcome {
  const hooks: SessionHooks =
    typeof hooksOrProgress === "function" ? { onProgress: hooksOrProgress } : (hooksOrProgress ?? {});
  const taskById = new Map(plan.tasks.map((t) => [t.id, t]));
  const armById = new Map(plan.arms.map((a) => [a.id, a]));

  let ran = 0;
  const sessionStartSpent = ledger.spentUsd();

  const pending = plan.cells.filter((c) => !ledger.has(c.key));
  const skipped = plan.cells.length - pending.length;

  let stop: StopReason = "complete";
  for (const cell of pending) {
    const totalSpent = ledger.spentUsd();
    const sessionSpent = totalSpent - sessionStartSpent;
    // Estimate the next run from the running average (fall back to a conservative $2 before any data).
    const avg = ran > 0 ? sessionSpent / ran : estimateFromLedger(ledger);
    if (totalSpent + avg > caps.overallBudgetUsd) {
      stop = "overall-budget";
      break;
    }
    if (sessionSpent + avg > caps.sessionBudgetUsd) {
      stop = "session-budget";
      break;
    }
    if (caps.maxRunsThisSession !== undefined && ran >= caps.maxRunsThisSession) {
      stop = "max-runs";
      break;
    }

    const task = taskById.get(cell.taskId);
    const arm = armById.get(cell.armId);
    if (!task || !arm) {
      continue;
    }
    const result = runOne(task, arm, cell.rep);
    // A transient environmental failure (e.g. usage limit) is discarded, not recorded, so the
    // next session retries this exact cell once the limit resets.
    if (hooks.shouldAbort?.(result)) {
      stop = "aborted";
      break;
    }
    ledger.append(cell.key, result);
    ran++;
    hooks.onProgress?.(cell, result, ledger.spentUsd());
  }

  const totalSpent = ledger.spentUsd();
  return {
    ran,
    skipped,
    sessionSpentUsd: totalSpent - sessionStartSpent,
    totalSpentUsd: totalSpent,
    remaining: plan.cells.length - ledger.all().filter((e) => plan.cells.some((c) => c.key === e.key)).length,
    stop,
  };
}

/** A conservative pre-first-run estimate: the ledger's average, or $2 if the ledger is empty. */
function estimateFromLedger(ledger: Ledger): number {
  const all = ledger.all();
  if (all.length === 0) {
    return 2;
  }
  return ledger.spentUsd() / all.length;
}

export { expandPlan };
