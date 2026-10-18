# eco-forge token benchmark

Headline metric: **median total tokens per passing task** — total = input + output + cache-creation
(the fresh-billed work). A token saving that lowers the pass rate does not count.

## Results — per task (reps=5, subscription / Sonnet)

| Task | Arm | Pass | Median total tokens | vs vanilla | vs eco-full | Median turns | Median cost |
|------|-----|------|---------------------|-----------|-------------|--------------|-------------|
| `bugfix-ref-length` | vanilla  | 5/5 | 16,485 | —      | −29.5% | 4 | $0.0850 |
| `bugfix-ref-length` | eco-full | 5/5 | 23,392 | +41.9% | —      | 7 | $0.1210 |
| `bugfix-ref-length` | eco-ctx  | 5/5 | 29,813 | +80.8% | +27.4% | 10 | $0.1624 |
| `feature-sla-policy` | vanilla  | 5/5 | 18,852 | —      | −19.7% | 7 | $0.0981 |
| `feature-sla-policy` | eco-full | 5/5 | 23,463 | +24.5% | —      | 7 | $0.1183 |
| `feature-sla-policy` | eco-ctx  | 5/5 | 29,965 | +58.9% | +27.7% | 7 | $0.1567 |

## Pooled by arm (both tasks)

| Arm | Pass rate | Median total tokens | vs vanilla | vs eco-full |
|-----|-----------|---------------------|-----------|-------------|
| vanilla  | 100% | 17,689 | 0.0%   | −24.5% |
| eco-full | 100% | 23,428 | +32.4% | 0.0%   |
| eco-ctx  | 100% | 29,889 | +69.0% | +27.6% |

---

## What these runs establish

**1. Quality is equal: 100% pass on every arm, task and rep.** No correctness gap to measure on these
deterministic tasks — the comparison is purely about tokens.

**2. The eco ecosystem (`eco-full`) costs ~25–42% more tokens than vanilla**, shrinking with task size
(bugfix +42% → feature +24%), most of it one-time cache-creation. This is the governance tax; the
net saving must come from the Tier-2 token tools.

**3. context-mode (the first Tier-2 tool) makes these tasks *worse*, not better: +27.6% vs eco-full.**
This is the important, honest finding — and it is exactly what the tool's own design predicts:

- context-mode saves tokens by keeping *large* raw tool output (50 KB logs, API snapshots) out of
  the context window, routing it through a sandbox + FTS5 index.
- Our golden tasks produce *tiny* tool output — one file read, a short offline Maven run. There is
  nothing large to compress. So context-mode's machinery (SessionStart routing injection, a
  PreToolUse routing-block that denies piped Bash and pushes the model toward `ctx_*` tools) is
  **pure overhead**: it adds context and extra turns (bugfix 7 → 10 turns) for no payoff.
- The tool engaged correctly (its hooks fired, its routing-block intercepted the model's piped
  `./mvnw`); it simply has nothing to do on this task shape.

**The engineering conclusion: a tool-output-compression tool must be gated by task profile.** Making
context-mode a blanket default would *raise* token use on ordinary small-output coding tasks. It
belongs on large-output / long-session work. This is a concrete default-policy decision the
benchmark just earned.

## Why the next task matters
These two tasks are the wrong shape to show any output-compression tool (context-mode, and next
`rtk`) in a good light. To evaluate that whole tool class fairly, the matrix needs a
**large-tool-output task** — a bug whose diagnosis forces reading/grepping a lot and running
verbose commands. Only then can we see whether context-mode/rtk invert from +28% to a real saving.
That task is being added next; the leave-one-out arms then run against it too.

## Arms status
- `vanilla`, `eco-full`, `eco-ctx` (context-mode) — **done** (reps=5, both tasks).
- `eco-rtk` (shell-output compression) — next; rtk-ai/rtk release binary, hook mode.
- `eco-ponytail` ("write minimum code") — installable here; a behaviour-change arm.
- `caveman` — skill only, acts on subagent→orchestrator reports; this single-agent task shape can't
  exercise it (install + note, measure once an orchestration task exists).
- `headroom` — Bedrock compression proxy; runs only where the endpoint is reconfigurable → deferred
  to the Bedrock environment, merged into this report later.

_Matrix cost so far: $3.80 total across three sessions (30 cells, all passing)._
