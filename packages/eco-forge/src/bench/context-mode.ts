import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Wires the third-party `context-mode` tool (mksglu/context-mode, an MCP server + Claude Code hooks
 * that keep raw tool output out of the context window) into an already-prepared eco workspace.
 *
 * This is the benchmark integration of one Tier-2 token tool. It reproduces what the tool's Claude
 * Code plugin install does, but deterministically into a single workspace so the arm is isolated:
 *  - merges the tool's hooks into .claude/settings.json AFTER the eco guard hooks (eco runs first);
 *  - registers its stdio MCP server in .mcp.json;
 *  - appends its routing CLAUDE.md (the nudge to prefer ctx_* sandbox tools over raw Bash/Read);
 *  - builds the FTS5 index of the project so ctx_search has content.
 */
export interface ContextModeConfig {
  /** Install directory of the context-mode package (contains cli.bundle.mjs, hooks/, configs/). */
  readonly cmRoot: string;
  /** Per-workspace storage root (CONTEXT_MODE_DIR) so runs never share session/content state. */
  readonly storageDir: string;
}

/** Env the hooks and MCP server need; also applied to the claude invocation for a context-mode arm. */
export function contextModeEnv(cfg: ContextModeConfig): Record<string, string> {
  return { CONTEXT_MODE_DIR: cfg.storageDir, CTX_FETCH_STRICT: "1" };
}

export function wireContextMode(workspace: string, cfg: ContextModeConfig): void {
  const cli = path.join(cfg.cmRoot, "cli.bundle.mjs");
  const hooksFile = path.join(cfg.cmRoot, "hooks", "hooks.json");
  if (!existsSync(cli) || !existsSync(hooksFile)) {
    throw new Error(`context-mode install incomplete at ${cfg.cmRoot} (missing cli.bundle.mjs or hooks/hooks.json)`);
  }
  mkdirSync(cfg.storageDir, { recursive: true });

  // 1. Merge hooks — eco's own hooks stay first in each event's array so the guard runs before context-mode.
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settings = existsSync(settingsPath) ? (JSON.parse(readFileSync(settingsPath, "utf8")) as SettingsShape) : {};
  settings.hooks ??= {};
  const cmHooks = (JSON.parse(readFileSync(hooksFile, "utf8")) as { hooks: Record<string, HookEntry[]> }).hooks;
  for (const [event, entries] of Object.entries(cmHooks)) {
    const mapped = entries.map((e) => ({
      ...e,
      hooks: e.hooks.map((h) => ({ ...h, command: h.command.replaceAll("${CLAUDE_PLUGIN_ROOT}", cfg.cmRoot) })),
    }));
    settings.hooks[event] = [...(settings.hooks[event] ?? []), ...mapped];
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");

  // 2. Register the MCP server.
  const mcpPath = path.join(workspace, ".mcp.json");
  const mcp = existsSync(mcpPath) ? (JSON.parse(readFileSync(mcpPath, "utf8")) as McpShape) : { mcpServers: {} };
  mcp.mcpServers ??= {};
  mcp.mcpServers["context-mode"] = { command: "node", args: [cli], env: contextModeEnv(cfg) };
  writeFileSync(mcpPath, JSON.stringify(mcp, null, 2), "utf8");

  // 3. Append the routing instructions (prefer ctx_* tools over raw Bash/Read/WebFetch).
  const routing = path.join(cfg.cmRoot, "configs", "claude-code", "CLAUDE.md");
  const claudeMd = path.join(workspace, "CLAUDE.md");
  if (existsSync(routing) && existsSync(claudeMd)) {
    appendFileSync(claudeMd, "\n\n" + readFileSync(routing, "utf8"), "utf8");
  }

  // 4. Index the project into the FTS5 knowledge base so ctx_search has something to find.
  spawnSync("node", [cli, "index", workspace, "--max-files", "200"], {
    env: { ...process.env, ...contextModeEnv(cfg) },
    timeout: 120_000,
    encoding: "utf8",
  });
}

interface HookCommand {
  readonly type: string;
  readonly command: string;
}
interface HookEntry {
  readonly matcher?: string;
  readonly hooks: HookCommand[];
}
interface SettingsShape {
  hooks?: Record<string, HookEntry[]>;
  [k: string]: unknown;
}
interface McpShape {
  mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
  [k: string]: unknown;
}
