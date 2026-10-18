# Token benchmark — multi-session runbook

The benchmark runs the **full matrix** (7 arms × tasks × reps) but is **resumable across sessions**
and **budget-capped**, so it can be executed in chunks and continued later without repeating work.

## Matrix (arms)

Two tiers of arm. Tier 1 is runnable here on the subscription today; Tier 2 needs the third-party
harness tools actually installed and toggled, which is Bedrock-environment work.

**Tier 1 — runnable now (`bench/arms.json`):**
- `vanilla` — baseline: plain Claude Code, no eco ecosystem installed, raw task prompt.
- `eco-full` — the full eco ecosystem installed via `eco-forge init` (CLAUDE.md, path rules, 17
  agents, commands, gates); the task is routed through `/eco-bugfix`.

This Tier-1 pair is the headline A/B: it measures the **net token cost/benefit of the eco
ecosystem itself** on a real bugfix with a deterministic pass/fail check.

**Tier 2 — leave-one-out of the token tools (deferred):**
- `eco-full−context-mode`, `eco-full−rtk`, `eco-full−caveman`, `eco-full−ponytail`, `eco-full−headroom`.
- These isolate each harness tool's contribution. They require the tool to be installed and made
  toggleable (`claudeArgs` flag or MCP on/off). `headroom` is a model-proxy and only measures
  correctly where the endpoint is reconfigurable — the Bedrock environment. Add these arms to
  `arms.json` and continue the **same ledger** so the report merges Tier 1 + Tier 2.

## How resume works
- Every completed cell `(arm|task|rep)` is appended to `<state-dir>/ledger.jsonl`.
- On start, the runner reads the ledger and **skips completed cells** — so re-running the command
  continues where it stopped. The ledger is the single source of truth; it survives session ends.
- Order is rep-major (one full balanced pass of all arms/tasks before a 2nd rep), so a partial run
  is still comparable.

## Budget caps (both enforced before each run)
- `--overall-budget <usd>` — hard ceiling across ALL sessions (e.g. 50). The run stops before any
  cell that could cross it, using the running average cost. This is the guarantee you never exceed $X.
- `--session-budget <usd>` — stop this session at this spend; next session continues.
- `--max-runs <n>` — optional safety stop per session.

## Per session
```
# session N (repeat each session; same --state dir continues the ledger)
eco-forge-bench run \
  --state .eco/bench \
  --tasks packages/eco-forge/bench/tasks.json \
  --arms  packages/eco-forge/bench/arms.json \
  --source golden-repo/backend \
  --reps 1
# optional caps (omit to leave the budget "outside" and run until the usage limit is hit):
#   --overall-budget 50   --session-budget 15   --max-runs 20
# prints, per cell: [arm|task|rep] PASS/FAIL cost=$.. turns=.. total=$..
# then: ran X, skipped Y, session spent $A, total spent $B, remaining Z, stop <reason>
```
Stop reasons: `complete` (matrix done), `session-budget`, `overall-budget`, `max-runs`,
`aborted` (usage limit hit — the in-flight cell is **not** recorded, so re-running the exact same
command after the ~5-hour reset retries it and continues).

Each run executes in a throwaway temp copy of `--source`, so arms never contaminate each other and
both arms start from byte-identical code. The eco arm additionally gets `eco-forge init` run into
its copy. Per-run claude output is saved under `<state>/logs/` for audit.

## Report (any time, partial or complete)
```
eco-forge-bench report --state .eco/bench > bench-report.md
```
Shows per-arm pass rate, median total tokens, **tokens per PASSING task**, and % vs vanilla — over
whatever cells are in the ledger so far, so you see progress between sessions.

## Plan the chunks against $50
- Pick `--overall-budget 50`. Each session set `--session-budget` to what you want to spend that
  sitting (e.g. 15). ~3–4 sessions complete the 6-arm matrix here; the headroom arm is added in the
  Bedrock run and merged into the same report.
