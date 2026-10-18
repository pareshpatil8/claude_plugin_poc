import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Wires the third-party `ponytail` tool (DietrichGebert/ponytail, MIT — a "write the minimum
 * necessary code" behaviour plugin) into an already-prepared eco workspace. Unlike context-mode
 * (which compresses tool *output*), ponytail changes how the model *writes*: its SessionStart and
 * UserPromptSubmit hooks inject a reuse-ladder instruction, and its skill is available.
 *
 * Its hook commands resolve their own files through `process.env.CLAUDE_PLUGIN_ROOT` at runtime, so
 * the caller MUST invoke claude with CLAUDE_PLUGIN_ROOT set to `root` (see ponytailEnv).
 */
export interface PonytailConfig {
  /** The cloned ponytail repository (contains hooks/ and skills/). */
  readonly root: string;
}

export function ponytailEnv(cfg: PonytailConfig): Record<string, string> {
  return { CLAUDE_PLUGIN_ROOT: cfg.root };
}

export function wirePonytail(workspace: string, cfg: PonytailConfig): void {
  const hooksFile = path.join(cfg.root, "hooks", "claude-codex-hooks.json");
  if (!existsSync(hooksFile)) {
    throw new Error(`ponytail install incomplete at ${cfg.root} (missing hooks/claude-codex-hooks.json)`);
  }

  // Merge ponytail hooks AFTER the eco guard hooks.
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settings = existsSync(settingsPath) ? (JSON.parse(readFileSync(settingsPath, "utf8")) as SettingsShape) : {};
  settings.hooks ??= {};
  const ponyHooks = (JSON.parse(readFileSync(hooksFile, "utf8")) as { hooks: Record<string, unknown[]> }).hooks;
  for (const [event, entries] of Object.entries(ponyHooks)) {
    settings.hooks[event] = [...(settings.hooks[event] ?? []), ...(entries as HookEntry[])];
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");

  // Make the ponytail skill available in the workspace.
  const srcSkills = path.join(cfg.root, "skills");
  if (existsSync(srcSkills)) {
    const destSkills = path.join(workspace, ".claude", "skills");
    mkdirSync(destSkills, { recursive: true });
    cpSync(srcSkills, destSkills, { recursive: true });
  }
}

interface HookEntry {
  readonly matcher?: string;
  readonly hooks: { type: string; command: string }[];
}
interface SettingsShape {
  hooks?: Record<string, HookEntry[]>;
  [k: string]: unknown;
}
