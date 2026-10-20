/**
 * Governance events: the append-only "who did what, reviewed by whom, with what outcome" record that
 * Claude Code does not produce natively (it emits per-tool telemetry, but nothing that joins agent +
 * tool + permission decision + REQ-ID + gate outcome + approver). This module turns a Claude Code
 * hook payload into one such event.
 *
 * DPDP: events carry metadata only — file PATHS (not contents) and a sha256 DIGEST of the tool input,
 * never the input itself, prompts, or code. Content is never written to the ledger.
 */
import { sha256 } from "../core/hash.js";

export interface Actor {
  readonly kind: "agent" | "human";
  readonly agentName?: string;
  readonly agentId?: string;
  readonly userEmail?: string;
}

export interface GateRecord {
  readonly name: string;
  readonly status: "pass" | "fail";
  readonly newFindings?: number;
}
export interface WaiverRecord {
  readonly fingerprint: string;
  readonly approver: string;
  readonly reason: string;
  readonly expires: string;
}
export interface ReviewRecord {
  readonly reviewer: string;
  readonly verdict: string;
}
export interface ArtifactRef {
  readonly commit?: string;
  readonly mrUrl?: string;
}

export interface GovernanceEvent {
  readonly ts: string;
  readonly sessionId?: string;
  /** hook_event_name (PostToolUse, SubagentStop, …) or a manual action (gate, waiver, review, merge). */
  readonly event: string;
  readonly actor: Actor;
  readonly reqIds: string[];
  readonly tool?: string;
  readonly toolUseId?: string;
  readonly files?: string[];
  readonly decision?: string;
  readonly durationMs?: number;
  readonly inputDigest?: string;
  readonly gate?: GateRecord;
  readonly waiver?: WaiverRecord;
  readonly review?: ReviewRecord;
  readonly artifact?: ArtifactRef;
}

/** The subset of the Claude Code hook stdin payload we read (documented fields). */
export interface HookPayload {
  readonly hook_event_name?: string;
  readonly session_id?: string;
  readonly agent_id?: string;
  readonly agent_type?: string;
  readonly tool_name?: string;
  readonly tool_input?: Record<string, unknown>;
  readonly tool_use_id?: string;
  readonly duration_ms?: number;
  readonly permission_mode?: string;
}

/** REQ-IDs come from the pipeline, passed in ECO_REQ_IDS (comma/space separated, e.g. "REQ-014 REQ-015"). */
export function reqIdsFromEnv(env: NodeJS.ProcessEnv): string[] {
  return (env.ECO_REQ_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^REQ-\d+/.test(s));
}

const FILE_KEYS = ["file_path", "path", "notebook_path"];

function extractFiles(toolInput: Record<string, unknown>): string[] {
  const files: string[] = [];
  for (const k of FILE_KEYS) {
    const v = toolInput[k];
    if (typeof v === "string" && v.length > 0) {
      files.push(v);
    }
  }
  const list = toolInput.file_paths ?? toolInput.paths;
  if (Array.isArray(list)) {
    for (const v of list) {
      if (typeof v === "string") {
        files.push(v);
      }
    }
  }
  return files;
}

export function eventFromHook(p: HookPayload, env: NodeJS.ProcessEnv = process.env): GovernanceEvent {
  const actor: Actor =
    p.agent_id || p.agent_type
      ? { kind: "agent", ...(p.agent_type ? { agentName: p.agent_type } : {}), ...(p.agent_id ? { agentId: p.agent_id } : {}) }
      : { kind: "human", ...(env.CLAUDE_CODE_USER_EMAIL ? { userEmail: env.CLAUDE_CODE_USER_EMAIL } : {}) };
  const toolInput = p.tool_input ?? {};
  const files = extractFiles(toolInput);
  return {
    ts: new Date().toISOString(),
    ...(p.session_id ? { sessionId: p.session_id } : {}),
    event: p.hook_event_name ?? "unknown",
    actor,
    reqIds: reqIdsFromEnv(env),
    ...(p.tool_name ? { tool: p.tool_name } : {}),
    ...(p.tool_use_id ? { toolUseId: p.tool_use_id } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(p.permission_mode ? { decision: p.permission_mode } : {}),
    ...(typeof p.duration_ms === "number" ? { durationMs: p.duration_ms } : {}),
    ...(p.tool_input ? { inputDigest: `sha256:${sha256(JSON.stringify(p.tool_input))}` } : {}),
  };
}
