export interface BenchTask {
  readonly id: string;
  readonly prompt: string;
  /** Shell command that returns 0 when the task's output is correct (deterministic scoring). */
  readonly check?: string;
}

export interface BenchArm {
  readonly id: string;
  /** Extra CLI args passed to `claude -p` for this arm (e.g. disabling a feature for an ablation). */
  readonly claudeArgs: readonly string[];
  readonly description: string;
}

export interface RunUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly costUsd: number;
  readonly durationMs: number;
  readonly numTurns: number;
}

export interface RunResult {
  readonly taskId: string;
  readonly armId: string;
  readonly repetition: number;
  readonly passed: boolean;
  readonly usage: RunUsage;
  readonly error?: string;
}

export interface ArmSummary {
  readonly armId: string;
  readonly runs: number;
  readonly passRate: number;
  readonly medianTotalTokens: number;
  /** The headline metric: median total tokens over the runs that PASSED (0 if none passed). */
  readonly tokensPerPassingTask: number;
  readonly medianCostUsd: number;
}
