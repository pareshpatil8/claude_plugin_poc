/**
 * Claude Code hook entry point. Reads the hook payload on stdin and prints a decision on stdout.
 *
 * - PreToolUse: inspects Bash commands and file reads; a deny stops the tool call.
 * - UserPromptSubmit / PreToolUse: scans text for real PII and blocks it reaching the model.
 *
 * The enforcement lives here (the tool call is actually stopped), so blocking no longer depends
 * on the model choosing to refuse. Output uses the documented hook JSON shape.
 */
import { evaluateCommand, evaluateRead, type Decision } from "./rules.js";
import { scanForPii } from "./pii.js";

export interface HookInput {
  readonly hook_event_name?: string;
  readonly tool_name?: string;
  readonly tool_input?: Record<string, unknown>;
  readonly prompt?: string;
}

export interface HookOutput {
  readonly decision?: "block";
  readonly reason?: string;
  readonly hookSpecificOutput?: Record<string, unknown>;
  readonly exitCode: 0 | 2;
}

export function decide(input: HookInput): HookOutput {
  const event = input.hook_event_name ?? "PreToolUse";

  if (event === "UserPromptSubmit") {
    return piiOutcome(input.prompt ?? "", "UserPromptSubmit");
  }

  if (event === "PreToolUse") {
    const tool = input.tool_name ?? "";
    const toolInput = input.tool_input ?? {};

    if (tool === "Bash" && typeof toolInput.command === "string") {
      const decision = evaluateCommand(toolInput.command);
      if (!decision.allow) {
        return denyTool(decision);
      }
    }
    if ((tool === "Read" || tool === "Edit" || tool === "Write") && typeof toolInput.file_path === "string") {
      const decision = evaluateRead(toolInput.file_path);
      if (!decision.allow) {
        return denyTool(decision);
      }
    }
    // Scan free-text tool inputs (e.g. a commit message, a web payload) for PII on the way out.
    const text = extractText(toolInput);
    if (text.length > 0) {
      const pii = piiOutcome(text, "PreToolUse");
      if (pii.exitCode === 2) {
        return pii;
      }
    }
  }
  return { exitCode: 0 };
}

function piiOutcome(text: string, event: string): HookOutput {
  const findings = scanForPii(text);
  if (findings.length === 0) {
    return { exitCode: 0 };
  }
  const summary = findings.map((f) => `${f.kind} (${f.sample})`).join(", ");
  return {
    decision: "block",
    reason: `eco-forge PII guard blocked ${event}: real personal data must not reach the model. Found: ${summary}. Use synthetic test data instead.`,
    hookSpecificOutput: { hookEventName: event, permissionDecision: "deny" },
    exitCode: 2,
  };
}

function denyTool(decision: Decision): HookOutput {
  return {
    decision: "block",
    reason: `eco-forge guard blocked this action [${decision.rule}]: ${decision.reason}`,
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: decision.reason },
    exitCode: 2,
  };
}

function extractText(toolInput: Record<string, unknown>): string {
  return Object.entries(toolInput)
    .filter(([key]) => key !== "file_path" && key !== "command")
    .map(([, value]) => (typeof value === "string" ? value : ""))
    .join("\n");
}

export async function runHook(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<number> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  let input: HookInput;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as HookInput;
  } catch {
    // Malformed payload: fail open with exit 0 would skip the guard, so fail closed instead.
    stdout.write(JSON.stringify({ decision: "block", reason: "eco-forge guard: unreadable hook payload" }));
    return 2;
  }
  const output = decide(input);
  if (output.exitCode === 2) {
    stdout.write(JSON.stringify({ decision: output.decision, reason: output.reason, hookSpecificOutput: output.hookSpecificOutput }));
  }
  return output.exitCode;
}
