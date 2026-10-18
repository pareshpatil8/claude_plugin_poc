# eco-forge token benchmark

Headline metric: **median total tokens per passing task** (a saving that lowers the pass rate does not count).

| Arm | Runs | Pass rate | Median total tokens | Tokens/passing task | vs baseline | Median cost (USD) |
|-----|------|-----------|---------------------|---------------------|-------------|-------------------|
| vanilla | 1 | 100% | 17690 | 17690 | 0.0% | 0.0949 |
| eco-full | 1 | 100% | 49089 | 49089 | 177.5% | 0.2228 |

Baseline: `vanilla`. Negative "vs baseline" means fewer tokens than vanilla.

---

## Session 1 — what this run is, and what it is not

**Run:** 2026-10-18, subscription provider, Tier-1 arms only, `reps=1`, one task
(`bugfix-ref-length`). Both arms **passed** the deterministic check
(`ServiceRequestServiceTest` green). Session cost **$0.32** total. The nested model served
these runs on Sonnet.

**What it measures:** the *net* token cost of installing the full eco ecosystem (CLAUDE.md +
path rules + 17 agents + routing the task through `/eco-bugfix`) on a **single, trivial,
one-line bugfix** — with the token-*saving* harness tools **not yet installed**.

**The honest reading of +177%:**
- A one-line fix is the **worst case** for scaffolding overhead: the ecosystem loads its context
  (rules, workflow, gate discipline) and routes through a structured bugfix workflow, but the task
  is far too small to amortise that. `eco-full` spent its extra tokens reading `CLAUDE.md`, the
  `/eco-bugfix` command, and doing the test-first / verify discipline (8 turns vs 5).
- This is **not** a verdict that eco-forge wastes tokens. The savings thesis rests on two things
  this run deliberately excludes:
  1. **The harness token tools** (context-mode, rtk, caveman, ponytail, headroom) — the Tier-2
     leave-one-out arms. They are the components whose *job* is to cut tokens; none are installed
     yet. This run is the **baseline overhead** they must beat.
  2. **Task size and ambiguity.** Scaffolding pays off by preventing wasted exploration on large,
     underspecified, multi-file work (where vanilla flails and re-reads). A deterministic one-liner
     gives it nothing to prevent.

**What this run *does* prove:** the end-to-end benchmark is real and trustworthy — fresh isolated
workspace per cell, `eco-forge init` into the eco arm, a real `claude -p` fix, a deterministic
RED→GREEN check, usage + cost parsed from the model's own JSON, resumable ledger. The pipeline is
ready to measure the tools that actually save tokens.

## Next measurements (to make the comparison fair and conclusive)
1. **Raise `reps`** (≥5) so the median is stable, not a single sample.
2. **Add larger, ambiguous tasks** — a multi-file feature via `/eco-dev` with a pre-written failing
   test, and a vaguer bug report — where scaffolding can actually earn its keep.
3. **Install and wire the Tier-2 token tools**, then run the leave-one-out arms into this same
   ledger so the report shows each tool's contribution vs `eco-full`.
4. **Headroom arm on Bedrock** (reconfigurable endpoint), merged into the same report.
