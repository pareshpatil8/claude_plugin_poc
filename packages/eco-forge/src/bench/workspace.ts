import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Prepares an isolated, disposable workspace for one benchmark run. Every run starts from a clean
 * copy of the source project so a repetition cannot be contaminated by a previous run's edits, and
 * so the vanilla and eco arms see byte-identical starting code — the only difference between them
 * is whether the eco ecosystem is installed and how the task is phrased.
 */
export interface ArmWorkspaceSpec {
  readonly id: string;
  /** When true, `eco-forge init` is run into the workspace so the eco `.claude/` scaffolding, rules, agents and commands are present. */
  readonly eco: boolean;
}

export interface TaskRegression {
  /** Path relative to the project root whose content is mutated to introduce the bug. */
  readonly file: string;
  /** Literal substring to replace (must occur exactly once). */
  readonly find: string;
  readonly replace: string;
}

export interface PrepareInput {
  /** Absolute path to the pristine source project (e.g. the golden repo backend). */
  readonly sourceDir: string;
  readonly arm: ArmWorkspaceSpec;
  readonly regression?: TaskRegression;
  /** Directories under sourceDir to skip when copying (regenerated build output, VCS). */
  readonly exclude?: readonly string[];
  /** Absolute path to the eco-forge CLI entry (dist/cli.js); required when arm.eco is true. */
  readonly ecoCliPath?: string;
}

const DEFAULT_EXCLUDE = ["target", "node_modules", ".git", ".eco"];

/** Creates the workspace, returns its absolute path. Caller is responsible for cleanup(). */
export function prepareWorkspace(input: PrepareInput): string {
  const base = mkdtempSync(path.join(tmpdir(), `eco-bench-${input.arm.id}-`));
  const exclude = new Set([...DEFAULT_EXCLUDE, ...(input.exclude ?? [])]);
  cpSync(input.sourceDir, base, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(input.sourceDir, src);
      if (rel === "") {
        return true;
      }
      const top = rel.split(path.sep)[0] ?? "";
      return !exclude.has(top) && !exclude.has(path.basename(src));
    },
  });

  if (input.arm.eco) {
    if (!input.ecoCliPath) {
      throw new Error("ecoCliPath is required for an eco arm");
    }
    const init = spawnSync(
      process.execPath,
      [input.ecoCliPath, "init", "--dir", base, "--provider", "subscription", "--classification", "synthetic"],
      { encoding: "utf8", timeout: 120_000 },
    );
    if ((init.status ?? 1) !== 0 && (init.status ?? 1) !== 2) {
      rmSync(base, { recursive: true, force: true });
      throw new Error(`eco-forge init failed (exit ${init.status}): ${init.stderr || init.stdout}`);
    }
  }

  if (input.regression) {
    applyRegression(base, input.regression);
  }
  return base;
}

function applyRegression(root: string, reg: TaskRegression): void {
  const file = path.join(root, reg.file);
  const original = readFileSync(file, "utf8");
  const occurrences = original.split(reg.find).length - 1;
  if (occurrences !== 1) {
    throw new Error(`regression target "${reg.find}" occurs ${occurrences} time(s) in ${reg.file}; expected exactly 1`);
  }
  writeFileSync(file, original.replace(reg.find, reg.replace), "utf8");
}

export function cleanupWorkspace(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** Ensures a directory exists (used for the ledger state dir). */
export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}
