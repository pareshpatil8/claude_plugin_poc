# Tools & packages tested and found satisfactory

Scope: only tools we **actually ran and verified in this environment** (on the golden Spring Boot 4 +
Angular repo, the planted-defect fixtures, or the token benchmark). Paper-only evaluations are in
`2026-10-18-eco-forge-tool-evaluation.md`; this file is the empirically-confirmed shortlist.

Verdict key: ✅ satisfactory (adopt) · 🟡 satisfactory but conditional (gate by use) · ❌ rejected.

## Token-efficiency tools (benchmarked this session, reps=5, 100% pass — see bench-report.md)
| Tool | Verdict | Evidence | Default policy |
|------|---------|----------|----------------|
| **ponytail** (MIT) | ✅ | +4.8% tokens vs eco-full and **fewer turns** (7→6); 100% pass | Default **ON** for coding |
| **rtk** 0.49.0 (Apache-2.0 CLI) | 🟡 | +7.2% pooled but **−0.8% on the larger-output task** — pays off as command output grows | ON for build/test-heavy loops; OFF for trivial edits |
| **context-mode** 1.0.169 (Elastic 2.0) | 🟡 | +27.6% on small-output coding (pure overhead); engages correctly | OFF for coding; ON only for large-output/exploratory work |
| **caveman** (JuliusBrussee, voice skills) | 🟡 | **−6.7% orchestration cost, 3/3 paired reps, 100% pass** on a delivery-planner fan-out; no effect on single-agent tasks. `caveman-compress` EXCLUDED (ships file text off-machine, DPDP) | ON for **multi-agent orchestration** only |

## Security & quality scanners (verified on the golden repo + planted defects)
| Tool | Verdict | Evidence |
|------|---------|----------|
| **Semgrep CE** + eco custom rules | ✅ | Blocks SQLi / XSS / command-injection / PII-in-logs / disabled-method-security on the fixtures; clean code passes |
| **SpotBugs + FindSecBugs** | ✅ | Catches `COMMAND_INJECTION`, `PREDICTABLE_RANDOM`; SARIF severities elevated correctly |
| **PMD** | ✅ | Runs as a Maven plugin on the golden backend |
| **Trivy** 0.60 (SCA + our reachability triage) | ✅ | Log4Shell fixture blocked; unused transitive dep correctly waived as unreachable |
| **gitleaks** 8.28 | ✅ | Secret scan wired in CI, runs clean |
| **Cloudflare security-audit skill** (MIT) | ✅ | **Piloted: 5/5 catch rate, 0 false positives, $0.22** on the planted-defect repo (SQLi, PII-log, permitAll, 2× XSS). Runs on your own model. Adopt as an advisory LLM reviewer alongside the deterministic gates |

## Build / test / runtime infrastructure (proven here)
| Tool | Verdict | Evidence |
|------|---------|----------|
| **Spring Boot 4.1.1 / Java 21 / Maven** (offline) | ✅ | Golden backend compiles + unit tests green offline |
| **Testcontainers** (Oracle Free + Kafka, singleton) | ✅ | Integration tests run (needs Docker; not in the AI container) |
| **Angular 22.2.1** | ✅ | Builds (needs Node ≥ 22.22.3) |
| **Apache Tika** (secure file upload) | ✅ | 11 upload attack-case tests pass (magic-byte, zip-bomb, allow-list) |
| **k6** (NFR→thresholds) + **axe** (a11y gate) | ✅ | perf-threshold generator and a11y gate proven |
| **Node built-in test runner** (`node:test`) | ✅ | eco-forge's own suite: 181 tests, ~95% coverage, lint+typecheck clean |

## eco-forge package itself (built + tested here)
✅ CLI (`init`/`doctor`), guard hook (deny rules + PII), the gate chain (SARIF reduce/policy/elevate,
SCA reachability, trace-check, spec-lint, design-lint, nfr-perf), and the resumable `eco-forge-bench`
runner — all covered by the 181-test suite.

## Rejected (honest)
| Tool | Why |
|------|-----|
| **Vitest 4.1 / 5.0.3** | Crashes npm's dependency resolver (`edgesOut` null) → eco-forge uses `node:test` instead |
| **context-mode as a blanket default** | Measured +27.6% overhead on ordinary coding tasks |

## Not yet verifiable in this environment (deferred, not rejected)
| Tool | Needs |
|------|-------|
| **headroom** (model-proxy compression) | The reconfigurable Bedrock endpoint |
| OWASP ZAP (DAST), SonarQube, Dependency-Check, Dependency-Track, DefectDojo | Your real servers / large NVD download — ship as config + acceptance kit |
