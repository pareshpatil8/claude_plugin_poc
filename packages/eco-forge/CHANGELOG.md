# Changelog — @yourorg/eco-forge

## 0.1.0-rc.3 — residency check is topology-aware (on-box Bedrock gateway)

### Fixed
- **`res-bedrock` residency check** now recognises **three topologies** instead of only native
  Bedrock: (A) native `CLAUDE_CODE_USE_BEDROCK=1`, (B) an **on-box gateway** (loopback
  `ANTHROPIC_BASE_URL` + `AWS_PROFILE`, e.g. headroom) forwarding to Bedrock ap-south-1 — now
  **passes** with a note to confirm the gateway's upstream region, and (C) a **remote**
  `ANTHROPIC_BASE_URL` — **fails** as a residency risk (can route out of India). Previously a valid
  on-box-gateway deployment was reported NOT-READY. Two regression tests added.

## 0.1.0-rc.2 — acceptance-probe fix (Windows + stderr tools)

### Fixed
- **`eco-forge-acceptance` version probe** — tools that print their version to **stderr** and
  exit 0 (notably `java -version`) were reported as "not found" because the probe read only
  stdout on the success path. The probe now combines stdout+stderr via `spawnSync` (never throws
  on non-zero exit) and resolves through the shell on Windows so `.cmd`/`.exe`/App-Execution-Alias
  executables (`java`, `mvn`) are found. Regression test added. No behaviour change on Linux/macOS
  for stdout tools.

## 0.1.0-rc.1 — v1 release candidate (pre-prod acceptance)

First candidate for the pre-prod acceptance run. Everything below is tested in the AI container
(194 unit tests, lint + typecheck clean); infra-dependent items ship as config + an acceptance check
you run in your environment.

### CLIs (12)
`eco-forge` (init/doctor) · `eco-forge-guard` (deny + PII hook) · `eco-forge-gate` (SARIF reduce/
policy/elevate) · `eco-forge-sca` (Trivy + reachability) · `eco-forge-trace` (REQ-ID traceability) ·
`eco-forge-spec-lint` · `eco-forge-design-lint` · `eco-forge-perf` (NFR→k6) · `eco-forge-mutation`
(PIT/Stryker gate) · `eco-forge-govern` (governance ledger) · `eco-forge-bench` (token benchmark) ·
`eco-forge-acceptance` (pre-prod suite).

### Added
- **Governance** — append-only who-did-what ledger (`eco-forge-govern`), auto-wired as
  PostToolUse/SubagentStop/SessionEnd hooks; records agent/human + REQ-ID + tool + decision + gate/
  waiver/review/merge; metadata only (digests, no content — DPDP). Design + OSS stack documented
  (Langfuse/OpenLLMetry/Tekton Chains/OPA/DefectDojo/Dependency-Track) + managed-settings/OTel block.
- **Mutation-testing gate** — `eco-forge-mutation` parses PIT/Stryker reports → score vs threshold
  (`mutation.changedCodeMin: 60`); fails on too many surviving mutants or zero mutants.
- **Acceptance kit** — `eco-forge-acceptance`, read-only self-documenting pre-prod suite (runtime,
  Bedrock/residency, scanners, gate CLIs, Dev-only OpenShift, GitLab/Vault/IdP/DefectDojo/
  Dependency-Track endpoints) → `acceptance-report.md` + `.json`.
- **Token benchmark** — `eco-forge-bench`, resumable matrix; measured ponytail/rtk/context-mode/
  caveman; default policy = gate each token tool by task profile.
- **Scope charter** — the anti-creep guardrail (thin glue; adopt don't build; measure before default).

### Proven earlier (unchanged)
Spec pipeline + trace-check, proactive QA (spec/design lint), SAST (Semgrep/SpotBugs/PMD), SCA +
reachability, gitleaks, secure upload (Tika, 11 cases), DPDP (@Pii/retention), perf/a11y gates,
17-agent roster + delivery-planner orchestration, guard + PII hook + red-team suite, catch-rate 8/8,
Cloudflare security-audit skill pilot 5/5.

### Pending (pre-prod / post-v1)
Pre-prod acceptance run + one end-to-end feature on Bedrock = production sign-off. Post-v1
adopt-if-measured: Strix/cognee/headroom pilots, SonarQube/ZAP depth, brownfield `/eco:onboard`,
Lefthook + ArchUnit.
