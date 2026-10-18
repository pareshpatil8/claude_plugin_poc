# eco-forge — Components, Prerequisites and Coverage

| | |
|---|---|
| **Companion to** | `2026-10-18-eco-forge-design.md`, `../plan/2026-10-18-eco-forge-execution-plan.md` |
| **Status** | DRAFT — for review |
| **Date** | 2026-10-18 |

**Legend**
- ✅ **Default**: installed and enabled by `eco-forge init`.
- ➕ **Optional**: available via `eco-forge add <module>`, off by default.
- ⏳ **Later**: adapter planned after Phase 1.
- ❌ **Excluded**: with the reason.
- 🔍 **Verify**: facts (licence, runtime, network behaviour) to confirm in M1 before it ships enabled.

---

## 1. Claude provider: testing vs production

| | Testing / development of eco-forge | Production use by teams |
|---|---|---|
| Provider | **Claude subscription** (Claude Code login) | **AWS Bedrock, ap-south-1 only** |
| eco-forge profile | `--provider subscription` | `--provider bedrock` (default for teams) |
| Data allowed | **Synthetic only**: golden repo, planted-gap corpus, sample Figma | Project data; real PII still blocked by the PII guard |
| Models | Current Claude models via model aliases | Only models invocable in ap-south-1 (checked by `doctor`) |

### What this changes

1. **Provider abstraction.** Model tiers resolve per provider:
   - **subscription:** aliases;
   - **bedrock:** in-region model IDs.

   All agents use tier names (`high`/`mid`/`low`), never hard-coded model IDs.
2. **Policy lock.** The Bedrock profile installs managed settings that force Bedrock. A developer cannot log in with a personal subscription on a project machine. The subscription profile refuses to run in a repo marked `eco.classification: client`.
3. **Measurement still works.** Token counts are reported by `claude -p --output-format json` on both providers, so the benchmark compares like with like. Two things differ on Bedrock: cost, and possibly model availability and caching behaviour.
4. **New task: Bedrock confirmation run.** Before `stable`, a reduced benchmark (same tasks, fewer repetitions) runs on Bedrock ap-south-1. It confirms that the subscription-measured savings and pass rates hold there.
5. **Subscription usage limits.** These cap how many benchmark repetitions we can run per day. The bench harness schedules runs and resumes after limits reset.

---

## 2. The tools you named: coverage and decision

> **Superseded** by `2026-10-18-eco-forge-tool-evaluation.md`, which evaluates all 33 repositories you sent from their READMEs and licences. Key changes: memory default is now **memsearch** (not claude-mem); "kirodrew" = KiroCrew (excluded); "graft" = Trail, formerly Graft (benchmark challenger); new defaults include code-review-graph, rtk (hook mode), anydoc, opendataloader-pdf, book-to-skill, mattpocock/skills, fable-judge, piomin Spring Boot pack.

