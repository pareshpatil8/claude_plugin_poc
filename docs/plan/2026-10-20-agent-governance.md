# Agent governance — design & open-source stack

Governance here means answering, auditably: **which agent or human did what, when; what was reviewed
and by whom; and what the quality/security outcome was** — queryable, tamper-evident, and entirely on
your own infra (DPDP). This doc separates what Claude Code gives natively from the thin layer
eco-forge must add, then names the self-hostable OSS backend (licenses verified).

## 1. What Claude Code already emits (native — just wire it to your infra)
| Capability | How | Governance value |
|------------|-----|------------------|
| **OpenTelemetry** | `CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_METRICS/LOGS_EXPORTER=otlp` + `OTEL_EXPORTER_OTLP_ENDPOINT=<your collector>` (set in **managed-settings `env`**; repo settings can't) | Cost per model **tagged with `agent.name`/`skill.name`/`mcp_tool.name`**, token usage, `tool_decision` (accept/reject + source + permission_mode), `tool_result` (success, duration), `commit.count`, `pull_request.count`; identity `session.id`/`user.email`/`organization.id`/`tool_use_id` |
| **Hooks as audit emitters** | `PreToolUse`/`PostToolUse`/`SubagentStart`/`SubagentStop`/`SessionEnd` receive JSON: `session_id`, `agent_id`, `agent_type`, `tool_name`, `tool_input`, `tool_use_id`, `tool_response`, `duration_ms`, `permission_mode` | Per-action "who did what" feed; `PreToolUse` can **gate** (exit 2 / `permissionDecision: deny`) |
| **Central policy** | `managed-settings.json` (`/etc/claude-code/…`) — `permissions.allow/ask/deny`, `disableBypassPermissionsMode`, `allowManagedHooksOnly`; client-enforced, repo can't override. On **Bedrock** this is the enforcement path (remote settings aren't fetched) | Provable "what agents may do"; verify via `/status`, `claude doctor`, `OTEL_LOG_MANAGED_SETTINGS` event |
| **Cost governance** | `-p --output-format json` `total_cost_usd`; `--max-budget-usd` cap; managed `modelPricing` for contracted rates; OTel `cost.usage` per agent | Chargeback + spend caps |
| **DPDP posture** | Content logging (`OTEL_LOG_USER_PROMPTS`/`_TOOL_DETAILS`/`_RAW_API_BODIES`) is **off by default** | Keep off → metadata-only telemetry, no prompt/code egress |

**Caveats:** transcript JSONL (`~/.claude/projects/.../<session>.jsonl`, subagents under `.../subagents/agent-<id>.jsonl`) is an **internal, unstable format — do not parse it as a contract**. No OTel event was confirmed to carry `agent_id` (correlate via `tool_use_id`/`session.id`). GitLab full audit-event streaming is a **paid tier** — verify your edition.

## 2. The gap eco-forge fills (the thin layer we own)
There is **no single native record** that joins identity + agent name + tool input + permission
decision **+ your REQ-ID + the gate outcome + the human approver**. eco-forge adds an **append-only
governance ledger**, written by a governance hook + the gate CLIs + the delivery-planner, DPDP-safe
(digests, not content):

```jsonc
// .eco/governance/ledger.jsonl — one line per governed action
{
  "ts": "2026-10-20T10:00:00Z", "session_id": "...", "run_id": "...",
  "reqIds": ["REQ-014"],
  "actor": { "kind": "agent", "agentName": "backend-dev", "agentId": "..." },  // or kind:"human", userEmail
  "action": "tool_use",                 // tool_use | subagent_stop | gate | waiver | review | merge
  "tool": "Edit", "toolUseId": "...", "decision": "allow", "durationMs": 1200,
  "gate":   { "name": "semgrep", "status": "pass", "newFindings": 0 },        // when action=gate
  "waiver": { "fingerprint": "...", "approver": "alice", "reason": "...", "expires": "2026-12-01" },
  "review": { "reviewer": "code-reviewer", "verdict": "changes-requested" },
  "artifact": { "commit": "abc123", "mrUrl": "https://gitlab/.../merge_requests/42" },
  "evidenceDigest": "sha256:…"          // hash of detail, never the content (DPDP)
}
```
- **Emitters:** a `PreToolUse`/`PostToolUse`/`SubagentStop` governance hook (reuses the eco-forge-guard
  plumbing); the gate CLIs append a `gate`/`waiver` record each run; the delivery-planner appends
  `review`/task-state/`merge` records. Correlates to Claude Code's OTel by `session_id`+`toolUseId`.
- **Sinks:** local JSONL (committed per feature for traceability) → shipped to OTel + a GitLab issue
  note per task; optionally mirrored into Langfuse as scores.
- This reuses data eco-forge **already produces**: waivers (approver/reason/expiry≤90d), gate SARIF
  verdicts, trace-check (REQ→code→test→UAT), per-agent tool allowlists, commit `Co-Authored-By`.

