import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSpecScore, lintSpec, scoreSpec } from "../src/qa/spec-lint.js";

describe("spec-lint (proactive requirements QA)", () => {
  it("flags ambiguous, non-measurable wording", () => {
    const d = lintSpec({ spec: "REQ-001: the system must be fast and user-friendly." });
    assert.ok(d.some((x) => x.defectClass === "ambiguous"));
  });

  it("flags an NFR with no number", () => {
    const d = lintSpec({ spec: "", nfr: "| Performance | the API should have low latency |" });
    assert.ok(d.some((x) => x.defectClass === "weak-nfr"));
  });

  it("accepts an NFR with a numeric target", () => {
    const d = lintSpec({ spec: "", nfr: "| Performance | p95 latency < 300 ms at 200 RPS |" });
    assert.equal(d.filter((x) => x.defectClass === "weak-nfr").length, 0);
  });

  it("flags a data field with no PII classification and accepts a classified one", () => {
    const header = "| field | purpose | pii |";
    const bad = lintSpec({ spec: "", dataCatalog: `${header}\n|---|---|---|\n| applicantEmail | contact the applicant | |` });
    assert.ok(bad.some((x) => x.defectClass === "unclassified-data"));
    const good = lintSpec({ spec: "", dataCatalog: `${header}\n|---|---|---|\n| applicantEmail | contact | contact |` });
    assert.equal(good.filter((x) => x.defectClass === "unclassified-data").length, 0);
  });

  it("flags duplicate REQ-IDs as a conflict", () => {
    const d = lintSpec({ spec: "REQ-001: login\nREQ-002: logout\nREQ-001: reset" });
    assert.ok(d.some((x) => x.defectClass === "conflict" && x.text === "REQ-001"));
  });

  it("flags TBD placeholders", () => {
    assert.ok(lintSpec({ spec: "REQ-003: retention period is TBD" }).some((x) => x.defectClass === "tbd"));
  });

  it("flags untestable acceptance criteria", () => {
    assert.ok(lintSpec({ spec: "REQ-004 acceptance: the feature should work properly" }).some((x) => x.defectClass === "untestable"));
  });

  it("flags a spec with flows but no error path anywhere", () => {
    assert.ok(lintSpec({ spec: "REQ-005: the submit flow creates a request and the endpoint returns it" })
      .some((x) => x.defectClass === "missing-error-path"));
  });

  it("does not flag missing-error-path when failure behaviour is present", () => {
    const d = lintSpec({ spec: "REQ-006: the submit flow creates a request; on invalid input it returns a 400 error" });
    assert.equal(d.filter((x) => x.defectClass === "missing-error-path").length, 0);
  });

  it("scoreSpec marks blocking classes and a clean spec passes", () => {
    const clean = scoreSpec({
      spec: "REQ-001: on submit, validate input; on invalid input return 400. Response under a bound.",
      nfr: "| Performance | p95 < 300 ms at 200 RPS |",
      dataCatalog: "| field | pii |\n|---|---|\n| email | contact |",
    });
    assert.equal(clean.pass, true, formatSpecScore(clean));

    const dirty = scoreSpec({ spec: "REQ-001: fast\nREQ-001: dup\nretention TBD", nfr: "| uptime | high availability |" });
    assert.ok(dirty.blocking >= 3);
    assert.equal(dirty.pass, false);
    assert.match(formatSpecScore(dirty), /SPEC-LINT FAIL/);
  });
});
