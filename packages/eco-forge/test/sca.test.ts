import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNpmAudit, parseTrivy, type ScaFinding } from "../src/gates/sca.js";
import { blocking, formatTriage, triage } from "../src/gates/reachability.js";

describe("parseTrivy", () => {
  const report = JSON.stringify({
    Results: [
      {
        Target: "pom.xml", Class: "lang-pkgs", Type: "pom",
        Vulnerabilities: [
          { VulnerabilityID: "CVE-1", PkgName: "com.example:lib", InstalledVersion: "1.0", FixedVersion: "1.1", Severity: "HIGH", Relationship: "direct", Title: "RCE" },
          { VulnerabilityID: "CVE-2", PkgName: "com.other:transitive", InstalledVersion: "2.0", Severity: "CRITICAL", Relationship: "indirect", Title: "no fix" },
        ],
      },
      { Target: "ubi9", Class: "os-pkgs", Type: "redhat", Vulnerabilities: [{ VulnerabilityID: "CVE-3", PkgName: "openssl", InstalledVersion: "3.0", FixedVersion: "3.1", Severity: "MEDIUM" }] },
    ],
  });
  it("maps packages, fix versions, severity, ecosystem and directness", () => {
    const f = parseTrivy(report);
    assert.equal(f.length, 3);
    assert.equal(f[0]?.ecosystem, "maven");
    assert.equal(f[0]?.fixedVersion, "1.1");
    assert.equal(f[0]?.direct, true);
    assert.equal(f[1]?.fixedVersion, null);
    assert.equal(f[2]?.ecosystem, "oci");
  });
});

describe("parseNpmAudit", () => {
  it("reads npm audit --json shape with fixAvailable", () => {
    const f = parseNpmAudit(JSON.stringify({
      vulnerabilities: { lodash: { name: "lodash", severity: "high", isDirect: true, range: "<4.17.21", fixAvailable: { version: "4.17.21" }, via: [{ title: "Prototype pollution", url: "https://x/GHSA-abc" }] } },
    }));
    assert.equal(f[0]?.ecosystem, "npm");
    assert.equal(f[0]?.fixedVersion, "4.17.21");
    assert.equal(f[0]?.vulnId, "GHSA-abc");
    assert.equal(f[0]?.direct, true);
  });
});

const finding = (over: Partial<ScaFinding>): ScaFinding => ({
  ecosystem: "maven", pkg: "p", installedVersion: "1.0", fixedVersion: null, vulnId: "CVE-X",
  severity: "high", direct: false, title: "t", source: "s", ...over,
});

describe("triage decision rule", () => {
  const noImport = () => false;

  it("fix available -> upgrade (regardless of reachability)", () => {
    const [t] = triage([finding({ fixedVersion: "1.1" })], noImport);
    assert.equal(t?.decision, "upgrade");
  });
  it("no fix, high, reachable (direct) -> block-escalate", () => {
    const [t] = triage([finding({ direct: true })], noImport);
    assert.equal(t?.decision, "block-escalate");
    assert.equal(t?.reachable, true);
  });
  it("no fix, critical, indirect but imported -> block-escalate", () => {
    const [t] = triage([finding({ severity: "critical" })], () => true);
    assert.equal(t?.decision, "block-escalate");
  });
  it("no fix, high, indirect and NOT imported -> waive-unreachable", () => {
    const [t] = triage([finding({})], noImport);
    assert.equal(t?.decision, "waive-unreachable");
    assert.equal(t?.reachable, false);
  });
  it("no fix, medium -> monitor (below act-on threshold)", () => {
    const [t] = triage([finding({ severity: "medium", direct: true })], noImport);
    assert.equal(t?.decision, "monitor");
  });
  it("blocking() fails on reachable-no-fix AND on an unapplied fix at act-on severity", () => {
    const triaged = triage([
      finding({ direct: true }),                         // block-escalate
      finding({ fixedVersion: "2", severity: "critical" }), // upgrade, critical -> blocks
      finding({ fixedVersion: "2", severity: "low" }),   // upgrade, low -> does not block
    ], noImport);
    assert.equal(blocking(triaged).length, 2);
    assert.match(formatTriage(triaged), /SCA FAIL \(2 blocking\)/);
  });
});
