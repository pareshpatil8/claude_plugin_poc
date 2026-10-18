import { lstatSync, readFileSync } from "node:fs";
import { sha256 } from "./hash.js";
import type { Manifest } from "./manifest.js";
import { resolveInside } from "./paths.js";
import type { RenderedFile } from "./profiles.js";

export type ActionKind =
  | "create" // file absent
  | "update" // managed, untouched since last write, template changed
  | "unchanged" // already identical
  | "adopt" // unmanaged but identical: start managing it
  | "keep-modified" // managed but edited locally: left alone (three-way merge arrives in M1-20)
  | "conflict" // unmanaged and different, or not a regular file: left alone
  | "overwrite"; // unmanaged and different, replaced because of --force (original backed up)

export interface PlannedAction {
  readonly kind: ActionKind;
  readonly file: RenderedFile;
  readonly reason?: string;
}

export interface PlanOptions {
  readonly force: boolean;
}

export const WRITES: ReadonlySet<ActionKind> = new Set(["create", "update", "overwrite"]);

export function planActions(
  root: string,
  files: readonly RenderedFile[],
  manifest: Manifest | undefined,
  options: PlanOptions,
): PlannedAction[] {
  return files.map((file) => planOne(root, file, manifest, options));
}

function planOne(root: string, file: RenderedFile, manifest: Manifest | undefined, options: PlanOptions): PlannedAction {
  const target = resolveInside(root, file.dest);
  let stat;
  try {
    stat = lstatSync(target);
  } catch {
    return { kind: "create", file };
  }
  // Never follow or replace symlinks and directories, even with --force.
  if (stat.isSymbolicLink()) {
    return { kind: "conflict", file, reason: "destination is a symbolic link" };
  }
  if (!stat.isFile()) {
    return { kind: "conflict", file, reason: "destination exists and is not a regular file" };
  }

  const currentHash = sha256(readFileSync(target, "utf8"));
  const nextHash = sha256(file.content);
  const managed = manifest?.files[file.dest];

  if (currentHash === nextHash) {
    return { kind: managed ? "unchanged" : "adopt", file };
  }
  if (managed) {
    return managed.sha256 === currentHash
      ? { kind: "update", file }
      : { kind: "keep-modified", file, reason: "edited locally since eco-forge last wrote it" };
  }
  return options.force
    ? { kind: "overwrite", file, reason: "unmanaged file replaced (--force); original backed up" }
    : { kind: "conflict", file, reason: "unmanaged file with different content (use --force to replace)" };
}
