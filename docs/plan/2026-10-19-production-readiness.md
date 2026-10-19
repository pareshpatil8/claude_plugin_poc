# eco-forge — production-readiness status & roadmap

Honest status of what is tested vs pending, and what "ready for production" means. Dates are effort
estimates contingent on **your** infra being available for the pre-prod acceptance run — not fixed
calendar promises.

## Legend
Tested-here = proven in this AI container on the golden repo/fixtures · Pre-prod = verified by the
acceptance kit in your environment · Prod-only = ships as config + acceptance check, run in your env.

## A. Completed (tested here)
| Area | Item | Status |
|------|------|--------|
| Package | `@yourorg/eco-forge` CLI (`init`/`doctor`), 10 bins, 186 tests, lint+typecheck clean | ✅ |
| Spec pipeline | intake→spec→design→plan→uat→export commands; trace-check (REQ-ID) | ✅ |
| Proactive QA | spec-lint + design-lint (defects caught before code) | ✅ |
| Gates | SARIF reduce/policy/severity-elevate; waivers | ✅ |
| SAST | Semgrep CE + custom rules; SpotBugs+FindSecBugs; PMD — proven on planted defects | ✅ |
| SCA | Trivy + reachability triage (Log4Shell blocked, unreachable waived) | ✅ |
| Secret scan | gitleaks in CI | ✅ |
| Secure upload | Tika module, 11 attack-case tests | ✅ |
| DPDP | @Pii, retention/erasure job, pii-in-logs gate | ✅ |
| Perf / a11y | k6 threshold generator; axe gate | ✅ |
| Agents | 17-agent roster incl. delivery-planner orchestrator; /eco:dev + /eco:bugfix | ✅ |
| Guard | deny-rules + PII hook + command normaliser; red-team suite | ✅ |
| Catch rate | planted-defect catch-rate 8/8 | ✅ |
| Token tools | ponytail / rtk / context-mode / caveman benchmarked; per-tool default policy set | ✅ |
| Security skill | **Cloudflare security-audit skill piloted 5/5, 0 FP, $0.22** | ✅ |
| Acceptance kit | `eco-forge-acceptance` self-documenting pre-prod suite | ✅ |

## B. Pending — needs YOUR environment (acceptance kit verifies)
| Area | Item | Where | Effort |
|------|------|-------|--------|
| Provider | Bedrock ap-south-1 wiring + in-region model IDs (no cross-region) | Pre-prod | S |
| Delivery | GitLab CI runners + issue/MR flow | Pre-prod | M |
| Delivery | OpenShift GitOps (Argo CD), Helm, Dev-only guardrail | Pre-prod | M |
| Secrets | Vault | Pre-prod | S |
| Auth | in-house IdP (authenticated DAST, OIDC) | Pre-prod | M |
| Security servers | DefectDojo + Dependency-Track import | Pre-prod | S |
| SAST server | SonarQube Community (optional) | Pre-prod | S |
| DAST | OWASP ZAP authenticated scan | Pre-prod | M |
| Mirror | Nexus npm/Maven/image mirror + proxy allowlist | Pre-prod | M |

## C. Pending — still to BUILD before prod sign-off
| Item | Why it matters | Effort | Needs |
|------|----------------|--------|-------|
| Mutation testing (PIT/Stryker) wired to gate | proves tests actually catch regressions, not just pass | M | — |
| Bedrock confirmation benchmark | re-measure token policy on the prod model/region | S | Bedrock key |
| Strix + cognee pilots | pentest agent + memory (challengers) | M | `ANTHROPIC_API_KEY`/Bedrock; Strix needs Docker + authorized target |
| headroom arm | last token tool, model-proxy | S | Bedrock reconfigurable endpoint |
| Brownfield `/eco:onboard` | adopt eco-forge into existing repos | M | — |
| Lefthook Tier-1 pre-commit + ArchUnit | fast local gate + architecture rules | S | — |

## Definition of "production-ready"
eco-forge is production-ready when **all three** hold:
1. **Acceptance kit = READY** in your pre-prod (no blocker failures) — Bedrock/residency, gates,
   scanners, and Dev-only OpenShift all green.
2. **Section C build items** that are blockers are done: mutation-testing gate + Bedrock confirmation
   benchmark (brownfield onboard and the challengers can trail as fast-follows).
3. One **real feature** driven end-to-end through `/eco:dev` in pre-prod passes all gates and the
   Claude-authored + human-approved review, on Bedrock.

## Realistic sequence (effort, not calendar — gated on infra availability)
- **Step 1 (you, ~1–2 days once infra access exists):** install the package in pre-prod, run the
  acceptance kit, send me `acceptance-report.md`. This tells us exactly which blockers remain.
- **Step 2 (me, ~3–5 days):** mutation-testing gate + Bedrock confirmation benchmark + fix anything
  the acceptance report flags that is package-side.
- **Step 3 (joint, ~2–3 days):** one end-to-end feature through `/eco:dev` on Bedrock in pre-prod;
  green gates = **production sign-off**.
- Fast-follows after sign-off: brownfield onboard, Strix/cognee/headroom pilots, SonarQube/ZAP depth.

**Net:** from the moment your pre-prod infra is reachable, roughly **1.5–2 weeks of working effort**
to a production sign-off, the critical path being your infra wiring (Step 1) and the mutation-testing
gate + Bedrock confirmation (Step 2).

## How you run the acceptance kit (Step 1)
```
npm i -g ./yourorg-eco-forge-0.1.0-dev.0.tgz     # the tarball I send you
cd <your project>                                 # a repo that has had `eco-forge init`
eco-forge-acceptance --out .                      # read-only; writes the report
# optional: export the endpoints you want verified first, e.g.
#   export CLAUDE_CODE_USE_BEDROCK=1 AWS_REGION=ap-south-1
#   export GITLAB_URL=... VAULT_ADDR=... OIDC_DISCOVERY_URL=... DEFECTDOJO_URL=... DEPENDENCYTRACK_URL=...
```
It writes **`acceptance-report.md`** (+ `.json`) in a fixed format and never reads secret values,
never deploys, never mutates. Send me `acceptance-report.md` — that is the only thing I need from you.
```
```