## 3. Recommended open-source backend (self-hosted, DPDP, licenses verified)
| Layer | Tool | License | Why |
|-------|------|---------|-----|
| **Agent observability & evals (system of record)** | **Langfuse** | **MIT core** (ee/ folder EE-gated, not needed) | Per-agent/session traces, token/cost, tool calls, scores; ingests OTLP GenAI spans; native Bedrock; Helm on OpenShift |
| **Vendor-neutral span source** | **Traceloop OpenLLMetry** | **Apache-2.0** | Emits standard OTel GenAI spans from Claude Code + Bedrock → Langfuse (avoids lock-in) |
| **Signed step attestation ("who/what did each step")** | **Tekton Chains + cosign/Sigstore** | **Apache-2.0** | On OpenShift Pipelines, auto-signs SLSA/in-toto provenance per build/test/review step; Rekor = tamper-evident log. Native OpenShift path |
| **Policy-as-code (what agents may do, provable)** | **OPA + Rego** (+ **Conftest** in GitLab CI, **Kyverno** for OpenShift admission) | **Apache-2.0** | Gate agent tool calls + CI steps + manifests with provable allow/deny |
| **Security/quality finding systems of record** | **DefectDojo** (findings) + **Dependency-Track** (SBOM risk) | **BSD-3** / **Apache-2.0** | Outcomes over time; already in our stack |

**Optional unified event store:** OTel → **Grafana Tempo/Loki/Mimir** for one queryable
who-did-what-when timeline — but these are **AGPL-3.0** (fine for internal self-host; flag to legal).
If you'd rather avoid AGPL, Langfuse + GitLab + Rekor already cover the audit timeline.

### License flags to escalate to legal
- **Arize Phoenix** (an alternative to Langfuse) = **Elastic License 2.0** — internal self-host OK, no reselling. Not in the core pick for that reason.
- **SonarQube Community** = **LGPL-3.0** (copyleft; standalone service fine). Community analyses main branch only.
- **Grafana Loki/Tempo/Mimir** = **AGPL-3.0**. **GitLab audit-event streaming** = paid tier.
- Everything in the recommended core (Langfuse, OpenLLMetry, Tekton Chains, cosign, OPA, Dependency-Track) is **MIT/Apache-2.0**; DefectDojo is **BSD-3**.

## 4. How it maps to the three governance questions
1. **Who did what** → governance hook events (agent/human + tool + REQ-ID) + OTel (`agent.name`, cost) + signed commits.
2. **What was reviewed, by whom** → delivery-planner `review` records + GitLab MR approvals + Tekton Chains provenance of the review step.
3. **Quality/security outcome** → gate `gate`/`waiver` records + DefectDojo/Dependency-Track + Langfuse scores, all tied to the REQ-ID and the MR/commit.

## 5. Rollout (incremental, each step independently useful)
1. **Now (package-side, ~2–3 days):** build the eco-forge **governance hook + ledger** (reusing the
   guard hook) and have the gate CLIs + delivery-planner append records. Ship `managed-settings.json`
   templates (central policy) and the OTel `env` block.
2. **Pre-prod (your infra):** stand up **Langfuse (Helm)** + point `OTEL_EXPORTER_OTLP_ENDPOINT` at it;
   enable **Tekton Chains + cosign** on your OpenShift Pipelines; wire **OPA/Conftest** into GitLab CI.
   The acceptance kit gains checks for each endpoint.
3. **Steady state:** governance ledger per feature + Langfuse dashboards (cost/agent) + signed
   provenance per release + DefectDojo/Dependency-Track trends = full, queryable, tamper-evident
   governance — no data leaving your network.

## Appendix — ready-to-use config

**Governance hook (shipped by eco-forge, wired automatically by `init`):** `settings.json` gets
`PostToolUse` / `SubagentStop` / `SessionEnd` → `eco-forge-govern hook`, which appends to
`.eco/governance/ledger.jsonl`. CI steps add outcomes:
```
eco-forge-govern record --gate semgrep:pass --new 0
eco-forge-govern record --review code-reviewer:approved
eco-forge-govern record --waiver <fp> --approver alice --reason "FP" --expires 2026-12-01
eco-forge-govern record --merge <commit> --mr <gitlab-mr-url>
eco-forge-govern report            # by actor, by event, gate/review timeline
```
Set `ECO_REQ_IDS="REQ-014 REQ-015"` in the pipeline so every event is REQ-tagged.

**`/etc/claude-code/managed-settings.json` (ops installs — central, repo can't override; the Bedrock
enforcement + telemetry path). Keep OTEL_LOG_* OFF for DPDP (metadata only):**
```json
{
  "permissions": { "defaultMode": "manual", "disableBypassPermissionsMode": "disable" },
  "allowManagedHooksOnly": true,
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel-collector.your-infra.internal:4317",
    "OTEL_RESOURCE_ATTRIBUTES": "service.name=eco-forge,deployment.environment=preprod"
  }
}
```
Point `OTEL_EXPORTER_OTLP_ENDPOINT` at your in-cluster collector (feeds Langfuse / Tempo). Nothing
leaves your network; no prompt/code content is exported.

_Grounding: Claude Code docs (monitoring-usage, hooks, managed-settings, sub-agents, costs) verified
2026-10-20; OSS licenses verified against project repos (Langfuse MIT, OpenLLMetry/Tekton Chains/
cosign/OPA/Dependency-Track Apache-2.0, DefectDojo BSD-3)._
