import { copyFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeEol, sha256 } from "./hash.js";
import { MANIFEST_PATH, serializeManifest, type ManagedFile, type Manifest } from "./manifest.js";
import { resolveInside } from "./paths.js";
import { WRITES, type PlannedAction } from "./plan.js";

export interface ApplyResult {
  readonly manifest: Manifest;
  readonly backupDir: string | undefined;
}

export function applyPlan(
  root: string,
  actions: readonly PlannedAction[],
  previous: Manifest | undefined,
  next: Omit<Manifest, "files">,
  now: Date = new Date(),
): ApplyResult {
  const files: Record<string, ManagedFile> = {};
  let backupDir: string | undefined;

  for (const action of actions) {
    const { file } = action;
    const target = resolveInside(root, file.dest);

    if (action.kind === "overwrite") {
      backupDir ??= path.join(root, ".eco", "backup", now.toISOString().replace(/[:.]/g, "-"));
      const backup = resolveInside(backupDir, file.dest);
      mkdirSync(path.dirname(backup), { recursive: true });
      copyFileSync(target, backup);
    }
    if (WRITES.has(action.kind)) {
      writeAtomic(target, file.content);
    }

    if (action.kind === "keep-modified") {
      const kept = previous?.files[file.dest];
      if (kept) {
        files[file.dest] = kept;
      }
    } else if (action.kind !== "conflict") {
      files[file.dest] = { sha256: sha256(file.content), template: file.template };
    }
  }

  const manifest: Manifest = { ...next, files };
  writeAtomic(path.join(root, MANIFEST_PATH), serializeManifest(manifest));
  return { manifest, backupDir };
}

/** Write to a sibling temp file then rename, so an interrupted run never leaves a half-written file. */
function writeAtomic(target: string, content: string): void {
  mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.eco-tmp-${process.pid}`;
  writeFileSync(temp, normalizeEol(content), { encoding: "utf8" });
  renameSync(temp, target);
}
