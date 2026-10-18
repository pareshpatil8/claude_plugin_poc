# How eco-forge proves its skills/agents/commands actually work

A skill, subagent or command is a *prompt*, not code — so "does it work?" can't be answered by a unit
test alone. eco-forge evaluates every one of its skills on three independent axes, and nothing is a
default until it passes all three.

## Axis 1 — Static health (`/skill-doctor` + lint)
Cheap, no model. Checks each skill/agent/command file is structurally valid before it can regress
anything:
- frontmatter present and valid (`name`, `description`, and for agents `tools`/`model`);
- `description` actually contains its trigger phrases (so the model will route to it);
- tool allowlist is a subset of what the agent is permitted (no agent can reach prod/secrets/PII);
- referenced files/commands exist; no broken `@file` includes.
This is wired as a repo check (`scripts/skill-doctor`-style) and runs in CI on every change.

## Axis 2 — Behavioural evals (`claude plugin eval`) — the core
Claude Code ships a first-class eval runner. Each eco skill gets an eval suite under
`evals/<skill>/`, where a case is either a `case.yaml` or a `prompt.md` + `graders/*.md`:

```
packages/eco-forge/evals/
  eco-spec-lint/
    case-ambiguous-req/
      prompt.md         # the input: a BRD snippet with a known ambiguity
      graders/
        flags-it.md     # grader: did the output flag the ambiguous requirement?
        no-false-pos.md # grader: did it leave the well-formed requirements alone?
```

- A **grader** is an LLM-judge (or a deterministic script) that answers one yes/no question about the
  run's output. A case passes only when every grader passes.
- Run locally or in CI: `claude plugin eval --eval-dir packages/eco-forge/evals` → a JSON report
  (pass/fail per case + grader) that gates the merge.
- This proves the *behaviour*: the skill fires on the right prompt, produces the expected structured
  artifact, and does NOT fire/misfire on the wrong one.

We prefer **deterministic graders wherever the output is checkable by a real tool** (the whole
eco-forge philosophy): e.g. eco-spec-lint's output is scored by `eco-forge-spec-lint` itself; a
`/eco-dev` run is scored by the gate chain + `./mvnw test`; trace-check by `eco-forge-trace`. LLM-judge
graders are used only for genuinely subjective checks (tone, clarity), and even then paired with a
deterministic one.

## Axis 3 — Outcome/regression evals (the token benchmark we already built)
`eco-forge-bench` is the behavioural eval at the *outcome* level: for a real task it measures
**pass rate** (did the gates/tests pass) and **tokens per passing task** against a baseline, across
reps, with a resumable ledger. This is how we proved context-mode/ponytail/rtk and how any new skill
must justify itself: **it may not lower the pass rate, and its token cost must be worth it.** A skill
that passes Axis 2 but regresses Axis 3 is not promoted to default.

## The bar for "default ON"
1. `/skill-doctor` + lint clean (Axis 1), in CI.
2. Every eval case + grader green (Axis 2), in CI.
3. Benchmark: pass rate ≥ baseline and token delta acceptable for its task profile (Axis 3).
4. For security skills additionally: proven on the planted-defect fixtures (true-positive) AND on
   clean code (no false-positive) — the same catch-rate method already used for the SAST/SCA gates.

## Applying this to the new candidates (see tool-evaluation addendum)
- **Cloudflare security-audit skill** → Axis 2 eval = run it on the planted-defect golden repo;
  deterministic grader = its `findings.json` must contain the known SQLi/XSS/cmd-injection and must
  NOT flag the clean controls. Axis 3 = token cost per audit vs our Semgrep/SpotBugs gate.
- **Strix** (pentest agent) → scored against a deliberately-vulnerable, authorized target (e.g. the
  planted-defect app in a sandbox): grader = did it find the seeded vuln with a PoC, and stay in
  scope. Never run against anything but an owned/authorized target.
- **cognee / KSoR** (memory) → evaluated by a *retrieval* eval: after ingesting the repo + decisions,
  a set of Q&A cases whose graders check the right fact/file is returned, plus the token cost of
  answering-with-memory vs answering-cold (an Axis-3 benchmark arm).
- **caveman** (orchestration compaction) → the multi-agent benchmark arm now being built: measure
  subagent→orchestrator report tokens with vs without it, pass rate unchanged.

Every candidate enters as a benchmark arm / eval suite first; none becomes a default on a vendor's
claim.
