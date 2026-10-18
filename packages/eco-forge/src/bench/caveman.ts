import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Wires the third-party `caveman` tool (JuliusBrussee/caveman — terse "caveman voice" skills) into
 * an already-prepared eco workspace to measure its orchestration effect: when the delivery-planner
 * fans out to subagents, caveman makes each subagent's hand-back report terse (every technical fact
 * kept, fluff dropped), so the tokens flowing subagent→orchestrator shrink.
 *
 * We install the voice skills only. `caveman-compress` is deliberately EXCLUDED — it sends file
 * text to the model provider, which violates the DPDP/no-exfiltration rule.
 */
export interface CavemanConfig {
  /** The cloned caveman repo (contains skills/). */
  readonly root: string;
}

const EXCLUDED_SKILLS = new Set(["caveman-compress"]); // sends data off-machine — never install

const VOICE_DIRECTIVE = `

## Report compaction (caveman)
When you finish and report back to the orchestrator, answer in **caveman voice**: answer first,
every technical fact and path kept, all fluff removed. One status line in, one status line out;
nothing between routine tool calls. The reader pays per token and reads in a terminal.
`;

export function wireCaveman(workspace: string, cfg: CavemanConfig): void {
  const srcSkills = path.join(cfg.root, "skills");
  if (!existsSync(srcSkills)) {
    throw new Error(`caveman install incomplete at ${cfg.root} (missing skills/)`);
  }

  // Install the caveman voice skills (minus the exfiltrating one) into the workspace.
  const destSkills = path.join(workspace, ".claude", "skills");
  mkdirSync(destSkills, { recursive: true });
  for (const entry of readdirSync(srcSkills, { withFileTypes: true })) {
    if (!entry.isDirectory() || EXCLUDED_SKILLS.has(entry.name)) {
      continue;
    }
    cpSync(path.join(srcSkills, entry.name), path.join(destSkills, entry.name), { recursive: true });
  }
  // Belt-and-braces: if the excluded skill slipped in, remove it.
  for (const bad of EXCLUDED_SKILLS) {
    rmSync(path.join(destSkills, bad), { recursive: true, force: true });
  }

  // Make every eco agent report back in caveman voice (that is the subagent→orchestrator path).
  const agentsDir = path.join(workspace, ".claude", "agents");
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) {
      if (f.endsWith(".md")) {
        appendFileSync(path.join(agentsDir, f), VOICE_DIRECTIVE, "utf8");
      }
    }
  }
}
