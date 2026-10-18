# Six-tool pilot matrix

Goal: pilot the six new candidates. Reality: they are **different categories measured on different
metrics**, and only one runs on this environment's Claude Code **subscription** path. The others use
their own LLM backend via LiteLLM (need a raw API key this env doesn't expose — `ANTHROPIC_API_KEY`
is absent and the container's AWS creds are out of scope for arbitrary tool LLM calls), or need
Docker / Node 24 / AWS+Slack. So this is an honest **pilot-readiness matrix**, not a single token
table: one real quantitative pilot (Cloudflare) + evidence-based status + the exact unblock for each.

## Environment facts (measured here)
Node 22.22 · Python 3.13 · uv present (pipx absent) · Docker installed, **daemon down** ·
`ANTHROPIC_API_KEY` **absent** · subscription drives nested `claude -p`.

## The matrix
| Tool | Category | Metric that fits it | Runs on subscription? | Live-pilotable here? | Blocker / unblock |
|------|----------|---------------------|-----------------------|----------------------|-------------------|
| **Cloudflare security-audit skill** | LLM code audit (skill) | catch-rate on planted defects (TP) + false-positives on clean | ✅ yes (pure skill) | ✅ **PILOTED** (result below) | none |
| **Strix** | Autonomous pentest agent | seeded-vuln found w/ PoC + stayed in scope | ❌ LiteLLM, own key | ⚠️ install-only | needs Docker daemon + `ANTHROPIC_API_KEY`/Bedrock + an authorized target; pilot in QA-Security env |
| **cognee** | Memory / knowledge-graph | retrieval accuracy + answer-with-memory vs cold tokens | ❌ LiteLLM for answers | ⚠️ retrieval-only smoke possible | answer-gen needs an LLM key; heavy model download — pilot where key + disk available |
| **DeerFlow** | Multi-agent research harness | research-task quality/token | ❌ LiteLLM, own key | ❌ no | Docker + LLM key; overlaps our orchestration — low priority |
| **qm** | Team agent-delivery platform | n/a (deployment layer) | n/a | ❌ no | Node ≥24.15 + AWS + Slack app; it is infra, not a gate — evaluate as a rollout substrate |
| **KSoR** | Governed-knowledge SDK | retrieval accuracy | partial (Node SDK) | ⚠️ needs Node 24 | Node-24 class runtime (here: 22.22); niche, overlaps cognee |

## Pilot 1 — Cloudflare security-audit skill (REAL, on the subscription)
**Setup:** a workspace of the known-vulnerable planted-defect files (ground truth: SQLi, PII-in-logs,
broken-access-control/permitAll, 2× XSS) with the skill installed in `.claude/skills/security-audit`;
one `claude -p` full-audit run; grader = does the audit's findings identify each seeded class, and
does it avoid inventing issues.

**Result: 5/5 catch rate, 0 false positives, $0.22, 8 turns.** The audit produced exactly five
findings — one per seeded defect — and invented nothing:

| Seeded defect (ground truth) | Found? | Finding title it wrote |
|------------------------------|--------|------------------------|
| SQLi (JPQL string concat) | ✅ | "JPQL built by string concatenation in Defects.sqli" |
| PII in logs (DPDP) | ✅ | "Applicant email written to application log" |
| Broken access control (permitAll) | ✅ | "permitAll on /api/admin in SecurityConfigBad" |
| XSS — bypassSecurityTrust | ✅ | "Angular HTML sanitizer bypass in Defects.danger" |
| XSS — innerHTML binding | ✅ | "innerHTML binding of userContent" |

Findings were written to a schema-shaped `findings.json`. Verdict: **ADOPT confirmed** — slots in as
an extra LLM "hunting" reviewer alongside the deterministic Semgrep/SpotBugs gates (it complements,
it does not replace them; it is advisory, not a hard gate). It matched our existing SAST catch rate
on this fixture at low cost, running entirely on your own model.

## What a complete pilot of the rest needs (so it's reproducible elsewhere)
- **Strix**: start Docker daemon; `uv tool install strix` (or pipx); set `LLM_API_BASE`+key to your
  Bedrock ap-south-1; point it at the planted-defect app in a sandbox with scope pinned; grade on
  seeded-vuln discovery + staying in scope. **Never** against prod or unauthorized targets.
- **cognee**: `uv pip install cognee`; ingest the golden repo + `docs/memory/decisions.md`; a local
  index/search smoke needs no key; the answer-accuracy pilot needs an LLM pointed at Bedrock.
- **DeerFlow / qm / KSoR**: environment-bound (Docker+LLM / AWS+Slack+Node24 / Node24). Pilot when
  that environment exists; all three are LATER per the eval addendum anyway.

## Honest bottom line
Of the six, exactly one (**Cloudflare security-audit skill**) is both in-scope and runnable on this
subscription environment, so it is the one genuinely piloted. The other five are not tool failures —
each is blocked by a credential (raw LLM key), a runtime (Node 24), or a platform (Docker daemon /
AWS+Slack) this subscription-testing container deliberately does not provide. They are ready to pilot
in the Bedrock/QA-Security environment with the one-line unblock listed above.
