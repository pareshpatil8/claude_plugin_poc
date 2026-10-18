import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { packageInfo } from "../src/core/package-info.js";

/** Every shipped agent/skill/command must install with valid, complete frontmatter. */
describe("build agents install correctly", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "eco-agents-"));
  execFileSync(process.execPath, [path.join(packageInfo().root, "dist", "cli.js"), "init", "--dir", dir, "--provider", "subscription", "--classification", "synthetic"], { stdio: "ignore" });

  const agentsDir = path.join(dir, ".claude", "agents");
  const agents = readdirSync(agentsDir);

  it("ships the core build + review agents", () => {
    for (const name of ["backend-dev.md", "frontend-dev.md", "test-designer.md", "code-reviewer.md",
      "security-reviewer.md", "deep-taint-reviewer.md", "product-analyst.md", "nfr-analyst.md",
      "integration-analyst.md", "privacy-reviewer.md", "solution-architect.md", "qa-uat-writer.md",
      "delivery-planner.md", "devops-engineer.md", "perf-engineer.md", "a11y-auditor.md", "pentest-assistant.md"]) {
      assert.ok(agents.includes(name), `missing ${name}`);
    }
  });

  it("every agent has name, description and a tools allowlist", () => {
    for (const file of agents) {
      const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path.join(agentsDir, file), "utf8"));
      assert.ok(fm, `${file}: no frontmatter`);
      const body = fm[1] as string;
      for (const key of ["name:", "description:", "tools:"]) {
        assert.ok(body.includes(key), `${file}: missing ${key}`);
      }
    }
  });

  it("read-only reviewers have no Write/Edit of code", () => {
    for (const name of ["code-reviewer.md", "security-reviewer.md", "deep-taint-reviewer.md"]) {
      const toolsLine = /tools:.*/.exec(readFileSync(path.join(agentsDir, name), "utf8"))?.[0] ?? "";
      assert.ok(!/\bEdit\b/.test(toolsLine) && !/\bWrite\b(?!\(docs)/.test(toolsLine), `${name} must not edit code`);
    }
  });

  it("delivery-planner is the orchestrator (has the Task tool, writes no app code)", () => {
    const body = readFileSync(path.join(agentsDir, "delivery-planner.md"), "utf8");
    const toolsLine = /tools:.*/.exec(body)?.[0] ?? "";
    assert.match(toolsLine, /\bTask\b/, "delivery-planner must be able to spawn agents");
    assert.match(body, /never write application code|do not implement application code|never write application/i);
  });

  it("devops-engineer owns infra paths; no dev agent does", () => {
    const devops = readFileSync(path.join(agentsDir, "devops-engineer.md"), "utf8");
    assert.match(devops, /helm\/|Dockerfile|argocd/i);
    const backend = readFileSync(path.join(agentsDir, "backend-dev.md"), "utf8");
    assert.match(backend, /[Nn]ever touch `helm\/`|never touch helm/i);
  });

  it("spec agents write only under docs", () => {
    for (const name of ["product-analyst.md", "solution-architect.md", "nfr-analyst.md", "qa-uat-writer.md"]) {
      const body = readFileSync(path.join(agentsDir, name), "utf8");
      assert.match(body, /only.*(docs|nfr\.md|uat\.md|integration)/i, `${name} should scope writes to docs`);
    }
  });

  it("backend-dev cannot edit infra paths (no Helm/Dockerfile in its tools)", () => {
    const backend = readFileSync(path.join(agentsDir, "backend-dev.md"), "utf8");
    assert.match(backend, /Edit/);
    assert.match(backend, /only `src\/main\/java`/);
  });

  it("installs the /eco:dev and /eco:bugfix commands and rules", () => {
    const commands = readdirSync(path.join(dir, ".claude", "commands"));
    assert.ok(commands.includes("eco-dev.md") && commands.includes("eco-bugfix.md"));
    const rules = readdirSync(path.join(dir, ".claude", "rules"));
    assert.ok(rules.includes("backend.md") && rules.includes("frontend.md"));
  });
});
