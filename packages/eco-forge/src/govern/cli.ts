#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { eventFromHook, reqIdsFromEnv, type GovernanceEvent, type HookPayload } from "./event.js";
import { appendEvent, formatReport, readLedger } from "./ledger.js";

const HELP = `Usage: eco-forge-govern <hook|record|report> [options]

Append-only governance ledger (who did what, reviewed by whom, with what outcome).
Metadata only — never writes prompt/code content (DPDP).

hook     Read a Claude Code hook payload on stdin and append an event. Always exits 0
         (governance observes; it never blocks a tool call). Wire into settings.json:
           PostToolUse / SubagentStop / SessionEnd -> command "eco-forge-govern hook"
record   Append a manual action. One of:
           --gate <name>:<pass|fail> [--new <n>]
           --waiver <fingerprint> --approver <who> --reason <text> --expires <YYYY-MM-DD>
           --review <reviewer>:<verdict>
           --merge <commit> [--mr <url>]
report   Summarise the ledger (by actor, by event, gate/review timeline).

Common:
  --state <dir>   Ledger directory (default: .eco/governance)
  --help, -h

Env read: ECO_REQ_IDS (e.g. "REQ-014 REQ-015"), CLAUDE_CODE_USER_EMAIL.
`;

function stateDir(v?: string): string {
  return path.resolve(v ?? ".eco/governance");
}

function doHook(args: readonly string[]): number {
  const { values } = parseArgs({ args: [...args], strict: false, options: { state: { type: "string" } } });
  let payload: HookPayload = {};
  try {
    const raw = readFileSync(0, "utf8"); // stdin
    payload = raw.trim().length > 0 ? (JSON.parse(raw) as HookPayload) : {};
  } catch {
    // No/!valid stdin: record a minimal event rather than fail — governance must never break a run.
  }
  try {
    appendEvent(stateDir(values.state as string | undefined), eventFromHook(payload));
  } catch {
    // Never throw from a hook.
  }
  return 0;
}

function doRecord(args: readonly string[]): number {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      state: { type: "string" },
      gate: { type: "string" }, new: { type: "string" },
      waiver: { type: "string" }, approver: { type: "string" }, reason: { type: "string" }, expires: { type: "string" },
      review: { type: "string" }, merge: { type: "string" }, mr: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const base = {
    ts: new Date().toISOString(),
    event: "action",
    actor: { kind: "human" as const, ...(process.env.CLAUDE_CODE_USER_EMAIL ? { userEmail: process.env.CLAUDE_CODE_USER_EMAIL } : {}) },
    reqIds: reqIdsFromEnv(process.env),
  };
  let event: GovernanceEvent;
  if (values.gate) {
    const [name, status] = values.gate.split(":");
    if (!name || (status !== "pass" && status !== "fail")) {
      console.error("--gate must be <name>:<pass|fail>");
      return 1;
    }
    event = { ...base, event: "gate", gate: { name, status, ...(values.new ? { newFindings: Number(values.new) } : {}) } };
  } else if (values.waiver) {
    if (!values.approver || !values.reason || !values.expires) {
      console.error("--waiver requires --approver, --reason, --expires");
      return 1;
    }
    event = { ...base, event: "waiver", waiver: { fingerprint: values.waiver, approver: values.approver, reason: values.reason, expires: values.expires } };
  } else if (values.review) {
    const [reviewer, verdict] = values.review.split(":");
    if (!reviewer || !verdict) {
      console.error("--review must be <reviewer>:<verdict>");
      return 1;
    }
    event = { ...base, event: "review", review: { reviewer, verdict } };
  } else if (values.merge) {
    event = { ...base, event: "merge", artifact: { commit: values.merge, ...(values.mr ? { mrUrl: values.mr } : {}) } };
  } else {
    console.error("record needs one of --gate / --waiver / --review / --merge");
    return 1;
  }
  appendEvent(stateDir(values.state as string | undefined), event);
  return 0;
}

function doReport(args: readonly string[]): number {
  const { values } = parseArgs({ args: [...args], strict: true, options: { state: { type: "string" }, help: { type: "boolean", short: "h", default: false } } });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  console.log(formatReport(readLedger(stateDir(values.state))));
  return 0;
}

export function main(argv: readonly string[]): number {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (sub === "hook") return doHook(rest);
  if (sub === "record") return doRecord(rest);
  if (sub === "report") return doReport(rest);
  console.log(HELP);
  return sub === undefined || sub === "--help" || sub === "-h" ? 0 : 1;
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  process.exit(main(process.argv.slice(2)));
}
