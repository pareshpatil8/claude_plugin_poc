import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatInitResult, runInit } from "../src/commands/init.js";
import { ManifestError, MANIFEST_PATH } from "../src/core/manifest.js";
import { copyTemplates, snapshot, SYNTHETIC, tempDir } from "./helpers.js";

const init = (dir: string, extra: Partial<Parameters<typeof runInit>[0]> = {}) =>
  runInit({ dir, dryRun: false, force: false, ...SYNTHETIC, ...extra });

const kinds = (result: ReturnType<typeof runInit>) =>
  Object.fromEntries(result.actions.map((a) => [a.file.dest, a.kind]));

describe("init on a fresh project", () => {
  it("creates every profile file plus the manifest", () => {
    const dir = tempDir();
    const result = init(dir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.actions.every((a) => a.kind === "create"));
    for (const action of result.actions) {
      assert.ok(existsSync(path.join(dir, action.file.dest)), action.file.dest);
    }
    const manifest = JSON.parse(readFileSync(path.join(dir, MANIFEST_PATH), "utf8"));
    assert.equal(Object.keys(manifest.files).length, result.actions.length);
    assert.equal(manifest.profile, "springboot-angular");
  });

  it("renders the project name and leaves no unresolved placeholders", () => {
    const dir = tempDir();
    init(dir, { name: "Payments Portal" });
    const files = snapshot(dir);
    assert.match(files["CLAUDE.md"] ?? "", /^# payments-portal/);
    for (const [file, content] of Object.entries(files)) {
      assert.doesNotMatch(content, /\{\{/, `unresolved placeholder in ${file}`);
    }
  });

  it("writes valid JSON for every generated JSON file", () => {
    const dir = tempDir();
    init(dir);
    for (const file of [".claude/settings.json", ".mcp.json", "eco.config.json", MANIFEST_PATH]) {
      assert.doesNotThrow(() => JSON.parse(readFileSync(path.join(dir, file), "utf8")), file);
    }
  });
});

describe("idempotency", () => {
  it("a second run changes nothing", () => {
    const dir = tempDir();
    init(dir);
    const before = snapshot(dir);
    const second = init(dir);
    assert.ok(second.actions.every((a) => a.kind === "unchanged"), JSON.stringify(kinds(second)));
    assert.deepEqual(snapshot(dir), before);
  });

  it("keeps the first-run greenfield classification on later runs", () => {
    const dir = tempDir();
    init(dir);
    assert.equal(kinds(init(dir))["eco.config.json"], "unchanged");
    const config = JSON.parse(readFileSync(path.join(dir, "eco.config.json"), "utf8"));
    assert.equal(config.codebase, "greenfield");
  });

  it("treats a CRLF-converted checkout as unchanged", () => {
    const dir = tempDir();
    init(dir);
    const file = path.join(dir, "CLAUDE.md");
    writeFileSync(file, readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
    assert.equal(kinds(init(dir))["CLAUDE.md"], "unchanged");
  });
});

describe("local edits and conflicts", () => {
  it("keeps a managed file the user edited, and keeps tracking it", () => {
    const dir = tempDir();
    init(dir);
    const file = path.join(dir, "eco.gates.yaml");
    writeFileSync(file, "# team edit\n");
    const result = init(dir);
    assert.equal(kinds(result)["eco.gates.yaml"], "keep-modified");
    assert.equal(readFileSync(file, "utf8"), "# team edit\n");
    const manifest = JSON.parse(readFileSync(path.join(dir, MANIFEST_PATH), "utf8"));
    assert.ok(manifest.files["eco.gates.yaml"], "edited file must stay in the manifest");
  });

  it("does not overwrite a pre-existing unmanaged file and exits with code 2", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "CLAUDE.md"), "# our own notes\n");
    const result = init(dir);
    assert.equal(kinds(result)["CLAUDE.md"], "conflict");
    assert.equal(result.exitCode, 2);
    assert.equal(readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), "# our own notes\n");
    const manifest = JSON.parse(readFileSync(path.join(dir, MANIFEST_PATH), "utf8"));
    assert.equal(manifest.files["CLAUDE.md"], undefined);
  });

  it("adopts a pre-existing file that already matches", () => {
    const first = tempDir();
    init(first);
    const dir = tempDir();
    writeFileSync(path.join(dir, "eco.gates.yaml"), readFileSync(path.join(first, "eco.gates.yaml"), "utf8"));
    assert.equal(kinds(init(dir, { name: path.basename(first) }))["eco.gates.yaml"], "adopt");
  });

  it("--force replaces an unmanaged file and backs up the original", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "CLAUDE.md"), "# our own notes\n");
    const result = init(dir, { force: true });
    assert.equal(kinds(result)["CLAUDE.md"], "overwrite");
    assert.equal(result.exitCode, 0);
    assert.ok(result.backupDir);
    assert.equal(readFileSync(path.join(result.backupDir, "CLAUDE.md"), "utf8"), "# our own notes\n");
    assert.notEqual(readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), "# our own notes\n");
  });

  it("never follows a symlink, even with --force", () => {
    const dir = tempDir();
    const outside = path.join(tempDir(), "target.md");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, path.join(dir, "CLAUDE.md"));
    const result = init(dir, { force: true });
    assert.equal(kinds(result)["CLAUDE.md"], "conflict");
    assert.equal(readFileSync(outside, "utf8"), "outside\n");
  });

  it("reports a directory in the way as a conflict", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, "CLAUDE.md"));
    assert.equal(kinds(init(dir, { force: true }))["CLAUDE.md"], "conflict");
  });
});

