import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPolicy, type Waiver } from "../src/gates/policy.js";
import { fingerprints, parseSarif, reduce, type Finding } from "../src/gates/sarif.js";

const sarif = (results: unknown[], name = "semgrep") =>
  JSON.stringify({ runs: [{ tool: { driver: { name } }, results }] });

const result = (ruleId: string, level: string, uri: string, line: number, extra: object = {}) => ({
  ruleId,
  level,
  message: { text: `${ruleId} finding` },
  locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
  ...extra,
});

describe("parseSarif", () => {
  it("maps SARIF levels to severities and builds fingerprints", () => {
    const findings = parseSarif(sarif([result("sqli", "error", "src/A.java", 10)]));
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.severity, "high");
    assert.equal(findings[0]?.fingerprint, "semgrep:sqli:src/A.java:10");
  });
  it("prefers CVSS security_severity when present", () => {
    const findings = parseSarif(sarif([result("x", "warning", "a.ts", 1, { properties: { security_severity: "9.1" } })]));
    assert.equal(findings[0]?.severity, "critical");
  });
  it("strips file:// and ./ prefixes and truncates long messages", () => {
    const findings = parseSarif(sarif([result("r", "note", "file://./src/b.ts", 2)]));
    assert.equal(findings[0]?.file, "src/b.ts");
    assert.equal(findings[0]?.severity, "low");
  });
});

describe("reduce", () => {
  const findings: Finding[] = [
    { tool: "t", ruleId: "a", severity: "medium", message: "m", file: "f", line: 1, fingerprint: "fp-med" },
    { tool: "t", ruleId: "b", severity: "critical", message: "m", file: "f", line: 2, fingerprint: "fp-crit" },
    { tool: "t", ruleId: "a", severity: "medium", message: "m", file: "f", line: 1, fingerprint: "fp-med" }, // dup
  ];
  it("drops duplicates and sorts by severity", () => {
    const { newFindings, duplicates } = reduce(findings);
    assert.equal(duplicates, 1);
    assert.deepEqual(newFindings.map((f) => f.severity), ["critical", "medium"]);
  });
  it("suppresses baseline fingerprints (new-only)", () => {
    const { newFindings, suppressedByBaseline } = reduce(findings, new Set(["fp-med"]));
    assert.equal(suppressedByBaseline, 2); // both copies of the baselined fingerprint are suppressed
    assert.deepEqual(newFindings.map((f) => f.fingerprint), ["fp-crit"]);
  });
  it("fingerprints() returns a sorted unique set for use as the next baseline", () => {
    assert.deepEqual(fingerprints(findings), ["fp-crit", "fp-med"]);
  });
});

describe("applyPolicy", () => {
  const config = { blockSeverities: ["critical", "high"] as const, requireApprover: true, requireExpiry: true, maxDurationDays: 90 };
  const crit: Finding = { tool: "t", ruleId: "r", severity: "critical", message: "m", file: "f", line: 1, fingerprint: "fp1" };
  const med: Finding = { tool: "t", ruleId: "r", severity: "medium", message: "m", file: "f", line: 2, fingerprint: "fp2" };
  const now = new Date("2026-10-18");
  const valid: Waiver = { fingerprint: "fp1", approver: "alice", expires: "2026-11-01", reason: "false positive" };

  it("blocks a new critical with no waiver", () => {
    const r = applyPolicy([crit], [], config, now);
    assert.equal(r.pass, false);
    assert.equal(r.blocking.length, 1);
  });
  it("does not block a medium when only critical/high block", () => {
    assert.equal(applyPolicy([med], [], config, now).pass, true);
  });
  it("passes when a valid waiver covers the critical", () => {
    const r = applyPolicy([crit], [valid], config, now);
    assert.equal(r.pass, true);
    assert.equal(r.waived.length, 1);
  });
  it("rejects a waiver with no approver", () => {
    const r = applyPolicy([crit], [{ ...valid, approver: "" }], config, now);
    assert.equal(r.pass, false);
    assert.match(r.invalidWaivers[0]?.problem ?? "", /no approver/);
  });
  it("rejects an expired waiver and one exceeding the max duration", () => {
    assert.match(applyPolicy([crit], [{ ...valid, expires: "2026-01-01" }], config, now).invalidWaivers[0]?.problem ?? "", /expired/);
    assert.match(applyPolicy([crit], [{ ...valid, expires: "2027-06-01" }], config, now).invalidWaivers[0]?.problem ?? "", /maximum/);
  });
  it("rejects a waiver with no reason", () => {
    assert.match(applyPolicy([crit], [{ ...valid, reason: "" }], config, now).invalidWaivers[0]?.problem ?? "", /no reason/);
  });
});
