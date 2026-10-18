import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDesignScore, lintDesign, scoreDesign } from "../src/qa/design-lint.js";

const spec = "| REQ-001 | login |\n| REQ-002 | logout |";

describe("design-lint (proactive design QA)", () => {
  it("flags a requirement with no design coverage", () => {
    const d = lintDesign({ spec, design: "## Auth\nRealises REQ-001." });
    assert.ok(d.some((x) => x.defectClass === "untraced-requirement" && x.subject === "REQ-002"));
  });

  it("flags a design citing a requirement the spec never declared", () => {
    const d = lintDesign({ spec, design: "Realises REQ-001, REQ-002 and REQ-900." });
    assert.ok(d.some((x) => x.defectClass === "orphan-design" && x.subject === "REQ-900"));
  });

  it("passes when every requirement is covered and none orphaned", () => {
    const d = lintDesign({ spec, design: "REQ-001 and REQ-002 are realised here." });
    assert.equal(d.filter((x) => x.defectClass.includes("trace") || x.defectClass.includes("orphan")).length, 0);
  });

  it("flags an OpenAPI operation with only success responses", () => {
    const openapi = [
      "paths:",
      "  /api/things:",
      "    get:",
      "      security:",
      "        - bearer: []",
      "      responses:",
      "        '200':",
      "          description: ok",
    ].join("\n");
    const d = lintDesign({ spec: "", design: "", openapi });
    assert.ok(d.some((x) => x.defectClass === "op-missing-error" && x.subject === "GET /api/things"));
  });

  it("flags an operation with no security, and accepts global security", () => {
    const base = ["paths:", "  /api/x:", "    post:", "      responses:", "        '200': {}", "        '400': {}"].join("\n");
    assert.ok(lintDesign({ spec: "", design: "", openapi: base }).some((x) => x.defectClass === "op-missing-auth"));
    const withGlobal = "security:\n  - bearer: []\n" + base;
    assert.equal(lintDesign({ spec: "", design: "", openapi: withGlobal }).filter((x) => x.defectClass === "op-missing-auth").length, 0);
  });

  it("accepts an operation deliberately marked x-public", () => {
    const openapi = ["paths:", "  /health:", "    get:", "      x-public: true", "      responses:", "        '200': {}", "        '503': {}"].join("\n");
    assert.equal(lintDesign({ spec: "", design: "", openapi }).filter((x) => x.defectClass === "op-missing-auth").length, 0);
  });

  it("flags a decision with no ADR reference, accepts one with it", () => {
    assert.ok(lintDesign({ spec: "", design: "We chose Kafka instead of RabbitMQ." }).some((x) => x.defectClass === "undocumented-decision"));
    assert.equal(lintDesign({ spec: "", design: "We chose Kafka (see ADR-0007)." }).filter((x) => x.defectClass === "undocumented-decision").length, 0);
  });

  it("scoreDesign fails on any defect and formats a report", () => {
    const s = scoreDesign({ spec, design: "Realises REQ-001 only." });
    assert.equal(s.pass, false);
    assert.match(formatDesignScore(s), /DESIGN-LINT FAIL/);
  });
});
