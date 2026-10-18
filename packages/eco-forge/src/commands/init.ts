import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { applyPlan } from "../core/apply.js";
import { detectProject, type Detection } from "../core/detect.js";
import { readManifest } from "../core/manifest.js";
import { resolveProviderSettings, type RawProviderOptions } from "../core/options.js";
import { packageInfo } from "../core/package-info.js";
import { planActions, type PlannedAction } from "../core/plan.js";
import { DEFAULT_PROFILE, renderProfile } from "../core/profiles.js";

export interface InitOptions extends RawProviderOptions {
  readonly dir: string;
  readonly profile?: string | undefined;
  readonly name?: string | undefined;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly templatesDir?: string | undefined;
}

export interface InitResult {
  readonly root: string;
  readonly profile: string;
  readonly detection: Detection;
  readonly actions: readonly PlannedAction[];
  readonly dryRun: boolean;
  readonly backupDir: string | undefined;
  readonly warnings: readonly string[];
  /** 0 = done, 2 = done but some files were left alone because of conflicts. */
  readonly exitCode: 0 | 2;
}

export class InitError extends Error {}

export function runInit(options: InitOptions): InitResult {
  const root = path.resolve(options.dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new InitError(`Target directory does not exist: ${root}`);
  }
  const pkg = packageInfo();
  const templatesDir = options.templatesDir ?? pkg.templatesDir;
  const settings = resolveProviderSettings(options);

  const manifest = readManifest(root);
  const profile = options.profile ?? manifest?.profile ?? DEFAULT_PROFILE;
  if (manifest && manifest.profile !== profile) {
    throw new InitError(
      `This project was initialised with profile "${manifest.profile}"; switching to "${profile}" is not supported yet`,
    );
  }
  const detected = detectProject(root);
  const codebase = manifest?.codebase ?? (detected.greenfield ? "greenfield" : "brownfield");
  const detection: Detection = { ...detected, greenfield: codebase === "greenfield" };

  const projectName = sanitizeName(options.name ?? path.basename(root));
  const files = renderProfile(templatesDir, {
    projectName,
    profile,
    ecoForgeVersion: pkg.version,
    settings,
    detection,
  });
  const actions = planActions(root, files, manifest, { force: options.force });

  const warnings: string[] = [];
  if (settings.provider === "bedrock" && !settings.models) {
    warnings.push(
      "No Bedrock model IDs configured. Claude Code's defaults may use cross-region inference profiles, " +
        "which would break India data residency. Re-run with --model-high/--model-mid/--model-low " +
        "once the in-region model IDs are confirmed.",
    );
  }
  if (!detection.gitRepo) {
    warnings.push("Not a git repository: eco-forge-managed files should be committed so the team shares them.");
  }

  const hasConflicts = actions.some((a) => a.kind === "conflict");
  let backupDir: string | undefined;
  if (!options.dryRun) {
    backupDir = applyPlan(root, actions, manifest, {
      schemaVersion: 1,
      ecoForgeVersion: pkg.version,
      profile,
      codebase,
    }).backupDir;
  }

  return { root, profile, detection, actions, dryRun: options.dryRun, backupDir, warnings, exitCode: hasConflicts ? 2 : 0 };
}

function sanitizeName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleaned.length === 0) {
    throw new InitError(`Cannot derive a project name from "${raw}"; pass --name`);
  }
  return cleaned;
}

export function formatInitResult(result: InitResult): string {
  const lines: string[] = [];
  const mode = result.dryRun ? " (dry run: nothing written)" : "";
  lines.push(`eco-forge init: profile ${result.profile}${mode}`);
  lines.push(`  project: ${result.root}`);
  lines.push(`  detected: ${describeDetection(result.detection)}`);
  lines.push("");
  const width = Math.max(...result.actions.map((a) => a.kind.length));
  for (const action of result.actions) {
    const reason = action.reason ? `  (${action.reason})` : "";
    lines.push(`  ${action.kind.padEnd(width)}  ${action.file.dest}${reason}`);
  }
  if (result.backupDir) {
    lines.push("", `  backups: ${result.backupDir}`);
  }
  for (const warning of result.warnings) {
    lines.push("", `warning: ${warning}`);
  }
  if (result.exitCode === 2) {
    lines.push("", "Some files were left unchanged because of conflicts (see above).");
  }
  return lines.join("\n");
}

function describeDetection(d: Detection): string {
  if (d.greenfield) {
    return "empty project (greenfield)";
  }
  const parts = [d.springBoot ? "Spring Boot" : undefined, d.angular ? "Angular" : undefined].filter(Boolean);
  return `${parts.length > 0 ? parts.join(" + ") : "no known stack"} (brownfield)`;
}
