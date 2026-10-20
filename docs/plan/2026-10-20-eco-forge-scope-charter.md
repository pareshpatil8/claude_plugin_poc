# eco-forge scope charter (the guardrail)

One page. It exists to stop scope-creep — the "keep adding a tool / a layer" drift that turns a
focused package into a runaway platform. Read it before adding anything.

## What eco-forge IS
> A thin, opinionated, **measured** configuration layer that wires **Claude Code + best-of-breed
> open-source** into a governed Spring Boot 4 / Angular delivery pipeline (GitLab → OpenShift,
> Bedrock ap-south-1, DPDP).

It ships: a config generator (`init`), deterministic gate *wrappers*, a guard hook, a governance
hook + ledger, a benchmark/eval harness, an acceptance kit, agents/commands/rules/skills, and the
templates that bind them. A few thousand lines of glue — nothing more.

## What eco-forge is NOT (and will never become)
- **Not an agent runtime / harness.** Claude Code is the runtime. We never reimplement sessions,
  tool execution, telemetry, or permissions — we configure and extend them.
- **Not an observability / memory / scanning / pentest / ticketing platform.** Those are adopted
  OSS (Langfuse, DefectDojo, Dependency-Track, Semgrep/Trivy/SpotBugs, OPA, Tekton Chains) or your
  infra (GitLab, OpenShift, Vault, IdP). We wire them; we do not rebuild them.
- **Not a team-deployment platform.** (That is what qm/similar are — evaluated separately, not built here.)
- **Not a home for a tool just because it exists.** Interesting ≠ in scope.

## The one rule for adding anything
**Adopt, don't build. Measure before default.** A new capability may enter only when:
1. It fills a gap the current stack genuinely doesn't cover (not "nice to have"), AND
2. The honest cheapest option is tried first in this order: **(a) Claude Code native → (b) an
   existing OSS tool we wire → (c) a thin eco-forge glue module**. Build (c) only when (a) and (b)
   can't do it. AND
3. It passes the 3-axis skill-evaluation method (static + `claude plugin eval` + benchmark) and does
   **not** lower pass rate or fail its token/cost budget. The measurement gates the default — nothing
   becomes "on by default" on a claim.

If it can't clear all three, it stays out (or stays a documented, off-by-default option).

## The north star that keeps us honest
**Minimum tokens, maximum output.** Every layer costs tokens, so every layer must earn them. This is
the original goal and the built-in anti-bloat test: when in doubt, the thing that adds tokens without
a measured return gets cut.

## Definition of "done" for v1 (then we stop adding and prove value)
1. Acceptance kit = READY in your pre-prod (Bedrock/residency, gates, scanners, Dev-only OpenShift).
2. Governance ledger + mutation-testing gate in place (quality & who-did-what provable).
3. **One real feature** driven end-to-end through `/eco:dev` on Bedrock passes all gates + human-
   approved review, and is demonstrably cheaper/safer than unaided. That is the proof eco-forge earns
   its existence — not the tool count.

## Everything else is "adopt-if-measured" post-v1
Governance backends depth, Strix/cognee/headroom, qm as a team layer, more token tools, SonarQube/ZAP
depth, brownfield onboard — each enters later only via the one rule above. Parked, not forgotten.
