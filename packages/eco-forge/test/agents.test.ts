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
    for (const name of ["backend-dev.md", "frontend-dev.md", "test-designer.md", "code-reviewer.md"]) {
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

  it("read-only reviewer has no Write/Edit tool", () => {
    const reviewer = readFileSync(path.join(agentsDir, "code-reviewer.md"), "utf8");
    const toolsLine = /tools:.*/.exec(reviewer)?.[0] ?? "";
    assert.ok(!/\b(Write|Edit)\b/.test(toolsLine), "code-reviewer must be read-only");
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
