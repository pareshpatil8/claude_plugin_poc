import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNfrPerf, toK6Options } from "../src/gates/nfr-perf.js";

describe("parseNfrPerf", () => {
  it("extracts a p95 latency and RPS target", () => {
    const p = parseNfrPerf("| Performance | p95 latency < 300 ms at 200 RPS |");
    assert.deepEqual(p.thresholds["http_req_duration{expected_response:true}"], ["p(95)<300"]);
    assert.equal(p.targetRps, 200);
  });
  it("converts seconds to ms and handles multiple percentiles", () => {
    const p = parseNfrPerf("p95 < 1 s\np(99) response time < 2s");
    assert.deepEqual(p.thresholds["http_req_duration{expected_response:true}"], ["p(95)<1000", "p(99)<2000"]);
  });
  it("derives an error-rate ceiling from availability", () => {
    const p = parseNfrPerf("Availability >= 99.9%");
    assert.equal(p.thresholds["http_req_failed"]?.[0], "rate<0.001");
  });
  it("uses an explicit error-rate when given", () => {
    const p = parseNfrPerf("error rate < 0.5%");
    assert.deepEqual(p.thresholds["http_req_failed"], ["rate<0.005"]);
  });
  it("notes when no latency target is present", () => {
    assert.ok(parseNfrPerf("the system should be fast").notes.some((n) => /No numeric latency/.test(n)));
  });
  it("emits a constant-arrival-rate k6 scenario when RPS is known", () => {
    const k6 = toK6Options(parseNfrPerf("p95 < 300 ms at 200 RPS"));
    assert.match(k6, /constant-arrival-rate/);
    assert.match(k6, /"rate": 200/);
    assert.match(k6, /p\(95\)<300/);
  });
});
