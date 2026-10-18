# eco-forge — Session State (compression anchor)

Branch: `claude/blissful-fermat-aidmmc` (all work committed & pushed). Date: 2026-10-18.
Repo: `pareshpatil8/claude_plugin_poc`. Attribution: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Go2FVB9JzwkmTHokfi325u`.

## What this is
`@yourorg/eco-forge` — an npm package that `init`s a Claude Code–based agentic delivery ecosystem for
Spring Boot 4 + Angular teams: deep specs → design → agent-written code (test-first) → quality/security
gates → GitLab/OpenShift delivery, with minimum tokens and proactive (shift-left) QA.

## Locked decisions
- Stack: Spring Boot 4.1.1 / Java 21 / Maven / Angular 22 / Oracle (H2 in AI env) / Kafka / in-house IdP.
- LLM: Bedrock **ap-south-1 only** in prod (India residency); **Claude subscription** for testing eco-forge.
- SCM/CI: self-managed GitLab **Free** + open-source scanners. Delivery: OpenShift GitOps (Argo CD) + Vault. Registry: Nexus.
- Gates: blocking + waivers (named approver, reason, expiry). Docs: repo markdown. Runtime: Claude Code native.
- Workstations: Windows + Linux behind proxy. Node baseline 22.22.3+ (Angular 22). Python 3.11+/uv.
- Tool selection from the 33-repo list recorded in docs/design/2026-10-18-eco-forge-tool-evaluation.md
  (defaults: context-mode, rtk hook-mode, caveman skill-only, code-review-graph, memsearch; challengers:
  Spec Kit/Trail/ponytail/headroom; later: ruflo/Graphiti/Cognee/KSoR/qm; excluded: goose/KiroCrew/pxpipe/
  graphify/claude-context/token-savior/last30days/gstack-as-is). "graft"=Trail, "kirodrew"=KiroCrew.

## Package layout (packages/eco-forge)
- TS workspace, Node's built-in test runner (node:test) — Vitest 4.1/5.0.3 crash npm's resolver, so avoided.
- No runtime deps, no install scripts; GitLab CI self-check (lint/test/pack/audit/gitleaks/semgrep).
- Binaries (dist/*): eco-forge (init/doctor), eco-forge-guard, eco-forge-gate, eco-forge-sca,
  eco-forge-trace, eco-forge-spec-lint, eco-forge-design-lint, eco-forge-perf.
- Profile: templates/springboot-angular/profile.json (56 managed files) — manifest at .eco/manifest.json.
- **170 tests, ~95% coverage, lint+typecheck clean.**

## Built & PROVEN here (all committed)
- CLI init (detection, strict render, manifest states create/update/unchanged/adopt/keep-modified/conflict/
  overwrite, dry-run, atomic, symlink-safe, idempotent) + doctor; provider lock (Bedrock India-only,
  cross-region model IDs rejected, subscription=synthetic-only).
- Guard hook: command normaliser unwraps sh -c/sudo/env/xargs/pipes/subst/escaped-alias; blocks secret
  reads, force-push, non-Dev oc/kubectl. PII guard (Aadhaar Verhoeff, PAN, phone, email, bulk). Red-team
  suite. **Blocking proven via installed binary (exit 2), not model refusal.**
- Spec pipeline: /eco:intake,clarify,spec,design,plan,uat,export (skills+commands). 6 clarify checklists.
- Proactive QA (shift-left): spec-lint (ambiguity/weak-NFR/untestable/missing-error-path/unclassified-PII/
  conflict/TBD) gate before design; design-lint (untraced req/orphan/op-missing-error/op-missing-auth/
  undocumented-decision) gate before build. trace-check (every REQ→test+UAT).
- Security gate chain on REAL output: Semgrep (custom OWASP/DPDP/upload rules) + SpotBugs+FindSecBugs + PMD
  + Trivy SCA. sarif reduce (new-only, baseline, dedupe) + waiver policy + severity elevation (FindSecBugs
  security rules → high/critical). **Proven: planted command-injection/predictable-RNG block; clean code passes.**
- SCA + reachability: eco-forge-sca triages upgrade / block-escalate / waive-unreachable / monitor; grep
  import-probe for reachability. **Proven on real Trivy: log4j 2.14.1 → all 7 CVEs incl Log4Shell, gate FAILS
  until upgraded; used dep (tika) reachable→block, unused transitive→waive.**
- Golden repo: Spring Boot 4 backend (service-request API, owner-only reads/no IDOR, no PII in responses/
  events, after-commit Kafka publish, OAuth2) + Angular 22 accessible form. **21 backend tests (Oracle Free +
  Kafka Testcontainers, singleton), 10 frontend (incl axe a11y w/ negative control).**
- Secure file-upload module (Tika magic-byte, allow-list, zip-bomb, pluggable scanner): 11 attack cases pass.
- DPDP: @Pii, retention/erasure job (Oracle), pii-check gate.
- Perf: nfr.md→k6 thresholds generator (eco-forge-perf). A11y: axe gate proven.
- Planted-defect catalogue: **catch rate 8/8** (measure.mjs). Mutation testing: NOT yet wired.
- Token bench harness: `eco-forge-bench run/report` CLI over `claude -p --output-format json`;
  throwaway workspace per cell (eco arms get `eco-forge init`), deterministic external check,
  resumable JSONL ledger, budget caps, usage-limit abort-without-record. **Full matrix RUN (real).**
- 17 AGENTS (tool allowlists, model tiers): delivery-planner (orchestrator/ring-master: decompose→order→
  route via Task tool→track status→manage deps; writes no app code), product-analyst, nfr-analyst,
  integration-analyst, privacy-reviewer, solution-architect, qa-uat-writer, backend-dev, frontend-dev,
  test-designer, code-reviewer, security-reviewer, deep-taint-reviewer, devops-engineer, perf-engineer,
  a11y-auditor, pentest-assistant. /eco:dev + /eco:bugfix workflow. Path-scoped rules (backend/frontend).

## Cost position (user has ~$50 API credit)
- Testing here = this session's allocation (not a metered key); est. at API rates: /eco:dev run ~$0.5–1.5.
- Full ablation matrix (~500 runs) = $300–700 → does NOT fit $50.
- SCOPED headline (vanilla vs eco-forge, 5 tasks×3 reps×2 arms = 30 runs) ≈ $30–45 → FITS.
- Prod per-feature on Bedrock: ~$6–12 with eco-forge techniques (est; benchmark will measure).

## BENCHMARK RESULTS (real runs, subscription/Sonnet, reps=5, 100% pass everywhere)
See `docs/plan/2026-10-18-bench-report.md`. Pooled median total tokens vs eco-full:
- vanilla −24.5% (baseline 17.7k) · eco-full 23.4k (governance tax +32% vs vanilla, shrinks with task size)
- eco-ctx (context-mode, output-compaction) **+27.6%** — HURTS small-output coding tasks
- eco-ponytail (write-min-code behaviour) **+4.8%** + fewer turns — near-neutral, aligned with workload
- eco-rtk (Bash-output compaction) — running; smoke showed 17 turns (heavy churn), expected to mirror context-mode
Conclusion: **gate each token tool by task profile.** ponytail = candidate default; context-mode/rtk =
situational (large-output work only), OFF for ordinary coding. Tools are benchmark arms, pinned installs
(context-mode npm; ponytail+rtk cloned/built), logged in teardown-register. caveman (skill, subagent→
orchestrator only) + headroom (Bedrock proxy) NOT runnable here → deferred/documented.

## Pending (not built)
- Mutation testing (PIT/Stryker) wired to gate. Full ablation matrix + OWASP Benchmark scorecard.
- Brownfield /eco:onboard. Lefthook pre-commit (Tier 1) + ArchUnit. Curated 3rd-party content import.
- Class-C (prod only, ship as config + acceptance kit): GitLab issue/MR flow, Nexus, OpenShift+ArgoCD+Vault,
  real IdP (authenticated DAST), DefectDojo+Dependency-Track, Bedrock wiring + confirmation benchmark.

## Env notes
- Docker daemon stops on session restart → `nohup dockerd &` then wait; pull via GHCR/ECR (Docker Hub rate-limited).
- Testcontainers: shared singletons (IntegrationTest base) to avoid cold-start races; TC_ORACLE_IMAGE=
  ghcr.io/gvenzl/oracle-free:23-slim-faststart. Node 22.23.3 in scratchpad for Angular.
- Trivy via container image + proxy CA (/root/.ccr/ca-bundle.crt, HTTPS_PROXY, SSL_CERT_FILE); removed after.
- Teardown register: docs/plan/teardown-register.md (light tools removed after tests).

## Commit history
```
  88b2ab8 docs: add components, prerequisites and coverage inventory (draft)
  c3d223f docs: evaluate 33 third-party tools and propose test-environment split
  dabc5ef docs: record test-environment and benchmark decisions
  fa15fa2 feat(eco-forge): scaffold package and CLI core (M1-01, M1-02)
  53568de feat(golden-repo): Spring Boot 4 + Angular 22 reference app (M2-01)
  5e31d36 docs(plan): record sprint 1 progress and decisions
  937ef01 feat(eco-forge): enforcing guard + PII hooks with red-team suite (M1-05, M1-06, M1-08)
  4a8277e feat(eco-forge): clarify checklists and token bench harness (M1-10, M1-17)
  efad955 feat(eco-forge): security gate chain — SARIF reduce, waiver policy, custom rules (M2-06, M2-08 core)
  72193a6 feat(golden-repo): secure file-upload + DPDP retention; shared test containers (M4-02, M4-03/04)
  8a83fa8 feat(eco-forge): spec pipeline commands + traceability gate (M1-12, M1-11)
  4a29cee feat(eco-forge): Java deep SAST via Maven + severity elevation (M2-06 Java)
  544b368 feat(eco-forge): SCA + reachability triage for Java, npm and images (M2-07)
  45b5ba2 test(golden-repo): planted-defect catalogue + catch-rate report (M2-02)
  9383a3e feat(eco-forge): proactive QA — spec-defect analyzer + QA model (M1-QA)
  aa90fa9 feat(eco-forge): design-defect linter — Layer 1 prevention (M1-QA2)
  06abf6a feat(eco-forge): performance + accessibility gates (M3-07, a11y)
  f795ca0 feat(eco-forge): build agents + /eco:dev and /eco:bugfix workflow (M2-09, M2-11)
  9c9684d feat(eco-forge): security + spec/product subagents complete the roster (M-agents2)
  2701708 feat(eco-forge): orchestrator + delivery/perf/a11y/pentest agents (M-agents3)
```
