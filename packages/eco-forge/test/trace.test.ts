import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkTraceability, declaredIds, formatTrace } from "../src/gates/trace.js";

describe("declaredIds", () => {
  it("reads REQ-IDs from table rows and 'REQ-nnn:' lines", () => {
    const spec = "| REQ-001 | login |\nREQ-002: logout\nsee REQ-999 elsewhere";
    assert.deepEqual([...declaredIds(spec)].sort(), ["REQ-001", "REQ-002"]); // REQ-999 is only a mention
  });
  it("falls back to any mention when the spec declares none structurally", () => {
    assert.deepEqual([...declaredIds("the feature covers REQ-010 and REQ-011")].sort(), ["REQ-010", "REQ-011"]);
  });
});

describe("checkTraceability", () => {
  const spec = "| REQ-001 | a |\n| REQ-002 | b |";
  it("passes when every requirement has a test and a UAT case", () => {
    const r = checkTraceability({ spec, tests: "// REQ-001 REQ-002", uat: "REQ-001 REQ-002 cases" });
    assert.equal(r.pass, true);
  });
  it("flags a requirement with no test and one with no UAT case", () => {
    const r = checkTraceability({ spec, tests: "REQ-001 only", uat: "REQ-002 only" });
    assert.deepEqual(r.missingTest, ["REQ-002"]);
    assert.deepEqual(r.missingUat, ["REQ-001"]);
    assert.equal(r.pass, false);
  });
  it("flags orphan references not declared in the spec", () => {
    const r = checkTraceability({ spec, tests: "REQ-001 REQ-002 REQ-777", uat: "REQ-001 REQ-002" });
    assert.deepEqual(r.orphanInTests, ["REQ-777"]);
    assert.equal(r.pass, false);
  });
  it("formats a readable report", () => {
    const r = checkTraceability({ spec, tests: "REQ-001", uat: "REQ-001 REQ-002" });
    assert.match(formatTrace(r), /no test: REQ-002[\s\S]*TRACE FAIL/);
  });
});
