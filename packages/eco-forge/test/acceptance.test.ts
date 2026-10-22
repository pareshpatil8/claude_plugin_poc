import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { realProbe } from "../src/acceptance/cli.js";
import { CHECKS, formatMarkdown, runKit, type Probe } from "../src/acceptance/kit.js";

function probe(overrides: Partial<Probe> = {}): Probe {
  return {
    which: () => null,
    version: () => null,
    envSet: () => false,
    envValue: () => undefined,
    httpStatus: async () => null,
    fileExists: () => false,
    ...overrides,
  };
}

describe("acceptance kit", () => {
  it("fails blockers in a bare environment and reports NOT-READY", async () => {
    const report = await runKit(probe());
    assert.equal(report.verdict, "NOT-READY");
    assert.ok(report.summary.blockersFailed > 0);
    // residency blocker fails when Bedrock is not configured
    const res = report.results.find((r) => r.id === "res-bedrock");
    assert.equal(res?.status, "fail");
  });

  it("passes residency when Bedrock + ap-south-1 + in-region models", async () => {
    const env: Record<string, string> = {
      CLAUDE_CODE_USE_BEDROCK: "1",
      AWS_REGION: "ap-south-1",
      ANTHROPIC_MODEL: "apac.anthropic.claude-sonnet-4-v1", // cross-region — should trip the other check
    };
    const p = probe({ envValue: (n) => env[n], envSet: (n) => env[n] !== undefined });
    const report = await runKit(p);
    assert.equal(report.results.find((r) => r.id === "res-bedrock")?.status, "pass");
    assert.equal(report.results.find((r) => r.id === "res-no-cross-region")?.status, "fail"); // apac. prefix
  });

  it("passes residency via an on-box gateway (loopback base URL + AWS_PROFILE) to Bedrock ap-south-1", async () => {
    const env: Record<string, string> = {
      ANTHROPIC_BASE_URL: "http://127.0.0.1:8787",
      AWS_PROFILE: "bedrock-NGCBMGMT-Other",
      AWS_REGION: "ap-south-1",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "arn:aws:bedrock:ap-south-1:124727572053:application-inference-profile/c46mcskdc3n5",
    };
    const p = probe({ envValue: (n) => env[n], envSet: (n) => env[n] !== undefined });
    const report = await runKit(p);
    assert.equal(report.results.find((r) => r.id === "res-bedrock")?.status, "pass");
    assert.equal(report.results.find((r) => r.id === "res-no-cross-region")?.status, "pass");
  });

  it("fails residency for a REMOTE proxy base URL (could route out of India)", async () => {
    const env: Record<string, string> = { ANTHROPIC_BASE_URL: "https://proxy.example.com", AWS_PROFILE: "x", AWS_REGION: "ap-south-1" };
    const p = probe({ envValue: (n) => env[n], envSet: (n) => env[n] !== undefined });
    const report = await runKit(p);
    assert.equal(report.results.find((r) => r.id === "res-bedrock")?.status, "fail");
  });

  it("skips (not fails) optional endpoints that are not configured", async () => {
    const report = await runKit(probe());
    const gitlab = report.results.find((r) => r.id === "plat-gitlab");
    assert.equal(gitlab?.status, "skip");
    assert.equal(gitlab?.severity, "warn");
  });

  it("flags a prod oc context as a blocker failure", async () => {
    const p = probe({ which: (c) => (c === "oc" ? "/usr/bin/oc" : null), version: () => "prod-cluster/api" });
    const report = await runKit(p);
    assert.equal(report.results.find((r) => r.id === "plat-oc-devonly")?.status, "fail");
  });

  it("realProbe.version captures tools that print the version to stderr and exit 0 (regression: java -version)", () => {
    // node --version -> stdout
    assert.match(realProbe.version("node", ["--version"]) ?? "", /^v\d+\./);
    // a program that writes to stderr and exits 0 (like `java -version`) must still be captured
    const stderrVersion = realProbe.version(process.execPath, ["-e", "process.stderr.write('tool 21.0.0\\n')"]);
    assert.equal(stderrVersion, "tool 21.0.0");
    // a missing executable returns null, not a throw
    assert.equal(realProbe.version("definitely-not-a-real-binary-xyz", ["--version"]), null);
  });

  it("markdown report includes the verdict and a row per check", async () => {
    const report = await runKit(probe());
    const md = formatMarkdown(report);
    assert.match(md, /Verdict: \*\*NOT-READY\*\*/);
    for (const c of CHECKS) {
      assert.ok(md.includes(c.title), `missing row: ${c.title}`);
    }
  });
});
