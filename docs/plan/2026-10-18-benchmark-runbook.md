# Token benchmark — multi-session runbook

The benchmark runs the **full matrix** (7 arms × tasks × reps) but is **resumable across sessions**
and **budget-capped**, so it can be executed in chunks and continued later without repeating work.

## Matrix (arms)
- `vanilla` — baseline, no eco token tools
- `eco-full` — all token tools on (context-mode + rtk + caveman + ponytail + headroom)
- `eco-full−context-mode`, `eco-full−rtk`, `eco-full−caveman`, `eco-full−ponytail`, `eco-full−headroom`
  (leave-one-out isolates each tool's contribution)

> headroom is a model-proxy and only measures correctly where the endpoint is reconfigurable — run
> that arm in the Bedrock environment. On the subscription here, run the other six arms.

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
  --overall-budget 50 \
  --session-budget 15 \
  --tasks bench/tasks.json --arms bench/arms.json
# prints: ran X, skipped Y, session spent $A, total spent $B, remaining Z, stop <reason>
```
Stop reasons: `complete` (matrix done), `session-budget`, `overall-budget`, `max-runs`.

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