describe("upgrades of untouched files", () => {
  it("updates a managed file when its template changes", () => {
    const templatesDir = copyTemplates();
    const dir = tempDir();
    init(dir, { templatesDir });
    const template = path.join(templatesDir, "springboot-angular", "docs", "adr", "README.md.tmpl");
    writeFileSync(template, `${readFileSync(template, "utf8")}\nNew guidance.\n`);
    const result = init(dir, { templatesDir });
    assert.equal(kinds(result)["docs/adr/README.md"], "update");
    assert.match(readFileSync(path.join(dir, "docs/adr/README.md"), "utf8"), /New guidance/);
  });
});

describe("formatInitResult", () => {
  it("summarises actions, reasons, warnings and conflicts", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "CLAUDE.md"), "# ours\n");
    const text = formatInitResult(runInit({ dir, dryRun: true, force: false }));
    assert.match(text, /dry run: nothing written/);
    assert.match(text, /conflict +CLAUDE\.md +\(unmanaged file/);
    assert.match(text, /warning: No Bedrock model IDs/);
    assert.match(text, /left unchanged because of conflicts/);
    assert.match(text, /no known stack \(brownfield\)/);
  });
});

describe("dry run", () => {
  it("writes nothing", () => {
    const dir = tempDir();
    const result = init(dir, { dryRun: true });
    assert.ok(result.actions.length > 0);
    assert.deepEqual(snapshot(dir), {});
  });
});

describe("guard rails", () => {
  it("rejects a corrupt manifest", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, ".eco"));
    writeFileSync(path.join(dir, MANIFEST_PATH), "{oops");
    assert.throws(() => init(dir), ManifestError);
  });

  it("rejects a manifest from a newer eco-forge", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, ".eco"));
    writeFileSync(
      path.join(dir, MANIFEST_PATH),
      JSON.stringify({ schemaVersion: 99, ecoForgeVersion: "9", profile: "springboot-angular", files: {} }),
    );
    assert.throws(() => init(dir), /newer eco-forge/);
  });

  it("refuses to switch profiles on an initialised project", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, ".eco"));
    writeFileSync(
      path.join(dir, MANIFEST_PATH),
      JSON.stringify({ schemaVersion: 1, ecoForgeVersion: "0", profile: "other", files: {} }),
    );
    assert.throws(() => init(dir, { profile: "springboot-angular" }), /initialised with profile "other"/);
  });

  it("rejects unknown profiles and missing directories", () => {
    assert.throws(() => init(tempDir(), { profile: "nope" }), /Unknown profile "nope"/);
    assert.throws(() => init(path.join(tempDir(), "missing")), /does not exist/);
  });

  it("warns when Bedrock models are not configured", () => {
    const result = runInit({ dir: tempDir(), dryRun: true, force: false });
    assert.ok(result.warnings.some((w) => /India data residency/.test(w)));
  });

  it("records brownfield projects in eco.config.json", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "pom.xml"), "<artifactId>spring-boot-starter-parent</artifactId>");
    init(dir);
    const config = JSON.parse(readFileSync(path.join(dir, "eco.config.json"), "utf8"));
    assert.equal(config.codebase, "brownfield");
  });
});
