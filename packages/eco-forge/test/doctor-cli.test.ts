import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  compareVersions,
  doctorExitCode,
  extractVersion,
  formatDoctor,
  runDoctor,
  type Probe,
} from "../src/commands/doctor.js";
import { packageInfo } from "../src/core/package-info.js";
import { tempDir } from "./helpers.js";

const fakeProbe =
  (versions: Record<string, string>): Probe =>
  (command) =>
    versions[command];

const ALL_OK = { git: "2.43.0", java: "21.0.4", docker: "29.0.0", python3: "3.13.1", uv: "0.11.0", claude: "2.1.0", mvn: "3.9.11" };

describe("doctor", () => {
  it("passes when every tool meets its minimum", () => {
    const results = runDoctor(tempDir(), fakeProbe(ALL_OK), "22.23.3");
    assert.equal(doctorExitCode(results), 0, formatDoctor(results));
  });

  it("flags outdated and missing tools with hints", () => {
    const { java: _java, ...withoutJava } = ALL_OK;
    const results = runDoctor(tempDir(), fakeProbe({ ...withoutJava, python3: "3.9.0" }), "20.1.0");
    const byName = Object.fromEntries(results.map((r) => [r.name, r.status]));
    assert.equal(byName.node, "outdated");
    assert.equal(
      runDoctor(tempDir(), fakeProbe(ALL_OK), "22.22.0").find((r) => r.name === "node")?.status,
      "outdated",
      "Node 22.22.0 is below the Angular 22 minimum",
    );
    assert.equal(byName.java, "missing");
    assert.equal(byName.python, "outdated");
    assert.equal(doctorExitCode(results), 1);
    assert.match(formatDoctor(results), /MISSING .*java[\s\S]*-> Install JDK 21/);
  });

  it("falls back to alternative commands (podman, python)", () => {
    const { docker: _d, python3: _p, ...rest } = ALL_OK;
    const results = runDoctor(tempDir(), fakeProbe({ ...rest, podman: "5.0.0", python: "3.12.0" }), "22.22.3");
    assert.equal(doctorExitCode(results), 0);
  });

  it("accepts the project's Maven wrapper instead of a global Maven", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "mvnw"), "");
    const { mvn: _m, ...rest } = ALL_OK;
    const maven = runDoctor(dir, fakeProbe(rest), "22.23.3").find((r) => r.name === "maven");
    assert.equal(maven?.status, "ok");
  });

  it("parses and compares versions", () => {
    assert.equal(extractVersion('openjdk version "21.0.12.1" 2026-08-18'), "21.0.12");
    assert.equal(extractVersion("Python 3.13"), "3.13.0");
    assert.equal(extractVersion("no digits"), undefined);
    assert.ok(compareVersions("3.10.0", "3.9.0") > 0);
    assert.equal(compareVersions("21.0.0", "21.0.0"), 0);
  });
});

describe("cli (built)", () => {
  const cli = path.join(packageInfo().root, "dist", "cli.js");
  const run = (args: string[], entry = cli) => spawnSync(process.execPath, [entry, ...args], { encoding: "utf8" });

  it("prints the version", () => {
    const r = run(["--version"]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), packageInfo().version);
  });

  it("prints help, and exits 1 when no command is given", () => {
    assert.equal(run(["--help"]).status, 0);
    const r = run([]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Usage: eco-forge/);
  });

  it("works when launched through a symlink, as npm bins are", () => {
    const link = path.join(tempDir(), "eco-forge");
    symlinkSync(cli, link);
    assert.equal(run(["--version"], link).status, 0);
  });

  it("reports usage errors on stderr with exit code 1", () => {
    for (const args of [["frobnicate"], ["init", "extra"], ["--no-such-flag"]]) {
      const r = run(args);
      assert.equal(r.status, 1, args.join(" "));
      assert.match(r.stderr, /^eco-forge: /);
    }
  });

  it("refuses the subscription provider for client data", () => {
    const r = run(["init", "--dir", tempDir(), "--provider", "subscription"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /synthetic data only/);
  });

  it("emits machine-readable JSON for init", () => {
    const r = run(["init", "--dir", tempDir(), "--provider", "subscription", "--classification", "synthetic", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout) as { actions: { kind: string; dest: string }[]; exitCode: number };
    assert.ok(parsed.actions.some((a) => a.dest === "CLAUDE.md" && a.kind === "create"));
  });

  it("prints a human summary for init and JSON for doctor", () => {
    const dir = tempDir();
    const human = run(["init", "--dir", dir, "--provider", "subscription", "--classification", "synthetic"]);
    assert.match(human.stdout, /create +CLAUDE\.md/);
    const doctor = run(["doctor", "--dir", dir, "--json"]);
    assert.ok(Array.isArray(JSON.parse(doctor.stdout)));
  });
});
