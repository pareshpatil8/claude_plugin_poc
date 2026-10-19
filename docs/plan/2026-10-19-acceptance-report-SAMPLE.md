# eco-forge acceptance report

- Generated: 2026-10-19T03:27:59.429Z
- Verdict: **NOT-READY**
- Totals: 2 pass · 5 fail · 10 skip · 5 blocker(s) failed

| Area | Check | Severity | Status | Evidence | Remediation |
|------|-------|----------|--------|----------|-------------|
| Runtime | Node.js >= 22.22.3 | blocker | ❌ fail | node v22.22.0 | Upgrade to >= 22.22.3. |
| Runtime | Java 21 | blocker | ❌ fail | java not found | Install a Java 21 JDK (Temurin/Corretto). |
| Runtime | Maven available | blocker | ✅ pass | mvn on PATH |  |
| Residency | Provider is Bedrock in an India region | blocker | ❌ fail | CLAUDE_CODE_USE_BEDROCK not set | In production set CLAUDE_CODE_USE_BEDROCK=1 and use Bedrock (not a raw Anthropic key). |
| Residency | No cross-region inference profile | blocker | ⏭️ skip | no model IDs set in env | Set in-region Bedrock model IDs (no us./eu./apac./global. prefix). |
| Residency | No raw Anthropic API key in prod | warn | ✅ pass | no raw key |  |
| Security | Semgrep (SAST) | warn | ⏭️ skip | semgrep not found | Install Semgrep CE (uvx semgrep) or mirror via Nexus. |
| Security | Trivy (SCA/images) | warn | ⏭️ skip | trivy not found | Install Trivy and point it at your Nexus/registry mirror. |
| Security | gitleaks (secret scan) | warn | ⏭️ skip | gitleaks not found | Install gitleaks for the CI secret-scan stage. |
| Gates | eco.gates.yaml present | blocker | ❌ fail | eco.gates.yaml missing | Run `eco-forge init` in the project so the gate thresholds are present. |
| Gates | eco-forge gate CLIs runnable | blocker | ❌ fail | missing: eco-forge-gate, eco-forge-sca, eco-forge-trace, eco-forge-spec-lint, eco-forge-design-lint, eco-forge-perf | Install the package globally (npm i -g @yourorg/eco-forge) so the gate CLIs resolve. |
| Delivery | GitLab reachable | warn | ⏭️ skip | GITLAB_URL not set | Set GITLAB_URL to your GitLab endpoint to verify it here. |
| Delivery | Vault reachable | warn | ⏭️ skip | VAULT_ADDR not set | Set VAULT_ADDR to your Vault endpoint to verify it here. |
| Delivery | IdP OIDC discovery reachable | warn | ⏭️ skip | OIDC_DISCOVERY_URL not set | Set OIDC_DISCOVERY_URL to your IdP OIDC discovery endpoint to verify it here. |
| Delivery | DefectDojo reachable | warn | ⏭️ skip | DEFECTDOJO_URL not set | Set DEFECTDOJO_URL to your DefectDojo endpoint to verify it here. |
| Delivery | Dependency-Track reachable | warn | ⏭️ skip | DEPENDENCYTRACK_URL not set | Set DEPENDENCYTRACK_URL to your Dependency-Track endpoint to verify it here. |
| Delivery | OpenShift client present and NOT pointed at prod | blocker | ⏭️ skip | oc not on PATH | Install the OpenShift CLI where deploys run; harmless to skip in a build-only pre-prod. |

Blockers failed — not production-ready yet. Fix the blocker rows and re-run. Send this report back.
