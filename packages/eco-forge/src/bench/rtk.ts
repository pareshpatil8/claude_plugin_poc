import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Wires the third-party `rtk` tool (rtk-ai/rtk — a Rust binary that filters and compresses command
 * output before it reaches the model) into an already-prepared eco workspace, the way `rtk init`
 * would: a PreToolUse Bash hook that routes command output through the binary, a project
 * `.rtk/filters.toml`, and a short RTK awareness note appended to CLAUDE.md.
 *
 * rtk is the same mechanism class as context-mode (output compaction) but narrower — it fires only
 * on Bash output, so it is expected to help only when commands are verbose.
 */
export interface RtkConfig {
  /** Absolute path to the built rtk binary. */
  readonly bin: string;
  /** Source dir holding the shipped filters.toml and awareness note (the cloned rtk repo). */
  readonly assetsRoot: string;
}

export function wireRtk(workspace: string, cfg: RtkConfig): void {
  if (!existsSync(cfg.bin)) {
    throw new Error(`rtk binary not found at ${cfg.bin}`);
  }

  // PreToolUse Bash hook, appended AFTER the eco guard hook.
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settings = existsSync(settingsPath) ? (JSON.parse(readFileSync(settingsPath, "utf8")) as SettingsShape) : {};
  settings.hooks ??= {};
  settings.hooks.PreToolUse = [
    ...(settings.hooks.PreToolUse ?? []),
    { matcher: "Bash", hooks: [{ type: "command", command: `${cfg.bin} hook claude` }] },
  ];
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");

  // Project-local filters.
  const srcFilters = path.join(cfg.assetsRoot, ".rtk", "filters.toml");
  if (existsSync(srcFilters)) {
    mkdirSync(path.join(workspace, ".rtk"), { recursive: true });
    copyFileSync(srcFilters, path.join(workspace, ".rtk", "filters.toml"));
  }

  // Short awareness note so the model treats compacted output as complete.
  const awareness = path.join(cfg.assetsRoot, "hooks", "rtk-awareness.md");
  const claudeMd = path.join(workspace, "CLAUDE.md");
  if (existsSync(awareness) && existsSync(claudeMd)) {
    appendFileSync(claudeMd, "\n\n" + readFileSync(awareness, "utf8"), "utf8");
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
