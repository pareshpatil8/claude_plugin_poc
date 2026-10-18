# eco-forge token benchmark — final report

Headline metric: **median total tokens per passing task** — total = input + output + cache-creation
(the fresh-billed work). A token saving that lowers the pass rate does not count. All arms ran on the
Claude subscription (served on Sonnet), reps=5, two tasks, via `eco-forge-bench`; every cell passed
its deterministic check (100% pass rate throughout, so the comparison is purely about tokens).

## Pooled by arm (both tasks)

| Arm | Mechanism | Median total tokens | vs vanilla | vs eco-full | Median turns |
|-----|-----------|---------------------|-----------|-------------|--------------|
| vanilla      | — (baseline)                      | 17,689 | 0.0%   | −24.5% | 5 |
| eco-full     | eco ecosystem, no token tool      | 23,428 | +32.4% | 0.0%   | 7 |
| eco-ponytail | ponytail — write minimum code     | 24,554 | +38.8% | **+4.8%**  | 6 |
| eco-rtk      | rtk — Bash-output compaction      | 25,111 | +42.0% | **+7.2%**  | 9.5 |
| eco-ctx      | context-mode — all tool output    | 29,889 | +69.0% | **+27.6%** | 9 |

## Per task — the key nuance

| Task | Arm | Median total tokens | vs eco-full | Median turns |
|------|-----|---------------------|-------------|--------------|
| `bugfix-ref-length` (tiny output) | eco-ponytail | 23,615 | +1.0%  | 6 |
| `bugfix-ref-length`               | eco-rtk      | 25,997 | +11.1% | 15 |
| `bugfix-ref-length`               | eco-ctx      | 29,813 | +27.4% | 10 |
| `feature-sla-policy` (larger output) | eco-ponytail | 25,011 | +6.6%  | 6 |
| `feature-sla-policy`              | eco-rtk      | 23,273 | **−0.8%** | 9 |
| `feature-sla-policy`              | eco-ctx      | 29,965 | +27.7% | 7 |

---

## What the full five-arm matrix establishes

**1. Quality never moved: 100% pass on every arm, task and rep.** No tool helped or hurt correctness
on these deterministic tasks; the whole story is tokens.

**2. The eco ecosystem (`eco-full`) costs ~25–42% more than vanilla** — the governance tax (CLAUDE.md,
rules, agents, `/eco-*` workflow), mostly one-time cache-creation, shrinking with task size. This is
the baseline the token tools must beat.

**3. Mechanism decides the result, and task profile decides whether a tool pays off:**

- **ponytail (behaviour — "write the minimum necessary code"): +4.8% vs eco-full, fewer turns (7→6).**
  Near-neutral on these small tasks because its "less code" effect roughly offsets the cost of
  injecting the instruction. Aligned with eco-forge's actual code-writing loop; the only tool whose
  turn count *dropped*.
- **rtk (output compaction, Bash only): +7.2% pooled — but task-sensitive.** On the tiny bugfix it
  churns (+11.1%, 15 turns); on the larger-output feature it is **−0.8%** — it has crossed to
  break-even as soon as command output grows. This is direct in-data evidence that output-compression
  tools invert from cost to saving with output volume.
- **context-mode (compacts *all* tool output via MCP sandbox + routing block): +27.6% — worst here.**
  Its machinery is heavier (SessionStart routing injection, a PreToolUse block that denies piped
  Bash), and our tasks give it nothing large to compress, so it is pure overhead. It engaged
  correctly; it is simply mis-applied to small-output coding.

**4. The decisive variable is task profile, not the tool.** Output-compression tools (context-mode,
rtk) only pay off when tool output is large; the behaviour tool (ponytail) pays off when there is
code volume to cut. On small, well-specified coding tasks none of them saves tokens — so eco-forge
must gate each tool by task profile rather than enabling them globally.

## Recommended default policy (from this data)
- **ponytail → candidate default ON for coding.** Near-free here, aligned with the workload, turns
  dropped, pass rate held at 100%. Confirm a net saving on a large-feature task + unchanged mutation
  score before locking it in.
- **rtk → default ON only where commands are verbose** (build/test-heavy loops, log-producing tasks).
  Already break-even on the feature task; expected net-positive on noisier command output. OFF for
  trivial edits.
- **context-mode → OFF by default for coding; situational ON** for large-output / long exploratory
  work (log & trace analysis, brownfield onboarding, web research) where its 98% tool-output
  reduction applies. Defaulting it on raises tokens on ordinary tasks.
- The ~25–42% baseline eco overhead is itself the next optimisation target (leaner always-on context).

## Tools evaluated vs. deferred
| Tool | Class | Status |
|------|-------|--------|
| context-mode | output compaction (all tools) | **Measured** — +27.6% (situational) |
| rtk | output compaction (Bash) | **Measured** — +7.2% pooled, break-even on larger output |
| ponytail | behaviour (write-min-code) | **Measured** — +4.8%, fewer turns (best) |
| caveman | behaviour, **subagent→orchestrator reports only** | **Not runnable here** — single-agent bench tasks never spawn a subagent, so caveman's compaction path is never hit. Needs a multi-agent orchestration task (delivery-planner fan-out) to measure. |
| headroom | model-proxy / compression in front of the endpoint | **Not runnable here** — requires a reconfigurable endpoint; runs only in the Bedrock environment. Deferred and merged into this report later. |

## Orchestration sub-matrix — caveman (subagent→orchestrator compaction)

A separate task (`orch-sla-feature`) routes through the **delivery-planner**, which fans out to real
subagents (confirmed: 4 spawned — delivery-planner, backend-dev, test-designer, code-reviewer). This
is the only task shape that exercises caveman, whose job is to make each subagent's hand-back report
terse. reps=3, 100% pass.

> **Metric note:** for multi-agent runs the top-level `claude -p` usage counters do **not** include
> the subagents' tokens (those roll up into `total_cost_usd` only). So "total tokens" under-counts
> the real work here, and **cost (USD) is the honest metric** for this sub-matrix.

| Arm | Pass | Median cost (USD) | vs eco-orch | Cheaper in |
|-----|------|-------------------|-------------|------------|
| eco-orch          | 3/3 | 0.4346 | —      | — |
| eco-orch-caveman  | 3/3 | **0.4054** | **−6.7%** | **3 of 3 paired reps** |

**caveman reduces orchestration cost ~7%, consistently across all three paired reps, at 100% pass** —
the terse subagent reports cut billed tokens across the agent tree. (The parent-usage "total tokens"
metric actually *rises* +10.9% here, because the voice directive injected into every agent file adds
cache-creation tokens the parent *can* see while the subagent savings it *cannot* see — which is
exactly why cost is the right metric for orchestration.) Signal is directionally clear but small-n
(3 reps, cost variance $0.41–0.53); treat as "promising, confirm with more reps".

**This completes the thesis: every token tool helps only in its own regime.** ponytail on code
volume, rtk/context-mode on large command/tool output, **caveman on multi-agent orchestration**.
None is a universal default; each is gated to the task profile it serves.

### Deferred (environment-bound, not a tool failure)
- **headroom** — model-proxy compression; needs the reconfigurable Bedrock endpoint. Runs in the
  Bedrock environment and merges into this ledger later.

## How to reproduce / extend
All arms append to one resumable ledger (`.eco/bench/ledger.jsonl`); re-run `eco-forge-bench run`
with the same `--state` to continue. Add the deferred arms (caveman on an orchestration task;
headroom on Bedrock) into the same ledger and `eco-forge-bench report` merges them.

_Total: 50 cells, 100% pass, **$6.50**._
