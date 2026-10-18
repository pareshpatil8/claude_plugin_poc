import type { Detection } from "./detect.js";
import type { ProviderSettings } from "./options.js";

export interface GeneratorContext {
  readonly projectName: string;
  readonly profile: string;
  readonly ecoForgeVersion: string;
  readonly settings: ProviderSettings;
  readonly detection: Detection;
}

export type Generator = (ctx: GeneratorContext) => string;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Project-level deny rules. They are a first line of defence only: the guard hook (M1-05)
 * and org-wide managed settings (M1-04) are the enforcing layers.
 */
const DENY_RULES = [
  "Read(~/.aws/**)",
  "Read(~/.kube/**)",
  "Read(~/.ssh/**)",
  "Read(~/.vault-token)",
  "Read(./.env)",
  "Read(./.env.*)",
  "Read(**/*.pem)",
  "Read(**/*.key)",
  "Read(**/*.p12)",
  "Read(**/*.jks)",
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(git push --force-with-lease:*)",
];

function claudeSettings(ctx: GeneratorContext): string {
  const { settings } = ctx;
  const env: Record<string, string> = {
    // Claude Code is pinned through eco.lock and upgraded only via `eco-forge upgrade`.
    DISABLE_AUTOUPDATER: "1",
  };
  if (settings.provider === "bedrock") {
    env.CLAUDE_CODE_USE_BEDROCK = "1";
    env.AWS_REGION = settings.awsRegion;
    // Keeps telemetry, error reporting and other non-model traffic off the network (DPDP).
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
    if (settings.models) {
      env.ANTHROPIC_DEFAULT_OPUS_MODEL = settings.models.high;
      env.ANTHROPIC_DEFAULT_SONNET_MODEL = settings.models.mid;
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL = settings.models.low;
    }
  }
  // The guard runs FIRST (before any other eco-forge hook added later), so a blocked action is
  // stopped before tool output is captured or compressed. Enforcement lives in the hook, not the
  // model: exit 2 denies the call regardless of what the model intended.
  const guard = { type: "command", command: "eco-forge-guard" };
  return json({
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    env,
    permissions: { deny: DENY_RULES },
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [guard] }],
      UserPromptSubmit: [{ hooks: [guard] }],
    },
  });
}

function ecoConfig(ctx: GeneratorContext): string {
  const { settings, detection } = ctx;
  return json({
    schemaVersion: 1,
    project: ctx.projectName,
    profile: ctx.profile,
    classification: settings.classification,
    provider: settings.provider,
    aws: settings.provider === "bedrock" ? { region: settings.awsRegion } : undefined,
    models: settings.models ?? "pending: run `eco-forge doctor` to confirm in-region model IDs",
    codebase: detection.greenfield ? "greenfield" : "brownfield",
  });
}

/** MCP servers are added with pinned versions by later milestones (context-mode, GitLab, Figma). */
function mcpConfig(): string {
  return json({ mcpServers: {} });
}

export const GENERATORS: Readonly<Record<string, Generator>> = {
  "claude-settings": claudeSettings,
  "eco-config": ecoConfig,
  "mcp-config": mcpConfig,
};
