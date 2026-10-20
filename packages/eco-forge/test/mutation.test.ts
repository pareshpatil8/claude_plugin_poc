import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMutation, gate, parsePit, parseStryker } from "../src/gates/mutation.js";

const pitXml = `<mutations>
  <mutation detected='true' status='KILLED'><mutatedClass>A</mutatedClass></mutation>
  <mutation detected='true' status='TIMED_OUT'><mutatedClass>A</mutatedClass></mutation>
  <mutation detected='false' status='SURVIVED'><mutatedClass>A</mutatedClass></mutation>
  <mutation detected='false' status='NO_COVERAGE'><mutatedClass>A</mutatedClass></mutation>
</mutations>`;

const strykerJson = JSON.stringify({
  files: {
    "a.ts": { mutants: [{ status: "Killed" }, { status: "Timeout" }, { status: "Survived" }] },
    "b.ts": { mutants: [{ status: "NoCoverage" }, { status: "Ignored" }] },
  },
});

describe("parsePit", () => {
  it("counts killed/timed_out as killed and computes the score", () => {
    const r = parsePit(pitXml);
    assert.equal(r.total, 4); // killed(2) + survived(1) + nocoverage(1)
    assert.equal(r.killed, 2);
    assert.equal(r.survived, 1);
    assert.equal(r.noCoverage, 1);
    assert.equal(r.score, 50); // 2/4
  });
});

describe("parseStryker", () => {
  it("counts Killed/Timeout as killed, excludes Ignored from the denominator", () => {
    const r = parseStryker(strykerJson);
    assert.equal(r.killed, 2); // Killed + Timeout
    assert.equal(r.survived, 1);
    assert.equal(r.noCoverage, 1);
    assert.equal(r.total, 4); // Ignored excluded
    assert.equal(r.score, 50);
  });
});

describe("gate", () => {
  it("passes at/above threshold and fails below", () => {
    assert.equal(gate(parsePit(pitXml), 50).pass, true);
    assert.equal(gate(parsePit(pitXml), 60).pass, false);
  });
  it("fails when there are no mutants (mutator did not run)", () => {
    const g = gate(parseStryker(JSON.stringify({ files: {} })), 1);
    assert.equal(g.pass, false);
    assert.match(formatMutation(g), /no mutants/);
  });
});