| Tool (as named) | What it is (our understanding) | Decision | Where it fits |
|---|---|---|---|
| **Hindsight** | Agent memory system (retain/recall/reflect) with a server and DB | ➕ Optional adapter for personal recall; ⏳ shared server later | Layer 5 Memory |
| **Headroom** | Context/token compression layer that sits in front of the model | ⏳ Later. A proxy in front of Bedrock complicates audit and data residency; adopt only if the benchmark shows a net gain | Layer 6 Tokens |
| **Paperclip** | Multi-agent "company" orchestration and control plane | ⏳ Later adapter, if Claude Code subagents + CI jobs prove insufficient | Layer 7 Orchestration |
| **ECC** (everything-claude-code) | Large collection of Claude Code agents, skills, hooks, rules | ✅ **Curated subset copied** into our agents/skills (attribution kept); not installed wholesale 🔍 licence | Layers 3, 4 |
| **Ruflo** (formerly claude-flow) | Swarm orchestration for Claude Code | ⏳ Later adapter (same reasoning as Paperclip) | Layer 7 |
| **Caveman** | Terse "caveman speak" output mode to cut output tokens | ✅ Adapted as an output style for **subagent→orchestrator reports only** (never for documents or code) | Layer 6 |
| **Anthropic cybersecurity skills** | Security-focused skills for Claude | ✅ Used by security-reviewer, deep-taint-reviewer and pentest-assistant 🔍 exact package/source | Layer 4/10 |
| **context-mode** | MCP server keeping large tool outputs out of the context window | ✅ Default | Layer 6 |
| **mem-search / claude-mem** | Persistent session memory with search, as a Claude Code plugin | ✅ Default personal-recall store, **only if verified to call Bedrock/our provider only** 🔍 runtime, licence, network | Layer 5 |
| **Graphiti** | Temporal knowledge-graph memory (needs Neo4j/FalkorDB) | ⏳ Later, for multi-repo shared memory | Layer 5 |
| **Goose** | Block's open-source agent harness | ❌ Excluded in Phase 1. A second harness doubles config and policy surface; we are Claude Code native | — |
| **"Claude AI Spring Boot"** | Interpreted as Spring Boot-specific Claude skills/rules. **Spring AI** only matters if your apps themselves call an LLM | ✅ Our own Spring Boot 4 skill pack (rules, templates, test patterns). Spring AI ➕ only if apps need LLM features | Layer 3 |
| **Obsidian** | Markdown knowledge vault | ✅ `docs/` is Obsidian-compatible (wikilinks, front matter). The app is optional per user; no plugin required | Layer 5 |
| **"kirodrew skills"** | **Unknown.** Possibly Kiro (AWS's spec-driven IDE) steering/spec conventions, or a draw/diagram skill set | ❓ Need a link | — |
| **agency-agents** | Library of role-persona agent prompts | ✅ Curated personas adapted into our agents (PM/BA/QA/security) 🔍 licence | Layers 1, 3 |
| **"graft"** | **Unknown** | ❓ Need a link | — |
| **Spec Kit** | GitHub's spec-driven development toolkit | ✅ **Method borrowed** (constitution → specify → clarify → plan → tasks); not installed (avoids the Python/uv dependency) | Layer 1 |

---

## 3. Components missing from your list (recommended additions)

| Component | Why | Decision |
|---|---|---|
| **Claude Code plugin marketplace on GitLab** | Distribute agents, skills, commands and hooks as a **versioned Claude Code plugin** from a GitLab repo, instead of copying files. Skills can then be updated without re-running `init`, and teams pin plugin versions. | ✅ **Design change:** the npm CLI handles prerequisites, project scaffolding and plugin registration; the plugin carries the agent content 🔍 confirm marketplace works over your GitLab git URL + proxy |
| **Superpowers** (the skill set behind the `/superpowers:brainstorming` you invoked) | Proven skills for brainstorming, writing plans, TDD and systematic debugging | ✅ Curated subset adapted into our workflow skills 🔍 licence |
| **Anthropic document skills** (docx, pdf, xlsx, pptx) | Higher-fidelity DOCX/PDF for BRD/HLD/UAT sign-off; may remove the pandoc dependency | ✅ Evaluated against pandoc in M1; the better one is kept |
| **Serena MCP** (semantic code navigation via language servers) | Finds symbols and references in large Java codebases without reading whole files: a major token saver for brownfield | ➕ Optional; A/B in the benchmark 🔍 runtime (Python/uv) |
| **Context7 MCP** (current library docs) | Up-to-date Spring Boot 4 / Angular API docs, which reduces hallucinated APIs | ➕ Optional. It sends library-name queries to an external service, so it needs an infosec OK |
| **Playwright MCP** | Lets agents drive the Angular UI to check behaviour and accessibility | ✅ Default (dev only) |
| **OpenRewrite** | Deterministic refactors and upgrades (e.g. Spring Boot version bumps) without spending tokens | ✅ Default for brownfield/upgrades |
| **ArchUnit** | Architecture rules as tests (layering, no cycles, no field injection) | ✅ Tier 2 gate |
| **WireMock** | Stubbing external integrations in tests | ✅ Default |
| **Lefthook** | Cross-platform git hooks (single binary, npm-installable) for Tier 1 on Windows and Linux | ✅ Default (replaces husky/pre-commit) |
| **Renovate** | Automated dependency-update MRs on self-managed GitLab | ✅ Default (CI-scheduled) |
| **ccusage** | Analyses Claude Code token usage from local logs, useful during subscription testing | ✅ Dev tooling for the bench |
| **OpenTelemetry Collector + Prometheus + Grafana** | Token, cost and agent telemetry dashboards | ✅ Needed for Layer 6 telemetry (central deployment) |
| **Corporate CA certificate handling** | The proxy re-signs TLS; Node, Java, Git, Python and containers all need the corporate CA or installs fail | ✅ `init`/`doctor` configure and check `NODE_EXTRA_CA_CERTS`, the Java truststore, Git and the container CA |
| **Keycloak (test only)** | Stand-in OIDC provider until the in-house IdP spec and test users arrive | ✅ AI env / QA test fixture only |
| **pa11y-ci** | Second accessibility engine alongside axe for page-level checks | ➕ Optional |

---

## 4. Full component list (bill of materials)

### 4.1 Claude Code layer

| Component | Purpose | Status | Installed where |
|---|---|---|---|
| Claude Code (pinned version) | Agent runtime | ✅ | Workstation (from Nexus npm), CI runner image |
| eco-forge plugin (agents, skills, commands, hooks, rules, output styles) | Our content | ✅ | GitLab plugin marketplace → each workstation |
| `managed-settings.json` | Org policy (deny rules, provider lock, env) | ✅ | OS policy location per workstation |
| GitLab MCP server | Issues, MRs, pipelines | ✅ 🔍 official (if available on your GitLab version) vs community server | Workstation |
| Figma MCP | Design context | ✅ (route chosen by benchmark) | Workstation (remote or desktop) |
| context-mode MCP | Token saving | ✅ | Workstation |
| Playwright MCP | UI checks by agents | ✅ | Workstation |
| memsearch (local ONNX + Milvus Lite) | Personal recall | ✅ (see tool evaluation) | Workstation |
| Serena, Context7 | Code navigation, library docs | ➕ | Workstation |
| Hindsight, Graphiti, Headroom, Ruflo, Paperclip | Memory, compression, orchestration | ⏳ | — |

### 4.2 Build and test (Spring Boot 4 / Java 21 / Maven / Angular)

| Component | Purpose | Status |
|---|---|---|
| Maven wrapper, Spring Boot 4 BOM | Build | ✅ |
| Flyway | DB migrations (Oracle-first) | ✅ |
| Oracle Free (Testcontainers), H2/embedded Postgres (AI env) | DB tests / quick local run | ✅ |
| Kafka (Testcontainers locally; Strimzi/AMQ Streams Dev onwards) | Event-driven | ✅ |
| JUnit 5, AssertJ, Mockito, Testcontainers, WireMock | Unit/integration tests | ✅ |
| jqwik | Property-based (corner-case) tests | ✅ |
| Spring Cloud Contract or Pact | Contract tests | ✅ (one chosen in M2) |
| JaCoCo, PIT | Coverage, mutation testing | ✅ |
| ArchUnit | Architecture rules | ✅ |
| OpenRewrite | Deterministic refactors and upgrades | ✅ |
| Angular CLI, angular-eslint, Prettier | Frontend build/lint | ✅ |
| Vitest/Jest, Stryker | Frontend unit tests, mutation testing | ✅ |
| Playwright + @axe-core/playwright, Lighthouse CI | e2e, accessibility | ✅ |
| k6 (or Gatling) | Performance tests from `nfr.md` | ✅ |
| Lefthook, Spotless | Git hooks, Java formatting | ✅ |
| Renovate | Dependency-update MRs | ✅ |

### 4.3 Security and compliance

| Component | Purpose | Status |
|---|---|---|
| Semgrep CE + eco rules | SAST (Java, TS, config) | ✅ |
| Meta Infer | Deep inter-procedural analysis (Coverity-like) | ✅ (Linux/devbox only) |
| SpotBugs + FindSecBugs, PMD, Error Prone + NullAway, Checkstyle | Java static analysis | ✅ |
| SonarQube Community Build | Quality dashboard, duplication | ✅ (central server) |
| eslint-plugin-security, eslint-plugin-no-unsanitized | Frontend SAST | ✅ |
| gitleaks | Secrets scanning | ✅ |
| Trivy, OWASP Dependency-Check, Syft (CycloneDX) | SCA, container, SBOM | ✅ |
| Checkov, kube-linter, kubeconform, hadolint | IaC / manifest / Dockerfile checks | ✅ |
| Cosign | Image signing | ✅ |
| OWASP ZAP | DAST (baseline, API, authenticated full scan) | ✅ |
| Nuclei, sqlmap, ffuf | Targeted pen-test tooling (QA-Security only, scope-locked) | ✅ |
| DefectDojo | Findings system of record, waivers, SLAs | ✅ (central) |
| Dependency-Track | Continuous SBOM monitoring | ✅ (central) |
| Apache Tika, ClamAV | File-upload validation, malware scanning | ✅ (file-upload module) |
| OWASP Benchmark, WebGoat | Measuring scanner accuracy | ✅ (eval only) |
| eco DPDP module (consent ledger, `@Pii`, retention, data-principal APIs) | DPDP | ✅ (`add dpdp`) |

### 4.4 Delivery

| Component | Purpose | Status |
|---|---|---|
| Red Hat UBI 9 base images | Containers | ✅ |
| Helm 3 | Charts | ✅ |
| OpenShift GitOps (Argo CD) + ApplicationSet | Deployment and promotion | ✅ (cluster) |
| HashiCorp Vault + Vault Secrets Operator or External Secrets Operator | Secrets, PII encryption keys | ✅ (cluster) |
| `oc` CLI, Argo CD CLI (optional) | Operations | ✅ |

### 4.5 Documents and knowledge

| Component | Purpose | Status |
|---|---|---|
| Markdown templates (BRD…RoPA) | Docs-as-code | ✅ |
| Mermaid (+ mermaid-cli for export) | Diagrams as text | ✅ |
| pandoc **or** Anthropic docx/pdf skills | DOCX/PDF export (decided in M1) | ✅ |
| Obsidian | Optional reader for `docs/` | ✅ (no install needed) |

### 4.6 eco-forge's own tooling

| Component | Purpose |
|---|---|
| Node.js LTS, TypeScript, Vitest, ESLint | CLI development |
| JSON Schema validators (e.g. Ajv) | Validating generated config |
| ccusage, `claude -p --output-format json` | Token measurement |
| GitLab npm registry / Nexus hosted repo | Publishing |

---

## 5. Prerequisites

### 5.1 Developer workstation (AI environment)

`eco-forge doctor` checks every item. `init` installs or configures what it can, and prints exact instructions for the rest.

| Prerequisite | Windows | Linux | Installed by |
|---|---|---|---|
| Node.js **22 LTS** (context-mode needs ≥ 22.5) + npm configured to Nexus | Installer / winget | Package manager / nvm | **User/IT**; then `doctor` checks |
| Git (Windows: **Git for Windows incl. Git Bash**, needed by Claude Code) | Required | Required | User/IT |
| Corporate CA certificate (Node, Java, Git, containers) | Required | Required | `init` configures; IT provides the certificate |
| Proxy env (`HTTPS_PROXY`, `NO_PROXY`) | Required | Required | `init` writes the config |
| Claude Code (pinned) | via npm from Nexus | via npm from Nexus | **`init`** |
| JDK 21 (Temurin or Red Hat build of OpenJDK) | Required | Required | User/IT (`doctor` checks) |
| Maven 3.9+ | Not required (Maven wrapper in repo) | Same | Repo |
| WSL2 | **Required** (for devbox, Infer, Testcontainers) | — | IT |
| Container runtime: Podman Desktop or Docker (WSL2 backend on Windows) | Required | Podman or Docker | IT |
| `eco-devbox` image (scanners pre-installed) | Pulled from registry | Pulled | **`init`** (pull) |
| `oc`, `helm` | Optional on workstation (in devbox) | Same | devbox |
| AWS CLI v2 + SSO profile (Bedrock) | Required for production profile | Same | IT provides SSO; `init` writes the profile |
| Claude subscription login | Testing profile only | Same | User |
| Playwright browsers | Downloaded through proxy or Nexus raw mirror | Same | **`init`** |
| Figma: account seat; desktop app if using the desktop MCP | Per developer | Same | User |
| GitLab personal access token (MCP), stored in the OS keychain | Per developer | Same | User; `init` prompts and stores it |
| **Python 3.11+ and uv** (code-review-graph, memsearch, book-to-skill, opendataloader SDK) | Required | Required | IT installs; `init` configures uv to use the Nexus PyPI proxy |
| Obsidian | Optional | Optional | User |
| IDE: IntelliJ or VS Code + Claude Code extension | Optional | Optional | User |

### 5.2 Network and registry prerequisites

| Item | Needed for |
|---|---|
| Nexus **npm hosted** repo (`@yourorg`) | Publishing eco-forge |
| Nexus **npm proxy**, **Maven proxy**, **PyPI proxy**, **container proxy** (Docker Hub, Quay, registry.access.redhat.com, ghcr.io) | All dependencies and images |
| Nexus **raw** repo (or proxy allowlist) | Trivy DB, Semgrep rules, Nuclei templates, ZAP add-ons, Playwright browsers, OWASP Dependency-Check NVD data |
| Proxy allowlist: Bedrock ap-south-1 endpoints, Figma, Claude (testing only), GitLab | Agents and MCP |
| Plugin marketplace repo on GitLab reachable over git | Plugin install/update |

### 5.3 Platform (central) prerequisites

| Item | Owner | Needed by milestone |
|---|---|---|
| GitLab projects + bot user; VM-based Linux runner with Docker/Podman; Windows runner | EXT/OPS | M1 |
| Bedrock access in ap-south-1 with in-region Claude models; IAM roles via SSO; usage budgets | EXT | M1 |
| OpenShift namespaces (dev, sit, perf, sec, uat, preprod, prod) + `eco-tools` | EXT | M3 |
| OpenShift GitOps operator; ApplicationSet permissions | EXT | M3 |
| Vault: k8s auth, KV paths, transit key; VSO or ESO operator | EXT | M3 |
| DefectDojo (+ Postgres, Valkey/Redis), Dependency-Track (+ Postgres), SonarQube CE (+ Postgres) | OPS | M2–M4 |
| ClamAV service | OPS | M4 |
| Kafka for Dev onwards (Strimzi / AMQ Streams) | EXT | M3 |
| Oracle schemas for Dev onwards | EXT | M3 |
| OpenTelemetry Collector + Prometheus + Grafana | OPS | M1 (basic) / M5 |
| Central log store for the audit JSONL | EXT | M1 |
| In-house IdP test client + test users per role | EXT | M4 (stub earlier) |

---

## 6. What `eco-forge init` does vs. what it needs in place

| `init` installs or configures automatically | `init` checks, but someone must provide it |
|---|---|
| Claude Code (pinned); eco-forge plugin + marketplace registration; MCP config; managed settings; hooks (Lefthook); proxy and CA configuration; AWS SSO profile skeleton; devbox image pull; Playwright browsers; project scaffolding (docs, GitLab templates, Helm, Dockerfiles, `eco.gates.yaml`, `eco.lock`) | Node, Git (+ Git Bash on Windows), JDK 21, WSL2, container runtime, corporate CA file, Nexus credentials, GitLab token, Bedrock SSO access, Figma seat, all platform items (§5.3) |

---

## 7. Changes to the design and plan triggered by this review

1. **D19:** testing on a Claude subscription, production on Bedrock ap-south-1, through a provider abstraction (§1).
2. **D20:** agent content is distributed as a **Claude Code plugin** from a GitLab marketplace; the npm package installs prerequisites, scaffolding and registration.
3. **New tasks:**
   - **M1-22:** provider abstraction + policy lock.
   - **M1-23:** corporate CA/proxy handling across Node, Java, Git and containers.
   - **M1-24:** plugin packaging + GitLab marketplace.
   - **M1-25:** licence and network verification of every third-party component marked 🔍.
   - **M5-07:** Bedrock confirmation benchmark before `stable`.
4. **Additions:** Superpowers subset, ArchUnit, OpenRewrite, WireMock, Lefthook, Renovate, Playwright MCP, ccusage, OTel/Prometheus/Grafana, Keycloak test stub. **Optional:** Serena, Context7, pa11y-ci.

---

## 8. Still needed from you

- The tool list your last message referred to. It didn't come through.
- Links or a description for **"kirodrew skills"** and **"graft"**.
- Confirmation of what "Claude AI Spring Boot" means to you: Spring Boot skills for Claude (assumed) or Spring AI in the apps.
