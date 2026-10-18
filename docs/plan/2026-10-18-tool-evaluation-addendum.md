# Tool-evaluation addendum — 6 new candidates (2026-10-18)

Evaluated against the same bar as the main eval: **license permits internal enterprise use**,
**telemetry can be disabled**, **DPDP/data residency** (any LLM backend must be pointable at Bedrock
ap-south-1; no code/PII to third-party clouds), and **fit** (does it add something the ecosystem
lacks). Verdicts are provisional — each must still pass the 3-axis skill-evaluation method before
becoming a default. "Unverified" means not confirmable from public docs yet; confirm in source.

| # | Tool | What it is | License | DPDP / residency | Verdict |
|---|------|-----------|---------|------------------|---------|
| 1 | **Cloudflare security-audit skill** | Agent Skill: multi-phase (recon→hunt→validate→report→verify) code security audit via parallel sub-agents; emits `findings.json` + `REPORT.md` | MIT (confirm repo LICENSE) | ✅ Skill-only, runs on **your** Bedrock model; no Cloudflare cloud calls | **ADOPT (pilot)** |
| 2 | **cognee** | Self-hosted AI memory / knowledge-graph (entities+relations, vector+graph store; MCP server) | Apache-2.0 | 🟡 Can run local extraction/embeddings; Bedrock provider + telemetry-disable **unverified** | **CHALLENGER** |
| 3 | **DeerFlow** (ByteDance) | LangGraph multi-agent deep-research "SuperAgent" harness; self-hostable (Docker+Helm) | MIT | 🟡 OpenAI-compatible; Bedrock unverified. ByteDance provenance = procurement/trust friction | **LATER** |
| 4 | **qm** (`yc-software/qm`) | **Identified.** A *multiplayer agent harness for work* — Slack + web, run in your own cloud with your own models/keys; per-person/room scoped memory, files, keychain, permissions, crons, web apps, sandboxes. Harness-agnostic (Pi + Claude Code drive the same core). NOT a coding-quality or security tool — a team **delivery/collaboration platform**. | MIT | ✅ Self-hostable, your own models (Bedrock via "your own models"); Slack + keychain need a security review | **LATER (different layer)** — evaluate as a team-deployment substrate, not a token/gate tool |
| 5 | **KSoR** (`panaversity/ksor`) | **Confirmed.** "Knowledge System of Record" — governed knowledge-platform SDK (NOT a pentest tool) | Apache-2.0 | 🟡 niche/early | **LATER** — overlaps cognee; prefer cognee as the memory candidate |
| 6 | **Strix** | Autonomous AI pentest agent: Docker-local team of agents that chain offensive tools + attempt real PoC exploitation | Apache-2.0 | ✅ Docker-local, LiteLLM→**Bedrock** supported; telemetry switch unverified | **CHALLENGER (gated)** |

## Notes that change the security posture
- **Strix is the most consequential.** It *actively exploits*. Authorization is **policy/config only,
  not hard technical enforcement** — so eco-forge must constrain it: run **only** against an
  owned/authorized, pre-prod target, in the QA-Security environment, with scope pinned and budgets
  set, never against prod or anything outside written scope. This matches how we already scope-lock
  nuclei/sqlmap/ffuf (Class-C, QA-Security only). Pin the LLM backend to Bedrock ap-south-1; confirm
  no telemetry in source before any adoption.
- **Cloudflare security-audit skill** is the easy win: it is just a skill on your own model, MIT, and
  complements (doesn't replace) the deterministic SAST/SCA gates — it adds an LLM "hunting" pass that
  produces a validated findings list. Pilot it as an additional reviewer, not a gate.
- **cognee vs KSoR**: both are memory/knowledge-graph; cognee is far more mature → cognee is the
  memory CHALLENGER, KSoR parked. This feeds the still-open "repo-as-memory vs a graph store"
  question from the main design.
- **DeerFlow** overlaps eco-forge's own delivery-planner orchestration; no need now.

## How each will be evaluated (ties to the skill-evaluation method doc)
- **Cloudflare skill** → run on the planted-defect golden repo; deterministic grader: its
  `findings.json` must contain the seeded SQLi/XSS/cmd-injection and must not flag the clean controls
  (true-positive + false-positive check, same as the catch-rate method). Token cost vs the gate.
- **Strix** → against the deliberately-vulnerable app in a sandbox, authorized scope only; grader:
  found the seeded vuln with a working PoC AND stayed in scope. Measure runtime + token/$.
- **cognee / KSoR** → retrieval eval: ingest repo + `docs/memory/decisions.md`, then Q&A cases whose
  graders check the correct fact/file is returned; Axis-3 benchmark arm = answer-with-memory vs cold.
- Before ANY production adoption, confirm the open items: cognee telemetry-disable env var + Bedrock
  provider; DeerFlow Bedrock; Strix telemetry switch + enforced scope; qm's Slack/keychain security
  model.

## Final conclusion — all six (identities resolved)
| Tool | GitHub | Category | License | Verdict |
|------|--------|----------|---------|---------|
| Cloudflare security-audit skill | github.com/cloudflare/security-audit-skill | Security (LLM code audit, skill) | MIT | **ADOPT (pilot)** — runs on your Bedrock; add as an extra reviewer, not a gate |
| Strix | github.com/usestrix/strix | Security (autonomous pentest) | Apache-2.0 | **CHALLENGER (gated)** — authorized pre-prod targets only; pin scope + Bedrock; confirm no telemetry |
| cognee | github.com/topoteretes/cognee | Memory / knowledge-graph | Apache-2.0 | **CHALLENGER** — verify telemetry-off + Bedrock before DPDP sign-off |
| qm | github.com/yc-software/qm | Team agent-delivery platform (Slack/web) | MIT | **LATER** — different layer (how the team runs agents); evaluate as deployment substrate, security-review Slack/keychain |
| KSoR | github.com/panaversity/ksor | Governed knowledge SDK | Apache-2.0 | **LATER** — overlaps cognee; cognee preferred |
| DeerFlow | github.com/bytedance/deer-flow | Multi-agent research harness | MIT | **LATER** — overlaps our orchestration; ByteDance trust/procurement friction |

**Net for eco-forge now:** one adopt-pilot (Cloudflare audit skill) and two security/memory challengers
(Strix, cognee) enter the evaluation pipeline via the 3-axis skill-evaluation method. qm, KSoR and
DeerFlow are parked as LATER — all three are MIT/Apache-2.0 and self-hostable (so not rejected), but
none fills a current gap: qm is a team-deployment layer (orthogonal to the config package), KSoR
overlaps cognee, and DeerFlow overlaps eco-forge's own delivery-planner orchestration.

_GitHub repos: cloudflare/security-audit-skill, usestrix/strix, topoteretes/cognee, yc-software/qm,
panaversity/ksor, bytedance/deer-flow._
