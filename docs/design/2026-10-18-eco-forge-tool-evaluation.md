# eco-forge — Third-Party Tool Evaluation and Test-Environment Split

| | |
|---|---|
| **Companion to** | `2026-10-18-eco-forge-design.md`, `2026-10-18-eco-forge-components-and-prerequisites.md` |
| **Status** | DRAFT — for review |
| **Date** | 2026-10-18 |

**Method.** For each of the 33 repositories you listed (#25 and #26 are the same repo), we read the README and LICENSE at their state on 2026-10-18. Every benefit figure below is **the project's own claim**. None has been verified yet; verification is the benchmark's job (§5).

**Screening criteria**, in this order:
1. **Data egress.** Does anything leave the machine outside Bedrock ap-south-1 (DPDP)?
2. **Works with Claude Code on Bedrock.**
3. **Licence.**
4. **Install safety.** No `curl | sh`; pinnable versions; no silent auto-update.
5. **Default telemetry.**
6. **Windows support.**
7. **Overlap.** One default per layer.

---

## 1. Decisions at a glance

| Layer | Default (Phase 1) | Benchmark challenger | Later | Excluded |
|---|---|---|---|---|
| Agent runtime | Claude Code (pinned) | — | — | Goose, KiroCrew, deer-flow, qm |
| Orchestration | Claude Code subagents + CI headless jobs | — | Ruflo, Paperclip | — |
| Spec / process skills | eco `/eco:*` commands + **mattpocock/skills** (curated) + **fable-method** (fable-judge) | Spec Kit with an org preset | — | — |
| Role agents | Curated **agency-agents** + **ECC** Java/Spring subset + **piomin/claude-ai-spring-boot** (forked) | — | — | gstack (installed form) |
| Security skills | Curated **Anthropic-Cybersecurity-Skills** (community) + **ECC AgentShield** | — | — | — |
| Document ingestion | **anydoc** (Office → MD) + **opendataloader-pdf** (PDF → MD) + **book-to-skill** (standards → skills) | — | KSoR | — |
| Code graph / navigation | **code-review-graph** | Trail (formerly Graft) | — | graphify, claude-context, token-savior |
| Token: tool output | **context-mode** + **rtk** (hook mode only) | headroom (Bedrock extra) | — | pxpipe, token-savior |
| Token: output and code volume | **caveman** (skill only) | ponytail | — | caveman CLI/Cloud |
| Memory | Repo-as-memory + **memsearch** (local ONNX + Milvus Lite) | — | Graphiti, Cognee, Hindsight | ECC Memory Vault |
| Knowledge viewer | **Obsidian** (opens `docs/`) | — | — | — |
| Research | — | — | — | last30days |

---

## 2. Per-repository evaluation

### 2.1 Spec, process and method skills

| # | Repo | What it is | Fit and risks | Decision |
|---|---|---|---|---|
| 32 | **github/spec-kit** (MIT) | Spec-driven toolkit: constitution → specify → plan → tasks → implement → converge; presets for org/regulatory standards; private and air-gapped catalogs | Good method. Adds Python 3.11 + uv; Claude Code support must be confirmed on its integrations page (the README doesn't name it). Presets and the air-gapped mode are stronger than expected. | **Benchmark challenger.** Default stays our own `/eco:*` commands (your earlier decision). M1 compares them against Spec Kit + an eco preset on the planted-gap corpus; keep the winner. |
| 25/26 | **mattpocock/skills** (MIT) | Small composable skills: `/grill-me`, `/grill-with-docs`, `/to-spec`, `/to-tickets` (GitLab supported), `/tdd`, `/diagnosing-bugs`, `/implement-spec`, `/code-review`, `/improve-codebase-architecture`, `/handoff` | Prompt-only, so it inherits Bedrock and has no egress. Plugin auto-update must be off: vendor a pinned copy. | ✅ **Curated:** `grill-me` / `grill-with-docs` power the live clarify interview; `to-tickets` feeds the GitLab issue flow; plus `tdd`, `diagnosing-bugs`, `handoff` |
| 1 | **Sahir619/fable-method** (MIT) | Skills: fable-method (classify → define done → evidence → act → verify), fable-loop, **fable-judge** (adversarial check of "done" claims) | Markdown only; single author; small evals | ✅ **fable-judge** as the verifier before any agent reports "done"; method rules folded into our CLAUDE.md template |
| 3 | **garrytan/gstack** (MIT) | 23 role skills (office-hours, plan-eng-review, review, qa, **cso** OWASP + STRIDE, ship, retro) + browser and design tools | **Egress risk:** Codex "outside reviews" are on by default and send code to OpenAI; the design tool uses the OpenAI API; auto-updates every session; global Stop hook; unsigned binaries; heavy setup (Bun, Chromium, Docker) | ❌ **Don't install.** ✅ Adapt the ideas of `cso`, `plan-eng-review` and `retro` into our skills (MIT, with attribution) |

### 2.2 Role agents and stack packs

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 27 | **msitarzewski/agency-agents** (MIT): 230+ persona agents | Prompt-only. Bulk install bloats the agent list and context; many are irrelevant | ✅ **Curated ~10:** PM, BA, architect, QA, security, DevOps, technical writer, accessibility |
| 9 | **affaan-m/ECC** (MIT): 71 agents, 311 skills, hooks, AgentShield | Has **java-reviewer, java-build-resolver (Maven), springboot-patterns/-security/-tdd/-verification, java-coding-standards**. Whole plugin costs too much context. `/astra-review` sends code to OpenAI. Memory Vault has Windows bugs | ✅ **Curated Java/Spring subset + AgentShield** (scans our own hooks/MCP/permissions config). ❌ Whole plugin, astra-review, Memory Vault |
| 19 | **piomin/claude-ai-spring-boot** (Apache-2.0): Spring Boot 4 / Java 21 agents and skills | Strong base for our Spring Boot 4 pack (testing patterns with Testcontainers `@ServiceConnection`, JPA, security, design patterns). Needs adapting: CircleCI → GitLab CI, Kubernetes → OpenShift, groupId, Lombok policy; no Angular | ✅ **Fork as the base of the eco Spring Boot 4 skill pack** |

### 2.3 Security

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 6 | **mukul975/Anthropic-Cybersecurity-Skills** (Apache-2.0). **Community project, not affiliated with Anthropic** despite the name | 818 skills mapped to MITRE/NIST. Includes offensive/dual-use content (C2, phishing). Bundled scripts run locally | ✅ **Curated subset only:** web app security, API security, secure code review, DevSecOps, threat modelling, cloud/container hardening. Every bundled script reviewed. Offensive domains excluded |

### 2.4 Document ingestion (BRDs, standards, existing docs)

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 24 | **firecrawl/anydoc** (MIT): DOCX/PPTX/XLSX/ODT/RTF/EPUB/text-PDF → Markdown (Rust, prebuilt via npx) | Fully local by default. Hosted OCR (`--ocr hosted`) sends documents to Firecrawl Cloud | ✅ Default for Office-format BRDs. **Hosted OCR blocked by the guard hook** |
| 4 | **opendataloader-pdf** (Apache-2.0): PDF → MD/JSON/HTML, tables, local OCR in hybrid mode | Local, "no API calls". Java 11+ (fits our stack). OCR models may download on first use (needs mirroring) | ✅ Default for PDFs, including scanned ones (local hybrid OCR) |
| 29 | **book-to-skill** (MIT): docs/books → structured skill with on-demand chapters | Claimed 24–51× fewer tokens than pasting the whole doc. Optional GitHub publish step | ✅ For org standards, coding guidelines, IdP spec and integration manuals → skills. **GitHub publish disabled** |
| 30 | **panaversity/ksor** (Apache-2.0): governed org knowledge base + MCP | Immature (README says not production-ready). Embeddings via Gemini in the example (non-India egress). Needs Postgres + pgvector | ⏳ Later, for the central knowledge base |

**Why this matters for tokens:** each BRD is converted **once** to Markdown, then `/eco:intake` reads the Markdown, never the binary document.

### 2.5 Code graph and code navigation

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 8 | **code-review-graph** (MIT): Tree-sitter → SQLite graph; blast radius; MCP + skills + hooks | **Java Spring-aware** (DI, endpoints, scheduled jobs, events, config keys); TS for Angular. No telemetry. Local embeddings optional. Python 3.10+. Its own claim is 63× fewer tokens per question, but vs. a whole-repo baseline, and small edits can cost more | ✅ **Default**, used for review context, brownfield onboarding and impact analysis |
| 28 | **trailhq/Graft → Trail** (MIT): code map + team "learnings" in `.trail/` + `trail check` | Claims −42% uncached input tokens. **Telemetry on by default**; writes global `~/.claude` settings/hooks; `--deep` needs a non-Bedrock provider; recently renamed (fast-moving) | 🧪 **Benchmark challenger** to code-review-graph (telemetry off, no `--deep`) |
| 18 | **Graphify-Labs/graphify**: code + docs → knowledge graph | **No LICENSE file**; PyPI name is temporary (`graphifyy`), a supply-chain risk; CI and install URLs point at another owner | ❌ Revisit once it has a licence and a stable package name |
| 14 | **zilliztech/claude-context** (MIT): semantic code search MCP | Default config sends code to the **OpenAI embedding API + Zilliz Cloud**; local mode needs Ollama + Milvus | ❌ code-review-graph covers the need without the egress |
| 12 | **Mibayy/token-savior** (MIT): code nav + memory + Bash compaction | Overlaps three layers. Single maintainer; benchmark figures withdrawn and re-run; edits global settings; auto-extraction needs the direct Anthropic API | ❌ |

### 2.6 Token efficiency

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 11 | **mksglu/context-mode** (**Elastic License 2.0**): sandboxed execution, FTS5 index, session continuity | Local, no LLM, honours Claude Code deny rules. Claims 98% less tool output. ELv2 allows internal use but **not offering it as a hosted service**, so we install the pinned upstream package rather than redistributing a modified copy. Block `/ctx-insight` (hosted dashboard) and set `CTX_FETCH_STRICT=1` | ✅ **Default** |
| 10 | **rtk-ai/rtk** (Apache-2.0 + **BUSL-1.1** for engine/proxy): compresses shell output (git, Maven, tests…) | Single binary; `winget` on Windows; telemetry off by default. **Hook mode only**; the proxy isn't used. Internal use is permitted under BUSL. Fires only on Bash calls, so it complements context-mode | ✅ **Default (hook mode)**. Coexistence with context-mode hooks verified in M1 |
| 13 | **JuliusBrussee/caveman** (Apache-2.0): terse output + compression + cloud routing | **CLI telemetry on by default; "Auto" sends prompts and files to Caveman Cloud.** The skill alone sends nothing | ✅ **Skill only**, for subagent→orchestrator reports. ❌ CLI, Auto, Cloud, Blocks |
| 5 | **DietrichGebert/ponytail** (MIT): "write minimum necessary code" plugin with a reuse ladder | Claims −45% tokens and −53% code. Always-on behaviour change; must not weaken validation or security | 🧪 **Benchmark challenger.** Default only if gate pass rate and mutation score don't drop |
| 20 | **headroomlabs-ai/headroom** (Apache-2.0): compression proxy / MCP / `wrap claude` | Has a **Bedrock extra**. Telemetry on by default (opt-out); model downloads from HuggingFace; `wrap` edits `~/.claude.json`. Claims 21–57% savings. A proxy in front of Bedrock must pass the audit and residency review | 🧪 **Benchmark challenger** (telemetry off, offline models) |
| 22 | **teamchong/pxpipe** (MIT): renders context as images to cut tokens | **Lossy** (its own README notes exact-string recall failures); built for the direct Anthropic API, **not Bedrock**; MITM mode | ❌ |

### 2.7 Memory

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 15 | **zilliztech/memsearch** (MIT): Markdown-first memory, Milvus as rebuildable index, auto-capture per turn | Matches repo-as-memory. Runs fully local (ONNX bge-m3 ~558 MB + Milvus Lite); summaries go through Claude Code (so Bedrock). **Captures every turn to disk**, so DPDP retention and the PII guard apply. Zilliz Cloud must be disabled | ✅ **Default personal memory** (replaces my earlier claude-mem pick). Model mirrored via Nexus |
| 16 | **getzep/graphiti** (Apache-2.0): temporal knowledge graph | OpenAI by default; **PostHog telemetry on by default**; needs Neo4j/FalkorDB; LLM call on every ingest | ⏳ Later (shared memory), with telemetry off and an LLM route through Bedrock |
| 34 | **topoteretes/cognee** (Apache-2.0): memory platform, Claude Code plugin | Local GLiNER + local embeddings without a key, but **defaults to OpenAI when a key is set**; Postgres graph is "demo"; production tiers licensed | ⏳ Later alternative to Graphiti |
| 21 | **obsidianmd/obsidian-releases**: release/plugin index for the (closed-source) Obsidian app | No Claude Code integration needed; community plugins are third-party code | ✅ Viewer only; no community plugins by default |

### 2.8 Orchestration platforms and other harnesses

| # | Repo | Fit and risks | Decision |
|---|---|---|---|
| 2 | **ruvnet/ruflo** (MIT): swarm meta-harness, 314 MCP tools, plugins, federation | **High risk:** `curl\|bash` install; `@latest` MCP; its README says mods are unsandboxed; multi-provider routing (GPT/Gemini/…); cross-machine federation; writes many files and hooks | ⏳ Later, only in an isolated evaluation if subagents prove insufficient |
| 17 | **aaif-goose/goose** (Apache-2.0): standalone agent (Linux Foundation AAIF), supports Bedrock | A second agent runtime doubles policy and config surface | ❌ Phase 1 (Claude Code native) |
| 23 | **kirodotdev/KiroCrew** (Apache-2.0): persistent workspace gateway driving **kiro-cli** | Needs a Kiro sign-in; Claude Code not stated as a backend; telemetry on by default; `curl\|sh` | ❌ ("kirodrew" resolved: KiroCrew) |
| 33 | **bytedance/deer-flow** (MIT): LangGraph super-agent server | Heavy server (Docker, 8–32 GB); defaults to non-Bedrock providers and external search APIs; PyPI index pinned (fights Nexus) | ❌ |
| 31 | **yc-software/qm** (MIT): multiplayer Slack/web agent harness | Server platform (Postgres, sandboxes, Slack); default "Auto" security posture | ⏳ Re-assess for the central-server phase only |
| 7 | **mvanhorn/last30days-skill** (MIT): social/web research | Scrapes public sites, **reads browser cookies**, auto-installs CLIs; not a dev-workflow tool | ❌ |

---

## 3. Selected stack: extra prerequisites

These are added to the components document §5.

| Component | Runtime needed | Model/data downloads (mirror via Nexus raw or the proxy) |
|---|---|---|
| context-mode | **Node ≥ 22.5**, so the workstation baseline becomes **Node 22 LTS** | — |
| rtk | None (binary; `winget` on Windows, release binary on Linux) | — |
| code-review-graph | **Python 3.10+ / uv** | Optional local embedding model |
| memsearch | **Python + uv**, ONNX runtime | **bge-m3 ONNX (~558 MB)** |
| opendataloader-pdf | **Java 11+** (JDK 21 already required) + Python or Node SDK | OCR models in hybrid mode |
| anydoc | Node (prebuilt binary via npx) | — |
| book-to-skill | Python 3 (+ optional poppler/docling) | Docling models (if used) |
| Spec Kit (challenger) | Python 3.11 + uv | — |
| headroom (challenger) | Python 3.10+ / uv | HuggingFace models, ONNX runtime |

**New platform prerequisites**
- **Nexus PyPI proxy repository** (uv and pip go through it).
- A Nexus raw or HuggingFace-mirror location for model files.

**Hook coexistence.** Our guard and PII hooks must run **first**. Then come context-mode, rtk, code-review-graph and memsearch hooks. M1 adds an explicit hook-ordering test.

---

## 4. Licences to note

| Licence | Components | Implication |
|---|---|---|
| Elastic License 2.0 | context-mode | Internal use fine; don't offer it as a managed service or remove licence notices; install upstream rather than redistributing a modified copy |
| BUSL-1.1 (engine/proxy) | rtk | Internal production use permitted; don't resell or host it for third parties |
| No licence | graphify | Not usable (excluded) |
| MIT / Apache-2.0 | All others selected | Keep attribution when adapting content |

**Legal should confirm the ELv2 and BUSL reading** before the internal release.

---

## 5. Benchmark arms added to `eco-forge bench`

Every token-saving default must justify itself on **tokens per passing task** (pass rate must not drop):

1. Vanilla Claude Code (baseline)
2. eco-forge full default
3. − context-mode
4. − rtk
5. − caveman skill
6. − code-review-graph
7. + ponytail
8. + headroom (telemetry off)
9. Trail instead of code-review-graph
10. Spec Kit + eco preset instead of the `/eco:*` spec commands (spec-gap corpus)
11. Figma MCP vs export import (already planned)

---

## 6. Test-environment split (proposal to finalise)

Verified **today** in this development container:
- Node 22.22, npm 10.9, Java 21.0.12, Maven 3.9.11, Python 3.13, uv, Bun, Cargo
- Docker 29.8 (daemon started; containers run)
- pandoc 3.1, Chromium/Playwright
- **Claude Code 2.1.302 headless, which reports per-run token usage in JSON on the subscription**
- Internet access to npmjs, Maven Central, PyPI, GHCR and Quay
- Docker Hub currently rate-limited (429); worked around via GHCR/Quay mirrors
- **Oracle Free 23 and Kafka images pulled successfully**

Not installed yet but installable: helm, kind, kubectl, Semgrep, Trivy, the other scanners.

### Class A: fully testable here (results count)

- eco-forge CLI, templates, managed-file engine, guards and PII red-team, hook ordering
- Golden repo (Spring Boot 4 / Java 21 / Angular) with **Oracle Free + Kafka Testcontainers**
- The SAST/SCA/IaC stack; **OWASP Benchmark**; ZAP against WebGoat (in Docker)
- File-upload and DPDP modules with their attack and gate tests
- Document ingestion (anydoc, opendataloader-pdf), DOCX/PDF export
- Spec pipeline, clarify interview, planted-gap corpus
- **Token benchmark on the Claude subscription**, including every arm in §5

### Class B: testable here with local stand-ins (rehearsal only; repeat in your environment)

| Your system | Stand-in here |
|---|---|
| Self-managed GitLab + runner + MCP issue/MR flow | GitLab CE container + runner |
| Nexus (npm/Maven/PyPI/raw) | Nexus OSS container |
| OpenShift + GitOps | kind + Argo CD (OpenShift-specific SCC/Route checked at manifest level only) |
| Vault | Vault dev mode |
| In-house IdP | Keycloak |
| DefectDojo / Dependency-Track | Their Docker Compose stacks |

### Class C: only in your environment (you said these go straight to production testing)

- **Bedrock ap-south-1:** model availability, residency, cost, the Bedrock confirmation benchmark
- **Your GitLab, Nexus, corporate proxy and CA**; the Windows workstation install
- OpenShift `restricted-v2` SCC, Routes, the GitOps operator, real Vault, Oracle schemas
- The in-house IdP; your Figma files through the Figma MCP with your seats
- Pen-test sign-off, legal DPDP review, the pilot team

### Decisions (2026-10-18)

| Topic | Decision |
|---|---|
| Class B stand-ins | **All** (GitLab CE + runner, Nexus OSS, kind + Argo CD, Vault dev, Keycloak, DefectDojo/Dependency-Track) are rehearsed here; your environment stays authoritative |
| Benchmark size (subscription) | **Medium:** ~15 tasks × 3 runs × ~11 arms, spread over several days |
| Class C acceptance kit | Run by **Paresh** directly; reports shared back |
| Tool selection | Accepted **with changes**; changes pending |

**Delivery approach for Class C:** eco-forge ships an **acceptance kit**:
- `eco-forge doctor --report` and `eco-forge verify <area>` scripts;
- a step-by-step runbook;
- each check emits a pass/fail report you can send back, so failures can be fixed without me having access to your environment.
