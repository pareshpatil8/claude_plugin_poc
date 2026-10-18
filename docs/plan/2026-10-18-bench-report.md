# eco-forge token benchmark

Headline metric: **median total tokens per passing task** — total = input + output + cache-creation
(the fresh-billed work). A token saving that lowers the pass rate does not count.

## Results — pooled by arm (reps=5, both tasks, subscription / Sonnet)

| Arm | Runs | Pass rate | Median total tokens | Tokens/passing task | vs baseline | Median cost (USD) |
|-----|------|-----------|---------------------|---------------------|-------------|-------------------|
| vanilla  | 10 | 100% | 17,688 | 17,688 | 0.0%   | 0.0933 |
| eco-full | 10 | 100% | 23,427 | 23,427 | +32.4% | 0.1189 |

## Results — per task

| Task | Arm | Pass | Median total tokens | eco vs vanilla | Median turns |
|------|-----|------|---------------------|----------------|--------------|
| `bugfix-ref-length` (one-line fix) | vanilla  | 5/5 | 16,485 | —      | 4 |
| `bugfix-ref-length`                | eco-full | 5/5 | 23,392 | +41.9% | 7 |
| `feature-sla-policy` (test-first feature) | vanilla  | 5/5 | 18,852 | —      | 7 |
| `feature-sla-policy`               | eco-full | 5/5 | 23,463 | +24.5% | 7 |

---

## What these two sessions establish

**1. Quality is equal and perfect on both arms: 100% pass, every task, every rep.** Both vanilla and
the eco ecosystem always produce code that passes the deterministic check. On tasks this
well-specified there is no *correctness* gap to measure — so the comparison here is purely about
tokens, and the ecosystem's real value (governance, traceability, defect prevention) is not what a
green/red check can capture.

**2. The ecosystem currently costs MORE tokens, not fewer — and that is expected.** `eco-full` is the
ecosystem's *discipline* (CLAUDE.md + path rules + agents + the `/eco-*` workflow). It has no
token-*saving* component installed yet. So it can only add tokens relative to vanilla; the question
is how much, and whether it amortises.

**3. The overhead is modest and shrinks — the alarming first number was a cold-cache artifact.**
- Session 1 (cold cache, 1 rep): eco measured **+177%**. That was the first eco run paying the
  one-time cache-creation cost of loading the entire ecosystem.
- Session 2 (warm cache, median of 5 reps): **+32% pooled**, and lower on the bigger task.
- The steady-state overhead is **~25–42%**, not 177%. Most of the ecosystem's context is paid once
  and then read from cache.

**4. Overhead falls as the task grows.** Bugfix (+41.9%) → feature (+24.5%). The ecosystem's cost is
largely fixed per session; the more real work a task contains, the smaller a fraction that fixed
cost becomes. This is the amortisation the design predicted, visible across just two task sizes.

## The honest bottom line
On deterministic, well-specified tasks and with **no token-saving tools installed**, the eco
ecosystem adds ~25–42% tokens for equal pass rates — the price of its governance discipline, and it
shrinks with task size and caching. The *net saving* the project targets depends entirely on the
**Tier-2 harness tools** (context-mode, rtk, caveman, ponytail, headroom), whose job is to claw back
more than this overhead on large, ambiguous, multi-file work. This benchmark is now the trustworthy
baseline they must beat.

## Next measurements
1. **Install and wire the Tier-2 token tools**, then run the leave-one-out arms into this same ledger
   — each tool's contribution shows as its delta vs `eco-full`.
2. **Add a large, genuinely ambiguous task** (multi-file, underspecified) where vanilla wastes tokens
   re-exploring and the scaffolding's structure can invert the sign.
3. **Headroom arm on Bedrock** (reconfigurable endpoint), merged into this report.

_Matrix cost so far: $2.21 total across both sessions (20 cells, all passing)._
