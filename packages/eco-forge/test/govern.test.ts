import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { eventFromHook, reqIdsFromEnv } from "../src/govern/event.js";
import { appendEvent, readLedger, summarise } from "../src/govern/ledger.js";

describe("governance event", () => {
  it("maps a subagent tool-use hook to an agent-attributed event with files + digest, no content", () => {
    const e = eventFromHook(
      {
        hook_event_name: "PostToolUse",
        session_id: "s1",
        agent_id: "a1",
        agent_type: "backend-dev",
        tool_name: "Edit",
        tool_input: { file_path: "src/Main.java", old_string: "SECRET-CODE", new_string: "x" },
        tool_use_id: "t1",
        duration_ms: 42,
      },
      { ECO_REQ_IDS: "REQ-014, REQ-015" } as NodeJS.ProcessEnv,
    );
    assert.equal(e.actor.kind, "agent");
    assert.equal(e.actor.agentName, "backend-dev");
    assert.deepEqual(e.reqIds, ["REQ-014", "REQ-015"]);
    assert.deepEqual(e.files, ["src/Main.java"]);
    assert.match(e.inputDigest ?? "", /^sha256:[0-9a-f]{64}$/);
    // DPDP: no content leaks into the event
    assert.ok(!JSON.stringify(e).includes("SECRET-CODE"));
  });

  it("attributes to a human when there is no subagent id", () => {
    const e = eventFromHook({ hook_event_name: "SessionEnd" }, { CLAUDE_CODE_USER_EMAIL: "dev@corp.test" } as NodeJS.ProcessEnv);
    assert.equal(e.actor.kind, "human");
    assert.equal(e.actor.userEmail, "dev@corp.test");
  });

  it("reqIdsFromEnv ignores non-REQ tokens", () => {
    assert.deepEqual(reqIdsFromEnv({ ECO_REQ_IDS: "REQ-1 foo REQ-22" } as NodeJS.ProcessEnv), ["REQ-1", "REQ-22"]);
  });
});

describe("governance ledger", () => {
  it("appends and summarises by actor, event and gate outcome", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gov-"));
    try {
      appendEvent(dir, eventFromHook({ hook_event_name: "PostToolUse", agent_type: "backend-dev", tool_name: "Edit" }, {} as NodeJS.ProcessEnv));
      appendEvent(dir, { ts: new Date().toISOString(), event: "gate", actor: { kind: "human", userEmail: "ci@corp" }, reqIds: ["REQ-9"], gate: { name: "semgrep", status: "pass" } });
      appendEvent(dir, { ts: new Date().toISOString(), event: "gate", actor: { kind: "human", userEmail: "ci@corp" }, reqIds: ["REQ-9"], gate: { name: "sca", status: "fail" } });
      const s = summarise(readLedger(dir));
      assert.equal(s.total, 3);
      assert.equal(s.gates.pass, 1);
      assert.equal(s.gates.fail, 1);
      assert.ok(s.byActor["agent:backend-dev"] === 1);
      assert.deepEqual(s.reqIds, ["REQ-9"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
