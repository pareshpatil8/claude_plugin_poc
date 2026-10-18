import type { ArmSummary, RunResult, RunUsage } from "./types.js";

/** Parses the JSON that `claude -p --output-format json` prints. Tolerant of missing fields. */
export function parseUsage(stdout: string): RunUsage {
  const parsed = JSON.parse(stdout) as {
    total_cost_usd?: number;
    duration_ms?: number;
    num_turns?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  const u = parsed.usage ?? {};
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    costUsd: parsed.total_cost_usd ?? 0,
    durationMs: parsed.duration_ms ?? 0,
    numTurns: parsed.num_turns ?? 0,
  };
}

/** Total non-cached input + output: the tokens actually billed as fresh work. */
export function totalTokens(u: RunUsage): number {
  return u.inputTokens + u.outputTokens + u.cacheCreationTokens;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

export function summarise(results: readonly RunResult[]): ArmSummary[] {
  const byArm = new Map<string, RunResult[]>();
  for (const r of results) {
    const list = byArm.get(r.armId) ?? [];
    list.push(r);
    byArm.set(r.armId, list);
  }
  return [...byArm.entries()].map(([armId, runs]) => {
    const passed = runs.filter((r) => r.passed);
    return {
      armId,
      runs: runs.length,
      passRate: runs.length === 0 ? 0 : passed.length / runs.length,
      medianTotalTokens: median(runs.map((r) => totalTokens(r.usage))),
      tokensPerPassingTask: median(passed.map((r) => totalTokens(r.usage))),
      medianCostUsd: median(runs.map((r) => r.usage.costUsd)),
    };
  });
}

export function formatReport(summaries: readonly ArmSummary[], baselineId: string): string {
  const base = summaries.find((s) => s.armId === baselineId);
  const lines = [
    "# eco-forge token benchmark",
    "",
    "Headline metric: **median total tokens per passing task** (a saving that lowers the pass rate does not count).",
    "",
    "| Arm | Runs | Pass rate | Median total tokens | Tokens/passing task | vs baseline | Median cost (USD) |",
    "|-----|------|-----------|---------------------|---------------------|-------------|-------------------|",
  ];
  for (const s of summaries) {
    const delta =
      base && base.tokensPerPassingTask > 0 && s.tokensPerPassingTask > 0
        ? `${(((s.tokensPerPassingTask - base.tokensPerPassingTask) / base.tokensPerPassingTask) * 100).toFixed(1)}%`
        : "—";
    lines.push(
      `| ${s.armId} | ${s.runs} | ${(s.passRate * 100).toFixed(0)}% | ${s.medianTotalTokens} | ${s.tokensPerPassingTask} | ${delta} | ${s.medianCostUsd.toFixed(4)} |`,
    );
  }
  lines.push("", `Baseline: \`${baselineId}\`. Negative "vs baseline" means fewer tokens than vanilla.`);
  return lines.join("\n");
}
