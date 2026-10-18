# eco-forge token benchmark

Headline metric: **median total tokens per passing task** — total = input + output + cache-creation
(the fresh-billed work). A token saving that lowers the pass rate does not count.

## Pooled by arm (reps=5, both tasks, subscription / Sonnet)

| Arm | Mechanism | Pass rate | Median total tokens | vs vanilla | vs eco-full | Median turns |
|-----|-----------|-----------|---------------------|-----------|-------------|--------------|
| vanilla      | — (baseline)                | 100% | 17,689 | 0.0%   | −24.5% | 5 |
| eco-full     | eco ecosystem, no token tool| 100% | 23,428 | +32.4% | 0.0%   | 7 |
| eco-ctx      | context-mode (output compaction) | 100% | 29,889 | +69.0% | +27.6% | 9 |
| eco-ponytail | ponytail (write minimum code)    | 100% | 24,554 | +38.8% | +4.8%  | 6 |

## Per task

| Task | Arm | Pass | Median total tokens | vs eco-full | Median turns |
|------|-----|------|---------------------|-------------|--------------|
| `bugfix-ref-length` | vanilla | 5/5 | 16,485 | −29.5% | 4 |
| `bugfix-ref-length` | eco-full | 5/5 | 23,392 | — | 7 |
| `bugfix-ref-length` | eco-ctx | 5/5 | 29,813 | +27.4% | 10 |
| `bugfix-ref-length` | eco-ponytail | 5/5 | 23,615 | +1.0% | 6 |
| `feature-sla-policy` | vanilla | 5/5 | 18,852 | −19.7% | 7 |
| `feature-sla-policy` | eco-full | 5/5 | 23,463 | — | 7 |
| `feature-sla-policy` | eco-ctx | 5/5 | 29,965 | +27.7% | 7 |
| `feature-sla-policy` | eco-ponytail | 5/5 | 25,011 | +6.6% | 6 |

---

## What the four arms establish

**Quality is equal: 100% pass on every arm, task and rep.** The comparison is purely about tokens.

**1. The eco ecosystem (`eco-full`) costs ~25–42% more than vanilla** — the governance tax (CLAUDE.md,
rules, agents, the `/eco-*` workflow), mostly one-time cache-creation, shrinking with task size.

**2. The two Tier-2 token tools behave oppositely on this workload — mechanism matters:**

- **context-mode (output compaction): +27.6% vs eco-full — it HURTS here.** It saves tokens by keeping
  *large* raw tool output out of context; our tasks produce tiny output (one file read, a short
  Maven run), so its routing machinery (SessionStart injection + a PreToolUse routing-block that
  denies piped Bash) is pure overhead and adds turns (7 → 9). It engaged correctly; it simply has
  nothing to compress on this task shape.
- **ponytail (write-minimum-code behaviour): +4.8% vs eco-full and FEWER turns (7 → 6) — near-neutral.**
  Its "smallest complete change / reuse ladder" instruction makes the model more decisive and write
  less, which roughly offsets the cost of injecting that instruction. On bigger features (more code
  to minimise) it should cross into a net saving.

**3. The deciding variable is task profile, not the tool label.** An output-compression tool only
pays off when tool output is large; a behaviour tool pays off when there is code volume to cut. On
small, well-specified coding tasks neither saves tokens — which is why eco-forge must gate each tool
by task profile rather than enabling them globally.

## Recommended default policy (from this data)
- **ponytail → candidate default.** Near-free on small tasks, aligned with eco-forge's code-writing
  loop, and its gate pass rate held at 100%. Promote once a larger-feature task confirms a net saving
  and the mutation score doesn't drop.
- **context-mode → situational, OFF by default for coding.** Enable only for large-output / long
  exploratory work (log/trace analysis, brownfield onboarding, web research), where its 98%
  tool-output reduction applies. Defaulting it on would raise tokens on ordinary tasks.
- **rtk → same class as context-mode;** expected to mirror it on these tasks (see arms status).
- The baseline eco overhead itself is the next optimisation target (leaner always-on context).

## Arms status
- `vanilla`, `eco-full`, `eco-ctx` (context-mode), `eco-ponytail` — **done** (reps=5, both tasks, 100% pass).
- `eco-rtk` (shell-output compression, Rust binary) — integrating; completes the output-compression class.
- `caveman` — skill only; acts on subagent→orchestrator reports, which single-agent tasks cannot
  exercise. Install + document; measure once an orchestration task exists.
- `headroom` — Bedrock compression proxy; runs only where the endpoint is reconfigurable → deferred
  to the Bedrock environment, merged into this report later.

_Matrix cost so far: $5.03 total (40 cells, all passing)._
