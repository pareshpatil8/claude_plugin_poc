import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { GovernanceEvent } from "./event.js";

/** Append-only governance ledger: one JSON event per line, never rewritten. */
export function appendEvent(dir: string, event: GovernanceEvent): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(path.join(dir, "ledger.jsonl"), JSON.stringify(event) + "\n", "utf8");
}

export function readLedger(dir: string): GovernanceEvent[] {
  const file = path.join(dir, "ledger.jsonl");
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as GovernanceEvent);
}

export interface LedgerSummary {
  readonly total: number;
  readonly byActor: Record<string, number>;
  readonly byEvent: Record<string, number>;
  readonly gates: { pass: number; fail: number };
  readonly reqIds: string[];
  readonly waivers: number;
}

export function summarise(events: readonly GovernanceEvent[]): LedgerSummary {
  const byActor: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  const reqIds = new Set<string>();
  let pass = 0;
  let fail = 0;
  let waivers = 0;
  for (const e of events) {
    const actor = e.actor.kind === "agent" ? `agent:${e.actor.agentName ?? "?"}` : `human:${e.actor.userEmail ?? "?"}`;
    byActor[actor] = (byActor[actor] ?? 0) + 1;
    byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
    for (const r of e.reqIds) {
      reqIds.add(r);
    }
    if (e.gate) {
      if (e.gate.status === "pass") {
        pass++;
      } else {
        fail++;
      }
    }
    if (e.waiver) {
      waivers++;
    }
  }
  return { total: events.length, byActor, byEvent, gates: { pass, fail }, reqIds: [...reqIds].sort(), waivers };
}

export function formatReport(events: readonly GovernanceEvent[]): string {
  const s = summarise(events);
  const lines = [
    "# eco-forge governance report",
    "",
    `- Events: ${s.total}`,
    `- REQ-IDs touched: ${s.reqIds.join(", ") || "(none tagged)"}`,
    `- Gates: ${s.gates.pass} pass · ${s.gates.fail} fail · waivers: ${s.waivers}`,
    "",
    "## By actor",
    ...Object.entries(s.byActor).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## By event",
    ...Object.entries(s.byEvent).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Review / merge / gate timeline (most recent 40)",
    ...events
      .filter((e) => e.gate || e.waiver || e.review || e.artifact)
      .slice(-40)
      .map((e) => {
        const who = e.actor.kind === "agent" ? e.actor.agentName : e.actor.userEmail;
        const detail = e.gate
          ? `gate ${e.gate.name}=${e.gate.status}`
          : e.waiver
            ? `waiver by ${e.waiver.approver} (exp ${e.waiver.expires})`
            : e.review
              ? `review ${e.review.verdict} by ${e.review.reviewer}`
              : `artifact ${e.artifact?.commit ?? ""} ${e.artifact?.mrUrl ?? ""}`;
        return `- ${e.ts} [${e.reqIds.join(",") || "-"}] ${who ?? "?"}: ${detail}`;
      }),
  ];
  return lines.join("\n");
}
