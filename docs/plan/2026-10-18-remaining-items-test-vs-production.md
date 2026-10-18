# Remaining items: test here vs. production-only

| | |
|---|---|
| **Status** | DRAFT — for review |
| **Date** | 2026-10-18 |
| **Rule** | Light/ephemeral tools may be installed here for testing, then **removed** after the activity closes. Anything needing your real infra is verified in your environment via the acceptance kit. |

## Legend
- **A — Test fully here:** logic/config is complete and provable in this container with free/ephemeral tools; result counts.
- **B — Light stand-in here, re-verify in prod:** install a lightweight version, test, **remove after**; your environment stays authoritative.
- **C — Production only:** needs your Bedrock/GitLab/Nexus/OpenShift/Vault/IdP; eco-forge ships config + an acceptance-kit check you run.

| Item | Class | How we handle it | Remove after? |
|---|---|---|---|
| Spec pipeline commands (intake, spec, design, plan, uat, export) — M1-12/13 | **A** | Pure skill/command/template files; render + lint; dry-run on sample BRD | n/a (files) |
| SAST stack: Semgrep + custom rules | **A/B** | Semgrep via `uvx` (ephemeral, nothing persistent); custom OWASP/file-upload/DPDP rules tested on golden repo | Semgrep cache only |
| SARIF reducer + gate-policy + trace-check scripts — M2-08 | **A** | Pure Node scripts with unit tests | n/a |
| SCA / container / SBOM: Trivy, Syft | **B** | Install Trivy/Syft binary to scratchpad, scan golden repo, then delete the binary | **Yes** |
| OWASP Dependency-Check | **C** | Needs a large NVD download; ship config + CI job; run in your CI | — |
| Java deep SAST: Infer, SpotBugs, PMD, Error Prone | **B (partial)** | SpotBugs/PMD/Error Prone run via Maven here on golden repo; **Infer is Linux-heavy** → config only, run in eco-devbox/CI | SpotBugs/PMD are Maven plugins (no cleanup) |
| SonarQube Community | **C** | Server; ship scanner config; run against your Sonar | — |
| DAST: OWASP ZAP (baseline) | **B (optional)** | Can run ZAP in Docker against a local golden-app instance for one smoke scan, then remove the image; full/authenticated scan is **C** (needs IdP) | **Yes** (image) |
| Nuclei, sqlmap, ffuf (pen-test) | **C** | Scope-locked to QA-Security; config + checklist only | — |
| DefectDojo, Dependency-Track | **C** | Servers; ship CI import + compose; stand-ins optional later | — |
| File-upload module (Tika, ClamAV) | **A/B** | Module code + attack-case tests run here; **ClamAV daemon** is a stand-in (install, test, remove) | ClamAV: **Yes** |
| DPDP module (consent, @Pii, retention) | **A** | Java module + integration tests on Oracle Free (Testcontainers) here | n/a |
| Docker/Helm/OpenShift manifests | **A (manifest) / C (cluster)** | hadolint + kubeconform + kube-linter here; real deploy is **C** (your OpenShift) | lint tools ephemeral |
| Argo CD GitOps, Vault | **C** | Manifests + acceptance-kit checks; optional kind+ArgoCD/Vault-dev stand-in later | stand-ins: **Yes** |
| GitLab issue/MR flow | **C** | MCP config + templates; optional GitLab CE stand-in later | stand-in: **Yes** |
| In-house IdP | **C** | Keycloak stand-in for auth tests; real IdP is yours | Keycloak: **Yes** |
| Memory: memsearch | **B** | Install, verify it stays local (no non-Bedrock egress), test, remove | **Yes** |
| Token benchmark full matrix | **A** | Harness ready; run on subscription (budget permitting) | n/a |

## Teardown register
Every light tool installed for testing is logged in `docs/plan/teardown-register.md` with the install location and the removal command, and removed when the activity closes. Nothing persistent is left in the repo or the image.
