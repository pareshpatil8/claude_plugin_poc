import type { BenchArm, BenchTask } from "./types.js";

/** A single unit of work in the matrix: one (task, arm, repetition) cell. */
export interface Cell {
  readonly key: string; // stable id "arm|task|rep" — the ledger/resume key
  readonly taskId: string;
  readonly armId: string;
  readonly rep: number;
}

export interface BenchPlan {
  readonly tasks: readonly BenchTask[];
  readonly arms: readonly BenchArm[];
  readonly repetitions: number;
  readonly cells: readonly Cell[];
}

/**
 * Expands the full matrix into ordered cells. Order is rep-major then arm then task, so a stopped
 * run has at least one full pass of every arm/task before a second repetition — a partial result is
 * still balanced and comparable rather than skewed to whichever arm ran first.
 */
export function expandPlan(tasks: readonly BenchTask[], arms: readonly BenchArm[], repetitions: number): BenchPlan {
  const cells: Cell[] = [];
  for (let rep = 1; rep <= repetitions; rep++) {
    for (const arm of arms) {
      for (const task of tasks) {
        cells.push({ key: `${arm.id}|${task.id}|${rep}`, taskId: task.id, armId: arm.id, rep });
      }
    }
  }
  return { tasks, arms, repetitions, cells };
}
